/**
 * Batch Service
 * Business logic for batch operations on files and folders
 *
 * TODO: Integrate with StorageService for physical file operations
 * FIXME: batchCopyFiles currently creates duplicate database records
 *        pointing to the same physical file. This must be implemented
 *        before production use to properly copy files on disk.
 * FIXME: batchDeleteFiles with hard_delete doesn't remove physical files.
 *        Must integrate with StorageService.hardDeleteFile().
 */

import { Pool, PoolClient } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import type { BatchOperationResult } from '../types';

export class BatchService {
  constructor(
    private pool: Pool,
    private logger: PluginLogger
  ) {}

  /**
   * Batch move files to target folder
   */
  async batchMoveFiles(fileIds: string[], targetFolderId: string | null, userId: string): Promise<BatchOperationResult> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate target folder exists if provided
      if (targetFolderId) {
        const folderCheck = await client.query(
          `SELECT id FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
          [targetFolderId]
        );

        if (folderCheck.rows.length === 0) {
          throw new Error('Target folder not found');
        }
      }

      for (const fileId of fileIds) {
        try {
          // Check file exists
          const fileCheck = await client.query(
            `SELECT id FROM public.files WHERE id = $1 AND deleted_at IS NULL`,
            [fileId]
          );

          if (fileCheck.rows.length === 0) {
            failed.push({ id: fileId, error: 'File not found' });
            continue;
          }

          // Delete existing associations
          await client.query(
            `DELETE FROM plugin_file_manager.file_folders WHERE file_id = $1`,
            [fileId]
          );

          // Add new association if target folder provided
          if (targetFolderId) {
            await client.query(
              `INSERT INTO plugin_file_manager.file_folders (file_id, folder_id, added_by)
               VALUES ($1, $2, $3)`,
              [fileId, targetFolderId, userId]
            );
          }

          successful.push(fileId);
        } catch (error) {
          failed.push({ id: fileId, error: (error as Error).message });
        }
      }

      await client.query('COMMIT');
      this.logger.info(`Batch moved ${successful.length} files, ${failed.length} failed`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Batch move files failed', error as Error);
      throw error;
    } finally {
      client.release();
    }

    return { successful, failed, total: fileIds.length };
  }

  /**
   * Batch move folders to target parent
   */
  async batchMoveFolders(folderIds: string[], targetFolderId: string | null, userId: string): Promise<BatchOperationResult> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate target folder exists if provided
      if (targetFolderId) {
        const folderCheck = await client.query(
          `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
          [targetFolderId]
        );

        if (folderCheck.rows.length === 0) {
          throw new Error('Target folder not found');
        }

        const targetFolder = folderCheck.rows[0];
        if (targetFolder.depth >= 10) {
          throw new Error('Target folder is at maximum depth');
        }
      }

      for (const folderId of folderIds) {
        try {
          // Check folder exists
          const folderCheck = await client.query(
            `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
            [folderId]
          );

          if (folderCheck.rows.length === 0) {
            failed.push({ id: folderId, error: 'Folder not found' });
            continue;
          }

          // Check for circular reference
          if (targetFolderId && await this.validateCircularReference(folderId, targetFolderId, client)) {
            failed.push({ id: folderId, error: 'Cannot move folder into its own descendant' });
            continue;
          }

          // Update parent_id (triggers will recalculate path and depth)
          await client.query(
            `UPDATE plugin_file_manager.folders SET parent_id = $1 WHERE id = $2`,
            [targetFolderId, folderId]
          );

          successful.push(folderId);
        } catch (error) {
          failed.push({ id: folderId, error: (error as Error).message });
        }
      }

      await client.query('COMMIT');
      this.logger.info(`Batch moved ${successful.length} folders, ${failed.length} failed`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Batch move folders failed', error as Error);
      throw error;
    } finally {
      client.release();
    }

    return { successful, failed, total: folderIds.length };
  }

  /**
   * Batch copy files to target folder
   * Note: This creates new file records and copies physical files
   */
  async batchCopyFiles(fileIds: string[], targetFolderId: string | null, userId: string): Promise<BatchOperationResult> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate target folder exists if provided
      if (targetFolderId) {
        const folderCheck = await client.query(
          `SELECT id FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
          [targetFolderId]
        );

        if (folderCheck.rows.length === 0) {
          throw new Error('Target folder not found');
        }
      }

      for (const fileId of fileIds) {
        try {
          // Get file metadata
          const fileResult = await client.query(
            `SELECT * FROM public.files WHERE id = $1 AND deleted_at IS NULL`,
            [fileId]
          );

          if (fileResult.rows.length === 0) {
            failed.push({ id: fileId, error: 'File not found' });
            continue;
          }

          const originalFile = fileResult.rows[0];

          // CRITICAL WARNING: This implementation does NOT copy physical files
          // It only creates a duplicate database record pointing to the same file
          // This creates a shared file reference - deleting one will break the other
          // TODO: Integrate with StorageService to actually copy files on disk
          //       - Call StorageService.copyFile(originalPath, newPath)
          //       - Generate new unique filename
          //       - Update storage_path with new file path

          // Create new file record (currently points to same physical file!)
          const newFileResult = await client.query(
            `INSERT INTO public.files (
              plugin_id, filename, original_name, mime_type, file_extension,
              file_size, storage_path, storage_provider, width, height, duration,
              alt_text, caption, tags, uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id`,
            [
              originalFile.plugin_id,
              originalFile.filename, // In production, generate new filename
              originalFile.original_name + ' (Copy)',
              originalFile.mime_type,
              originalFile.file_extension,
              originalFile.file_size,
              originalFile.storage_path, // In production, use new path
              originalFile.storage_provider,
              originalFile.width,
              originalFile.height,
              originalFile.duration,
              originalFile.alt_text,
              originalFile.caption,
              originalFile.tags,
              userId
            ]
          );

          const newFileId = newFileResult.rows[0].id;

          // Associate with target folder if provided
          if (targetFolderId) {
            await client.query(
              `INSERT INTO plugin_file_manager.file_folders (file_id, folder_id, added_by)
               VALUES ($1, $2, $3)`,
              [newFileId, targetFolderId, userId]
            );
          }

          successful.push(newFileId);
        } catch (error) {
          failed.push({ id: fileId, error: (error as Error).message });
        }
      }

      await client.query('COMMIT');
      this.logger.info(`Batch copied ${successful.length} files, ${failed.length} failed`);
      this.logger.warn('Note: Physical file copies were not created. Only database records were duplicated.');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Batch copy files failed', error as Error);
      throw error;
    } finally {
      client.release();
    }

    return { successful, failed, total: fileIds.length };
  }

  /**
   * Batch tag files
   */
  async batchTagFiles(
    fileIds: string[],
    tags: string[],
    operation: 'add' | 'remove' | 'replace',
    userId: string
  ): Promise<BatchOperationResult> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const fileId of fileIds) {
        try {
          // Get current tags
          const fileResult = await client.query(
            `SELECT id, tags FROM public.files WHERE id = $1 AND deleted_at IS NULL`,
            [fileId]
          );

          if (fileResult.rows.length === 0) {
            failed.push({ id: fileId, error: 'File not found' });
            continue;
          }

          const currentTags = fileResult.rows[0].tags || [];
          let newTags: string[] = [];

          // Apply operation
          switch (operation) {
            case 'add':
              // Add new tags, avoid duplicates
              newTags = [...new Set([...currentTags, ...tags])];
              break;
            case 'remove':
              // Remove specified tags
              newTags = currentTags.filter((tag: string) => !tags.includes(tag));
              break;
            case 'replace':
              // Replace all tags
              newTags = tags;
              break;
          }

          // Update tags
          await client.query(
            `UPDATE public.files SET tags = $1 WHERE id = $2`,
            [newTags, fileId]
          );

          successful.push(fileId);
        } catch (error) {
          failed.push({ id: fileId, error: (error as Error).message });
        }
      }

      await client.query('COMMIT');
      this.logger.info(`Batch tagged ${successful.length} files (${operation}), ${failed.length} failed`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Batch tag files failed', error as Error);
      throw error;
    } finally {
      client.release();
    }

    return { successful, failed, total: fileIds.length };
  }

  /**
   * Batch delete files
   */
  async batchDeleteFiles(fileIds: string[], hardDelete: boolean, userId: string): Promise<BatchOperationResult> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const fileId of fileIds) {
        try {
          // Check file exists
          const fileCheck = await client.query(
            `SELECT id FROM public.files WHERE id = $1 AND deleted_at IS NULL`,
            [fileId]
          );

          if (fileCheck.rows.length === 0) {
            failed.push({ id: fileId, error: 'File not found' });
            continue;
          }

          if (hardDelete) {
            // Hard delete
            await client.query(`DELETE FROM public.files WHERE id = $1`, [fileId]);
            // CRITICAL TODO: Delete physical file via StorageService
            // Must call: await storageService.hardDeleteFile(fileId)
            // Current implementation leaves orphaned files on disk
          } else {
            // Soft delete
            await client.query(
              `UPDATE public.files SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2`,
              [userId, fileId]
            );
          }

          successful.push(fileId);
        } catch (error) {
          failed.push({ id: fileId, error: (error as Error).message });
        }
      }

      await client.query('COMMIT');
      this.logger.info(`Batch deleted ${successful.length} files (${hardDelete ? 'hard' : 'soft'}), ${failed.length} failed`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Batch delete files failed', error as Error);
      throw error;
    } finally {
      client.release();
    }

    return { successful, failed, total: fileIds.length };
  }

  /**
   * Batch delete folders
   */
  async batchDeleteFolders(folderIds: string[], hardDelete: boolean, userId: string): Promise<BatchOperationResult> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const folderId of folderIds) {
        try {
          // Check folder exists
          const folderResult = await client.query(
            `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
            [folderId]
          );

          if (folderResult.rows.length === 0) {
            failed.push({ id: folderId, error: 'Folder not found' });
            continue;
          }

          const folder = folderResult.rows[0];

          // Check if system folder
          if (folder.is_system) {
            failed.push({ id: folderId, error: 'Cannot delete system folder' });
            continue;
          }

          if (hardDelete) {
            // Hard delete (CASCADE will handle children)
            await client.query(`DELETE FROM plugin_file_manager.folders WHERE id = $1`, [folderId]);
          } else {
            // Soft delete
            await client.query(
              `UPDATE plugin_file_manager.folders SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2`,
              [userId, folderId]
            );
          }

          successful.push(folderId);
        } catch (error) {
          failed.push({ id: folderId, error: (error as Error).message });
        }
      }

      await client.query('COMMIT');
      this.logger.info(`Batch deleted ${successful.length} folders (${hardDelete ? 'hard' : 'soft'}), ${failed.length} failed`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Batch delete folders failed', error as Error);
      throw error;
    } finally {
      client.release();
    }

    return { successful, failed, total: folderIds.length };
  }

  /**
   * Validate circular reference
   */
  private async validateCircularReference(folderId: string, newParentId: string, client: PoolClient): Promise<boolean> {
    const result = await client.query(
      `WITH RECURSIVE descendants AS (
        SELECT id FROM plugin_file_manager.folders WHERE id = $1
        UNION ALL
        SELECT f.id FROM plugin_file_manager.folders f
        INNER JOIN descendants d ON f.parent_id = d.id
      )
      SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2) as is_circular`,
      [folderId, newParentId]
    );

    return result.rows[0].is_circular;
  }
}
