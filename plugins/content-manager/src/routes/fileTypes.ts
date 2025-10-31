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

  // TODO: Implement UPDATE and DELETE operations

  return router;
}
