/**
 * File Version Service
 *
 * Handles file version tracking, creation, and restoration.
 * Automatically creates versions when files are updated.
 */

import { Pool } from 'pg';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import crypto from 'crypto';
import { Logger } from '@monorepo/shared';

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  checksum: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateVersionOptions {
  fileId: string;
  currentStoragePath: string;
  fileSize: number;
  mimeType: string;
  createdBy: string;
}

export class FileVersionService {
  private dbPool: Pool;
  private logger: Logger;

  constructor(dbPool: Pool, logger: Logger) {
    this.dbPool = dbPool;
    this.logger = logger;
  }

  /**
   * Calculate SHA256 checksum of a file using streaming
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get the next version number for a file
   */
  private async getNextVersionNumber(fileId: string): Promise<number> {
    const query = `
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
      FROM file_versions
      WHERE file_id = $1
    `;

    const result = await this.dbPool.query(query, [fileId]);
    return result.rows[0].next_version;
  }

  /**
   * Create a new version of a file
   * Copies the current file to versions storage and records metadata
   */
  async createVersion(options: CreateVersionOptions): Promise<FileVersion> {
    const versionNumber = await this.getNextVersionNumber(options.fileId);

    // Build version storage path
    const ext = path.extname(options.currentStoragePath);
    const dirname = path.dirname(options.currentStoragePath);
    const basename = path.basename(options.currentStoragePath, ext);
    const versionPath = path.join(dirname, `${basename}.v${versionNumber}${ext}`);

    // Copy current file to version storage
    const sourcePath = path.join('./storage', options.currentStoragePath);
    const destPath = path.join('./storage', versionPath);

    try {
      await fs.copyFile(sourcePath, destPath);
    } catch (error) {
      this.logger.error('Failed to copy file for versioning', error as Error, {
        sourcePath,
        destPath,
      });
      throw new Error('Failed to create file version');
    }

    // Calculate checksum
    const checksum = await this.calculateChecksum(destPath);

    // Insert version record
    const query = `
      INSERT INTO file_versions (
        file_id,
        version_number,
        storage_path,
        file_size,
        mime_type,
        checksum,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        file_id AS "fileId",
        version_number AS "versionNumber",
        storage_path AS "storagePath",
        file_size AS "fileSize",
        mime_type AS "mimeType",
        checksum,
        created_by AS "createdBy",
        created_at AS "createdAt"
    `;

    const values = [
      options.fileId,
      versionNumber,
      versionPath,
      options.fileSize,
      options.mimeType,
      checksum,
      options.createdBy,
    ];

    const result = await this.dbPool.query<FileVersion>(query, values);

    this.logger.info('File version created', {
      fileId: options.fileId,
      versionNumber,
      checksum,
    });

    return result.rows[0];
  }

  /**
   * List all versions of a file
   */
  async listVersions(
    fileId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ versions: FileVersion[]; total: number }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM file_versions
      WHERE file_id = $1
    `;
    const countResult = await this.dbPool.query(countQuery, [fileId]);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get versions
    const query = `
      SELECT
        id,
        file_id AS "fileId",
        version_number AS "versionNumber",
        storage_path AS "storagePath",
        file_size AS "fileSize",
        mime_type AS "mimeType",
        checksum,
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM file_versions
      WHERE file_id = $1
      ORDER BY version_number DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.dbPool.query<FileVersion>(query, [
      fileId,
      limit,
      offset,
    ]);

    return { versions: result.rows, total };
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: string, fileId?: string): Promise<FileVersion | null> {
    const conditions = ['id = $1'];
    const values: string[] = [versionId];

    if (fileId) {
      conditions.push('file_id = $2');
      values.push(fileId);
    }

    const query = `
      SELECT
        id,
        file_id AS "fileId",
        version_number AS "versionNumber",
        storage_path AS "storagePath",
        file_size AS "fileSize",
        mime_type AS "mimeType",
        checksum,
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM file_versions
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.dbPool.query<FileVersion>(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Restore a file to a specific version
   * Creates a new version of the current file, then replaces current with the requested version
   */
  async restoreVersion(
    versionId: string,
    fileId: string,
    userId: string
  ): Promise<{
    restoredVersion: FileVersion;
    newVersionOfCurrent: FileVersion;
  }> {
    // Get the version to restore
    const version = await this.getVersion(versionId, fileId);
    if (!version) {
      throw new Error('Version not found');
    }

    // Get current file metadata
    const fileQuery = `
      SELECT
        id,
        storage_path AS "storagePath",
        file_size AS "fileSize",
        mime_type AS "mimeType"
      FROM files
      WHERE id = $1
    `;
    const fileResult = await this.dbPool.query(fileQuery, [fileId]);

    if (fileResult.rows.length === 0) {
      throw new Error('File not found');
    }

    const currentFile = fileResult.rows[0];

    // Create a version of the current state before restoring
    const newVersionOfCurrent = await this.createVersion({
      fileId,
      currentStoragePath: currentFile.storagePath,
      fileSize: currentFile.fileSize,
      mimeType: currentFile.mimeType,
      createdBy: userId,
    });

    // Copy the version file to replace the current file
    const versionPath = path.join('./storage', version.storagePath);
    const currentPath = path.join('./storage', currentFile.storagePath);

    try {
      await fs.copyFile(versionPath, currentPath);
    } catch (error) {
      this.logger.error('Failed to restore file version', error as Error, {
        versionId,
        fileId,
      });
      throw new Error('Failed to restore file version');
    }

    // Update file metadata to match the restored version
    const updateQuery = `
      UPDATE files
      SET
        file_size = $1,
        mime_type = $2
      WHERE id = $3
    `;
    await this.dbPool.query(updateQuery, [
      version.fileSize,
      version.mimeType,
      fileId,
    ]);

    this.logger.info('File version restored', {
      fileId,
      versionId,
      versionNumber: version.versionNumber,
      userId,
    });

    return {
      restoredVersion: version,
      newVersionOfCurrent,
    };
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(
    versionId: string,
    fileId: string
  ): Promise<boolean> {
    // Get version to delete the physical file
    const version = await this.getVersion(versionId, fileId);
    if (!version) {
      return false;
    }

    // Delete from database
    const query = `
      DELETE FROM file_versions
      WHERE id = $1 AND file_id = $2
      RETURNING id
    `;

    const result = await this.dbPool.query(query, [versionId, fileId]);

    if (result.rows.length === 0) {
      return false;
    }

    // Delete physical file
    const versionPath = path.join('./storage', version.storagePath);
    try {
      await fs.unlink(versionPath);
    } catch (error) {
      this.logger.warn('Failed to delete version file from disk', {
        error,
        versionId,
        path: versionPath,
      });
      // Don't fail the operation if file deletion fails
    }

    this.logger.info('File version deleted', { versionId, fileId });
    return true;
  }

  /**
   * Clean up old versions (retention policy)
   * Keeps the N most recent versions, deletes older ones
   */
  async cleanupOldVersions(
    fileId: string,
    keepCount: number = 10
  ): Promise<number> {
    // Get versions to delete (older than keepCount)
    const query = `
      SELECT id, storage_path AS "storagePath"
      FROM file_versions
      WHERE file_id = $1
      ORDER BY version_number DESC
      OFFSET $2
    `;

    const result = await this.dbPool.query(query, [fileId, keepCount]);

    let deletedCount = 0;

    for (const version of result.rows) {
      const deleted = await this.deleteVersion(version.id, fileId);
      if (deleted) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.info('Cleaned up old versions', {
        fileId,
        deletedCount,
        kept: keepCount,
      });
    }

    return deletedCount;
  }
}
