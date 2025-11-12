/**
 * Storage Wrapper Service
 * Provides file system operations for batch file operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';

export class StorageWrapper {
  private uploadsDir: string;

  constructor(
    private pool: Pool,
    private logger: PluginLogger
  ) {
    this.uploadsDir = process.env.STORAGE_PATH || './storage/uploads';
  }

  /**
   * Copy file from source to destination
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });

    await fs.copyFile(sourcePath, destPath);
    this.logger.debug(`File copied: ${sourcePath} -> ${destPath}`);
  }

  /**
   * Hard delete a file (physical + database)
   */
  async hardDeleteFile(fileId: string, userId: string): Promise<void> {
    // Get file metadata
    const result = await this.pool.query(
      'SELECT storage_path FROM public.files WHERE id = $1',
      [fileId]
    );

    if (result.rows.length === 0) {
      throw new Error('File not found');
    }

    const storagePath = result.rows[0].storage_path;
    const fullPath = path.join(this.uploadsDir, storagePath);

    // Delete physical file
    try {
      await fs.unlink(fullPath);
      this.logger.debug(`Physical file deleted: ${fullPath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete physical file: ${fullPath}`, { error: (error as Error).message });
      // Continue to delete database record even if physical file is missing
    }

    // Delete database record
    await this.pool.query('DELETE FROM public.files WHERE id = $1', [fileId]);
    this.logger.debug(`Database record deleted for file: ${fileId}`);
  }
}
