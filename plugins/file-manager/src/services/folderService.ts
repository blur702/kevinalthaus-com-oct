/**
 * Folder Service
 * Business logic for folder management operations
 */

import { Pool, PoolClient } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import slugify from 'slugify';
import type {
  Folder,
  FolderWithChildren,
  FileFolderAssociation,
  CreateFolderInput,
  UpdateFolderInput,
  FileMetadata
} from '../types';

export class FolderService {
  constructor(
    private pool: Pool,
    private logger: PluginLogger
  ) {}

  /**
   * Get folder hierarchy starting from parent
   */
  async getFolderHierarchy(parentId?: string, maxDepth?: number): Promise<FolderWithChildren[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        WITH RECURSIVE folder_tree AS (
          -- Base case: start from parent or root folders
          SELECT
            f.*,
            0 as tree_depth,
            ARRAY[f.id] as path_ids,
            (SELECT COUNT(*) FROM plugin_file_manager.file_folders ff WHERE ff.folder_id = f.id) as file_count
          FROM plugin_file_manager.folders f
          WHERE
            ${parentId ? 'f.parent_id = $1' : 'f.parent_id IS NULL'}
            AND f.deleted_at IS NULL

          UNION ALL

          -- Recursive case: get children
          SELECT
            f.*,
            ft.tree_depth + 1,
            ft.path_ids || f.id,
            (SELECT COUNT(*) FROM plugin_file_manager.file_folders ff WHERE ff.folder_id = f.id) as file_count
          FROM plugin_file_manager.folders f
          INNER JOIN folder_tree ft ON f.parent_id = ft.id
          WHERE
            f.deleted_at IS NULL
            ${maxDepth ? `AND ft.tree_depth < $${parentId ? '2' : '1'}` : ''}
        )
        SELECT * FROM folder_tree
        ORDER BY path_ids, name
      `;

      const params = [];
      if (parentId) params.push(parentId);
      if (maxDepth) params.push(maxDepth);

      const result = await client.query(query, params);

      // Build tree structure
      return this.buildFolderTree(result.rows);
    } finally {
      client.release();
    }
  }

  /**
   * Get single folder with files
   */
  async getFolderWithFiles(folderId: string): Promise<{ folder: Folder; files: FileMetadata[] }> {
    const client = await this.pool.connect();
    try {
      // Get folder
      const folderResult = await client.query(
        `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
        [folderId]
      );

      if (folderResult.rows.length === 0) {
        throw new Error('Folder not found');
      }

      const folder = folderResult.rows[0];

      // Get associated files
      const filesResult = await client.query(
        `SELECT
          f.*,
          ff.position,
          ff.added_at
        FROM public.files f
        INNER JOIN plugin_file_manager.file_folders ff ON f.id = ff.file_id
        WHERE ff.folder_id = $1 AND f.deleted_at IS NULL
        ORDER BY
          CASE WHEN ff.position IS NOT NULL THEN 0 ELSE 1 END,
          ff.position,
          ff.added_at DESC`,
        [folderId]
      );

      return {
        folder,
        files: filesResult.rows
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create new folder
   */
  async createFolder(data: CreateFolderInput, userId: string): Promise<Folder> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Generate slug if not provided
      const slug = data.slug || this.generateSlug(data.name);

      // Get parent folder if parent_id provided
      let parentFolder = null;
      if (data.parent_id) {
        const parentResult = await client.query(
          `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
          [data.parent_id]
        );

        if (parentResult.rows.length === 0) {
          throw new Error('Parent folder not found');
        }

        parentFolder = parentResult.rows[0];

        // Check max depth
        if (parentFolder.depth >= 10) {
          throw new Error('Maximum folder depth (10) exceeded');
        }
      }

      // Check for duplicate name/slug in same parent
      const duplicateCheck = await client.query(
        `SELECT id FROM plugin_file_manager.folders
         WHERE (parent_id = $1 OR ($1 IS NULL AND parent_id IS NULL))
         AND (name = $2 OR slug = $3)
         AND deleted_at IS NULL`,
        [data.parent_id || null, data.name, slug]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error('Folder with same name or slug already exists in this parent');
      }

      // Insert folder (triggers will calculate path and depth)
      const result = await client.query(
        `INSERT INTO plugin_file_manager.folders (
          name, slug, description, parent_id, color, icon, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [data.name, slug, data.description || null, data.parent_id || null, data.color || null, data.icon || null, userId]
      );

      await client.query('COMMIT');

      this.logger.info(`Created folder: ${data.name} (${result.rows[0].id})`);
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create folder', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update folder
   */
  async updateFolder(folderId: string, data: UpdateFolderInput, userId: string): Promise<Folder> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get existing folder
      const existingResult = await client.query(
        `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
        [folderId]
      );

      if (existingResult.rows.length === 0) {
        throw new Error('Folder not found');
      }

      const existing = existingResult.rows[0];

      // Check if system folder
      if (existing.is_system) {
        throw new Error('Cannot modify system folder');
      }

      // Check for duplicate name/slug if changing
      if (data.name || data.slug) {
        const newName = data.name || existing.name;
        const newSlug = data.slug || existing.slug;

        const duplicateCheck = await client.query(
          `SELECT id FROM plugin_file_manager.folders
           WHERE (parent_id = $1 OR ($1 IS NULL AND parent_id IS NULL))
           AND (name = $2 OR slug = $3)
           AND id != $4
           AND deleted_at IS NULL`,
          [existing.parent_id || null, newName, newSlug, folderId]
        );

        if (duplicateCheck.rows.length > 0) {
          throw new Error('Folder with same name or slug already exists in this parent');
        }
      }

      // Build update query
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.slug !== undefined) {
        updates.push(`slug = $${paramCount++}`);
        values.push(data.slug);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.color !== undefined) {
        updates.push(`color = $${paramCount++}`);
        values.push(data.color);
      }
      if (data.icon !== undefined) {
        updates.push(`icon = $${paramCount++}`);
        values.push(data.icon);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(folderId);

      const result = await client.query(
        `UPDATE plugin_file_manager.folders
         SET ${updates.join(', ')}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        values
      );

      await client.query('COMMIT');

      this.logger.info(`Updated folder: ${folderId}`);
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update folder', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete folder (soft delete)
   */
  async deleteFolder(folderId: string, userId: string, hardDelete: boolean): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get folder
      const folderResult = await client.query(
        `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
        [folderId]
      );

      if (folderResult.rows.length === 0) {
        throw new Error('Folder not found');
      }

      const folder = folderResult.rows[0];

      // Check if system folder
      if (folder.is_system) {
        throw new Error('Cannot delete system folder');
      }

      // Check for children
      const childrenResult = await client.query(
        `SELECT COUNT(*) as count FROM plugin_file_manager.folders WHERE parent_id = $1 AND deleted_at IS NULL`,
        [folderId]
      );

      if (childrenResult.rows[0].count > 0 && !hardDelete) {
        throw new Error('Cannot delete folder with children. Use hard delete to remove children.');
      }

      if (hardDelete) {
        // Hard delete: CASCADE will handle children and associations
        await client.query(`DELETE FROM plugin_file_manager.folders WHERE id = $1`, [folderId]);
        this.logger.info(`Hard deleted folder: ${folderId}`);
      } else {
        // Soft delete
        await client.query(
          `UPDATE plugin_file_manager.folders SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2`,
          [userId, folderId]
        );
        this.logger.info(`Soft deleted folder: ${folderId}`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to delete folder', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Move folder to new parent
   */
  async moveFolder(folderId: string, newParentId: string | null, userId: string): Promise<Folder> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get folder
      const folderResult = await client.query(
        `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
        [folderId]
      );

      if (folderResult.rows.length === 0) {
        throw new Error('Folder not found');
      }

      // Check for circular reference
      if (newParentId && await this.validateCircularReference(folderId, newParentId, client)) {
        throw new Error('Cannot move folder into its own descendant');
      }

      // Get new parent if provided
      if (newParentId) {
        const parentResult = await client.query(
          `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
          [newParentId]
        );

        if (parentResult.rows.length === 0) {
          throw new Error('New parent folder not found');
        }

        const parent = parentResult.rows[0];
        if (parent.depth >= 10) {
          throw new Error('Maximum folder depth (10) would be exceeded');
        }
      }

      // Update parent_id (triggers will recalculate path and depth)
      const result = await client.query(
        `UPDATE plugin_file_manager.folders
         SET parent_id = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [newParentId, folderId]
      );

      await client.query('COMMIT');

      this.logger.info(`Moved folder ${folderId} to parent ${newParentId || 'root'}`);
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to move folder', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add file to folder
   */
  async addFileToFolder(fileId: string, folderId: string, userId: string, position?: number): Promise<FileFolderAssociation> {
    const client = await this.pool.connect();
    try {
      // Check file exists
      const fileResult = await client.query(
        `SELECT id FROM public.files WHERE id = $1 AND deleted_at IS NULL`,
        [fileId]
      );

      if (fileResult.rows.length === 0) {
        throw new Error('File not found');
      }

      // Check folder exists
      const folderResult = await client.query(
        `SELECT id FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
        [folderId]
      );

      if (folderResult.rows.length === 0) {
        throw new Error('Folder not found');
      }

      // Insert association
      const result = await client.query(
        `INSERT INTO plugin_file_manager.file_folders (file_id, folder_id, added_by, position)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (file_id, folder_id) DO UPDATE SET position = $4
         RETURNING *`,
        [fileId, folderId, userId, position || null]
      );

      this.logger.info(`Added file ${fileId} to folder ${folderId}`);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Remove file from folder
   */
  async removeFileFromFolder(fileId: string, folderId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `DELETE FROM plugin_file_manager.file_folders WHERE file_id = $1 AND folder_id = $2`,
        [fileId, folderId]
      );

      this.logger.info(`Removed file ${fileId} from folder ${folderId}`);
    } finally {
      client.release();
    }
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

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }

  /**
   * Build folder tree from flat list
   */
  private buildFolderTree(folders: any[]): FolderWithChildren[] {
    const folderMap = new Map<string, FolderWithChildren>();
    const rootFolders: FolderWithChildren[] = [];

    // First pass: create map
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Second pass: build tree
    folders.forEach(folder => {
      const folderNode = folderMap.get(folder.id)!;
      if (folder.parent_id) {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children!.push(folderNode);
        }
      } else {
        rootFolders.push(folderNode);
      }
    });

    return rootFolders;
  }
}
