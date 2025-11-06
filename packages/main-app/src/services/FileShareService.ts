/**
 * File Share Service
 *
 * Handles creation, validation, and management of file sharing links.
 * Supports expiration dates, download limits, and password protection.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Logger } from '@monorepo/shared';

export interface FileShare {
  id: string;
  fileId: string;
  shareToken: string;
  createdBy: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  passwordHash: string | null;
  isActive: boolean;
  createdAt: string;
  lastAccessedAt: string | null;
}

export interface CreateShareOptions {
  fileId: string;
  createdBy: string;
  expiresAt?: Date;
  maxDownloads?: number;
  password?: string;
}

export interface ValidateShareResult {
  valid: boolean;
  fileId?: string;
  error?: string;
  requiresPassword?: boolean;
}

export class FileShareService {
  private dbPool: Pool;
  private logger: Logger;

  constructor(dbPool: Pool, logger: Logger) {
    this.dbPool = dbPool;
    this.logger = logger;
  }

  /**
   * Generate a cryptographically secure share token
   */
  private generateShareToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new file share
   */
  async createShare(options: CreateShareOptions): Promise<FileShare> {
    const shareToken = this.generateShareToken();
    const passwordHash = options.password
      ? await bcrypt.hash(options.password, 10)
      : null;

    const query = `
      INSERT INTO file_shares (
        file_id,
        share_token,
        created_by,
        expires_at,
        max_downloads,
        password_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        file_id AS "fileId",
        share_token AS "shareToken",
        created_by AS "createdBy",
        expires_at AS "expiresAt",
        max_downloads AS "maxDownloads",
        download_count AS "downloadCount",
        password_hash AS "passwordHash",
        is_active AS "isActive",
        created_at AS "createdAt",
        last_accessed_at AS "lastAccessedAt"
    `;

    const values = [
      options.fileId,
      shareToken,
      options.createdBy,
      options.expiresAt || null,
      options.maxDownloads || null,
      passwordHash,
    ];

    const result = await this.dbPool.query<FileShare>(query, values);

    this.logger.info('File share created', {
      shareId: result.rows[0].id,
      fileId: options.fileId,
      hasPassword: !!options.password,
      hasExpiration: !!options.expiresAt,
    });

    return result.rows[0];
  }

  /**
   * Validate a share token and check if access is allowed
   */
  async validateShare(
    shareToken: string,
    password?: string
  ): Promise<ValidateShareResult> {
    const query = `
      SELECT
        id,
        file_id AS "fileId",
        expires_at AS "expiresAt",
        max_downloads AS "maxDownloads",
        download_count AS "downloadCount",
        password_hash AS "passwordHash",
        is_active AS "isActive"
      FROM file_shares
      WHERE share_token = $1
    `;

    const result = await this.dbPool.query(query, [shareToken]);

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid share token' };
    }

    const share = result.rows[0];

    // Check if share is active
    if (!share.isActive) {
      return { valid: false, error: 'Share link has been deactivated' };
    }

    // Check expiration
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return { valid: false, error: 'Share link has expired' };
    }

    // Check download limit
    if (
      share.maxDownloads !== null &&
      share.downloadCount >= share.maxDownloads
    ) {
      return { valid: false, error: 'Download limit reached' };
    }

    // Check password if required
    if (share.passwordHash) {
      if (!password) {
        return { valid: false, requiresPassword: true, error: 'Password required' };
      }

      const passwordValid = await bcrypt.compare(password, share.passwordHash);
      if (!passwordValid) {
        return { valid: false, error: 'Invalid password' };
      }
    }

    return { valid: true, fileId: share.fileId };
  }

  /**
   * Record a download and update share statistics
   */
  async recordDownload(shareToken: string): Promise<void> {
    const query = `
      UPDATE file_shares
      SET
        download_count = download_count + 1,
        last_accessed_at = CURRENT_TIMESTAMP
      WHERE share_token = $1
    `;

    await this.dbPool.query(query, [shareToken]);
  }

  /**
   * List all shares for a specific file
   */
  async listSharesForFile(fileId: string): Promise<FileShare[]> {
    const query = `
      SELECT
        id,
        file_id AS "fileId",
        share_token AS "shareToken",
        created_by AS "createdBy",
        expires_at AS "expiresAt",
        max_downloads AS "maxDownloads",
        download_count AS "downloadCount",
        password_hash AS "passwordHash",
        is_active AS "isActive",
        created_at AS "createdAt",
        last_accessed_at AS "lastAccessedAt"
      FROM file_shares
      WHERE file_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.dbPool.query<FileShare>(query, [fileId]);
    return result.rows;
  }

  /**
   * List all shares created by a specific user
   */
  async listSharesByUser(
    userId: string,
    options: {
      includeInactive?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ shares: FileShare[]; total: number }> {
    const conditions = ['created_by = $1'];
    const values: (string | number)[] = [userId];

    if (!options.includeInactive) {
      conditions.push('is_active = true');
    }

    const whereClause = conditions.join(' AND ');
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM file_shares
      WHERE ${whereClause}
    `;
    const countResult = await this.dbPool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get shares
    const query = `
      SELECT
        id,
        file_id AS "fileId",
        share_token AS "shareToken",
        created_by AS "createdBy",
        expires_at AS "expiresAt",
        max_downloads AS "maxDownloads",
        download_count AS "downloadCount",
        password_hash AS "passwordHash",
        is_active AS "isActive",
        created_at AS "createdAt",
        last_accessed_at AS "lastAccessedAt"
      FROM file_shares
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const result = await this.dbPool.query<FileShare>(query, [
      ...values,
      limit,
      offset,
    ]);

    return { shares: result.rows, total };
  }

  /**
   * Revoke a share (deactivate it)
   */
  async revokeShare(shareId: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE file_shares
      SET is_active = false
      WHERE id = $1 AND created_by = $2
      RETURNING id
    `;

    const result = await this.dbPool.query(query, [shareId, userId]);

    if (result.rows.length === 0) {
      return false;
    }

    this.logger.info('File share revoked', { shareId, userId });
    return true;
  }

  /**
   * Delete a share permanently
   */
  async deleteShare(shareId: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM file_shares
      WHERE id = $1 AND created_by = $2
      RETURNING id
    `;

    const result = await this.dbPool.query(query, [shareId, userId]);

    if (result.rows.length === 0) {
      return false;
    }

    this.logger.info('File share deleted', { shareId, userId });
    return true;
  }

  /**
   * Update share settings
   */
  async updateShare(
    shareId: string,
    userId: string,
    updates: {
      expiresAt?: Date | null;
      maxDownloads?: number | null;
      isActive?: boolean;
    }
  ): Promise<FileShare | null> {
    const setClauses: string[] = [];
    const values: (string | number | boolean | Date | null)[] = [];
    let paramIndex = 1;

    if (updates.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      values.push(updates.expiresAt);
    }

    if (updates.maxDownloads !== undefined) {
      setClauses.push(`max_downloads = $${paramIndex++}`);
      values.push(updates.maxDownloads);
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (setClauses.length === 0) {
      return null;
    }

    values.push(shareId, userId);

    const query = `
      UPDATE file_shares
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND created_by = $${paramIndex++}
      RETURNING
        id,
        file_id AS "fileId",
        share_token AS "shareToken",
        created_by AS "createdBy",
        expires_at AS "expiresAt",
        max_downloads AS "maxDownloads",
        download_count AS "downloadCount",
        password_hash AS "passwordHash",
        is_active AS "isActive",
        created_at AS "createdAt",
        last_accessed_at AS "lastAccessedAt"
    `;

    const result = await this.dbPool.query<FileShare>(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    this.logger.info('File share updated', { shareId, userId });
    return result.rows[0];
  }

  /**
   * Clean up expired shares (can be run periodically)
   */
  async cleanupExpiredShares(): Promise<number> {
    const query = `
      UPDATE file_shares
      SET is_active = false
      WHERE expires_at < CURRENT_TIMESTAMP
        AND is_active = true
      RETURNING id
    `;

    const result = await this.dbPool.query(query);

    if (result.rows.length > 0) {
      this.logger.info('Cleaned up expired shares', {
        count: result.rows.length,
      });
    }

    return result.rows.length;
  }
}
