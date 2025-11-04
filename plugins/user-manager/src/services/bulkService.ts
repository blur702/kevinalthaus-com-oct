/**
 * Bulk operations service - CSV/JSON import and export
 */

import { Pool } from 'pg';
import { sanitizeFilename, validateEmail, hashPassword } from '@monorepo/shared';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import crypto from 'crypto';

// Simple logger interface for services
interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void;
}

export interface BulkImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: unknown }>;
}

export interface BulkExportOptions {
  format: 'csv' | 'json';
  includeCustomFields?: boolean;
  filters?: {
    role?: string;
    search?: string;
  };
}

export interface UserExportRow {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
  custom_fields?: string; // JSON string
}

export class BulkService {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  /**
   * Import users from CSV
   */
  async importFromCSV(csvContent: string, actorId: string): Promise<BulkImportResult> {
    try {
      // Parse CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<Record<string, string>>;

      this.logger.info(`Parsed ${records.length} records from CSV`);

      return await this.importUsers(records, actorId);
    } catch (error) {
      this.logger.error('Failed to import from CSV', error as Error);
      throw new Error(`CSV parsing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Import users from JSON
   */
  async importFromJSON(jsonContent: string, actorId: string): Promise<BulkImportResult> {
    try {
      const records = JSON.parse(jsonContent) as Array<Record<string, unknown>>;

      if (!Array.isArray(records)) {
        throw new Error('JSON must be an array of user objects');
      }

      this.logger.info(`Parsed ${records.length} records from JSON`);

      return await this.importUsers(records, actorId);
    } catch (error) {
      this.logger.error('Failed to import from JSON', error as Error);
      throw new Error(`JSON parsing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Import users from parsed records
   */
  private async importUsers(
    records: Array<Record<string, unknown>>,
    actorId: string
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      total: records.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 1;

      try {
        // Validate required fields
        const email = record.email as string;
        const username = record.username as string;
        const role = (record.role as string) || 'viewer';

        if (!email || !username) {
          throw new Error('Missing required fields: email and username are required');
        }

        // Validate email format
        if (!validateEmail(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }

        // Check if user already exists
        const existingUser = await this.pool.query(
          'SELECT id FROM public.users WHERE email = $1 OR username = $2',
          [email, username]
        );

        if (existingUser.rows.length > 0) {
          throw new Error(`User already exists with email ${email} or username ${username}`);
        }

        // For bulk import, we generate a secure temporary password that users must reset via email
        // This is a security best practice for bulk operations
        const tempPassword = this.generateTempPassword();

        // Hash the temporary password using bcrypt before storing
        const hashedPassword = await hashPassword(tempPassword);

        // Insert user (note: in production, integrate with user creation service)
        // This is a simplified example - actual implementation should use the core user service
        await this.pool.query(
          `INSERT INTO public.users (email, username, role, password_hash)
           VALUES ($1, $2, $3, $4)`,
          [email, username, role, hashedPassword]
        );

        // Handle custom fields if provided
        if (record.custom_fields) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const customFields =
            typeof record.custom_fields === 'string'
              ? JSON.parse(record.custom_fields)
              : record.custom_fields;

          await this.pool.query(
            `INSERT INTO plugin_user_manager.user_custom_fields
             (user_id, field_data, created_by, updated_by)
             SELECT id, $1, $2, $2 FROM public.users WHERE email = $3`,
            [JSON.stringify(customFields), actorId, email]
          );
        }

        result.successful++;
        this.logger.info(`Imported user ${rowNumber}: ${email}`);
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: (error as Error).message,
          data: record,
        });
        this.logger.warn(`Failed to import user ${rowNumber}: ${(error as Error).message}`);
      }
    }

    this.logger.info(`Bulk import completed: ${result.successful} successful, ${result.failed} failed`);
    return result;
  }

  /**
   * Export users to CSV
   */
  async exportToCSV(options: BulkExportOptions = { format: 'csv' }): Promise<string> {
    try {
      const users = await this.fetchUsersForExport(options);

      const csvContent = stringify(users, {
        header: true,
        columns: this.getExportColumns(options.includeCustomFields),
      });

      this.logger.info(`Exported ${users.length} users to CSV`);
      return csvContent;
    } catch (error) {
      this.logger.error('Failed to export to CSV', error as Error);
      throw error;
    }
  }

  /**
   * Export users to JSON
   */
  async exportToJSON(options: BulkExportOptions = { format: 'json' }): Promise<string> {
    try {
      const users = await this.fetchUsersForExport(options);

      const jsonContent = JSON.stringify(users, null, 2);

      this.logger.info(`Exported ${users.length} users to JSON`);
      return jsonContent;
    } catch (error) {
      this.logger.error('Failed to export to JSON', error as Error);
      throw error;
    }
  }

  /**
   * Fetch users for export with optional filters
   */
  private async fetchUsersForExport(options: BulkExportOptions): Promise<UserExportRow[]> {
    let query = `
      SELECT u.id, u.email, u.username, u.role,
             u.created_at, u.updated_at
    `;

    if (options.includeCustomFields) {
      query += `, cf.field_data as custom_fields`;
    }

    query += ` FROM public.users u`;

    if (options.includeCustomFields) {
      query += `
        LEFT JOIN plugin_user_manager.user_custom_fields cf ON u.id = cf.user_id
      `;
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.filters?.role) {
      conditions.push(`u.role = $${paramIndex}`);
      params.push(options.filters.role);
      paramIndex++;
    }

    if (options.filters?.search) {
      conditions.push(`(u.email ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`);
      params.push(`%${options.filters.search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY u.created_at DESC`;

    const result = await this.pool.query<UserExportRow>(query, params);

    // Format dates and custom fields
    return result.rows.map((row) => ({
      ...row,
      created_at: row.created_at.toString(),
      updated_at: row.updated_at.toString(),
      custom_fields: row.custom_fields ? JSON.stringify(row.custom_fields) : undefined,
    }));
  }

  /**
   * Get export columns based on options
   */
  private getExportColumns(includeCustomFields?: boolean): string[] {
    const columns = ['id', 'email', 'username', 'role', 'created_at', 'updated_at'];

    if (includeCustomFields) {
      columns.push('custom_fields');
    }

    return columns;
  }

  /**
   * Generate cryptographically secure temporary password for bulk imported users
   * In production, users should be required to reset via email
   */
  private generateTempPassword(): string {
    // Use Node's crypto module for cryptographically secure random generation
    // Note: This should trigger a password reset email in production
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const charsetLength = chars.length;
    let password = '';

    // Generate 16 characters using rejection sampling to avoid modulo bias
    while (password.length < 16) {
      // Get a random byte
      const randomBytes = crypto.randomBytes(1);
      const randomValue = randomBytes[0];

      // Calculate the maximum value we can use without bias
      // (largest multiple of charsetLength that fits in 256)
      const maxUsableValue = Math.floor(256 / charsetLength) * charsetLength;

      // Only use the random value if it's within the unbiased range
      if (randomValue < maxUsableValue) {
        const index = randomValue % charsetLength;
        password += chars.charAt(index);
      }
      // If randomValue >= maxUsableValue, discard it and try again (rejection sampling)
    }

    return password;
  }

  /**
   * Validate bulk import file
   */
  validateImportFile(content: string, format: 'csv' | 'json'): {
    valid: boolean;
    errors: string[];
    recordCount: number;
  } {
    const errors: string[] = [];
    let recordCount = 0;

    try {
      if (format === 'csv') {
        const records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Array<Record<string, string>>;

        recordCount = records.length;

        // Validate structure
        if (recordCount === 0) {
          errors.push('CSV file is empty');
        }

        // Check required columns
        const requiredColumns = ['email', 'username'];
        const firstRecord = records[0];
        if (firstRecord) {
          const missingColumns = requiredColumns.filter((col) => !(col in firstRecord));
          if (missingColumns.length > 0) {
            errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
          }
        }
      } else if (format === 'json') {
        const records = JSON.parse(content) as Array<Record<string, unknown>>;

        if (!Array.isArray(records)) {
          errors.push('JSON must be an array of objects');
        } else {
          recordCount = records.length;

          if (recordCount === 0) {
            errors.push('JSON array is empty');
          }
        }
      }
    } catch (error) {
      errors.push(`Failed to parse ${format.toUpperCase()}: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      recordCount,
    };
  }

  /**
   * Sanitize filename for export
   */
  sanitizeExportFilename(filename: string): string {
    return sanitizeFilename(filename);
  }
}
