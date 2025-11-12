/**
 * File Types Configuration Routes
 * TODO: Complete implementation
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';

export function createFileTypesRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT * FROM plugin_content_manager.allowed_file_types ORDER BY category, mime_type`
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Failed to list file types', error as Error);
      res.status(500).json({ success: false, error: 'Failed to list file types' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const { mime_type, file_extension, category, description, max_file_size, is_enabled = true } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO plugin_content_manager.allowed_file_types
         (mime_type, file_extension, category, description, max_file_size, is_enabled, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [mime_type, file_extension, category, description || null, max_file_size || null, is_enabled, userId]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Failed to add file type', error as Error);
      res.status(500).json({ success: false, error: 'Failed to add file type' });
    }
  });

  // PUT/PATCH /:id - Update file type
  const updateFileTypeHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { mime_type, file_extension, category, description, max_file_size, is_enabled } = req.body;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      // Build dynamic UPDATE query based on provided fields
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (mime_type !== undefined) {
        updates.push(`mime_type = $${paramIndex++}`);
        values.push(mime_type);
      }
      if (file_extension !== undefined) {
        updates.push(`file_extension = $${paramIndex++}`);
        values.push(file_extension);
      }
      if (category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(category);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (max_file_size !== undefined) {
        updates.push(`max_file_size = $${paramIndex++}`);
        values.push(max_file_size);
      }
      if (is_enabled !== undefined) {
        updates.push(`is_enabled = $${paramIndex++}`);
        values.push(is_enabled);
      }

      if (updates.length === 0) {
        res.status(400).json({ success: false, error: 'No fields to update' });
        return;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE plugin_content_manager.allowed_file_types
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'File type not found' });
        return;
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Failed to update file type', error as Error);
      res.status(500).json({ success: false, error: 'Failed to update file type' });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/:id', updateFileTypeHandler);

  // PATCH /:id - Partial update (alias for PUT for flexibility)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.patch('/:id', updateFileTypeHandler);

  // DELETE /:id - Delete file type
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      const result = await pool.query(
        `DELETE FROM plugin_content_manager.allowed_file_types WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'File type not found' });
        return;
      }

      res.json({ success: true, message: 'File type deleted successfully', data: result.rows[0] });
    } catch (error) {
      logger.error('Failed to delete file type', error as Error);
      res.status(500).json({ success: false, error: 'Failed to delete file type' });
    }
  });

  return router;
}
