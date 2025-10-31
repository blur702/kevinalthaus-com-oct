/**
 * Taxonomy Routes (Categories and Tags)
 * TODO: Complete implementation
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import slugify from 'slugify';

export function createTaxonomyRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();

  // Categories routes
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/categories', async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT * FROM plugin_content_manager.categories ORDER BY parent_id NULLS FIRST, display_order, name`
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Failed to list categories', error as Error);
      res.status(500).json({ success: false, error: 'Failed to list categories' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/categories', async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, slug: inputSlug, description, parent_id, display_order = 0 } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({ success: false, error: 'Category name is required and must be a non-empty string' });
        return;
      }

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      if (typeof display_order !== 'number') {
        res.status(400).json({ success: false, error: 'Display order must be a number' });
        return;
      }

      const slug = inputSlug || slugify(name, { lower: true, strict: true });

      const result = await pool.query(
        `INSERT INTO plugin_content_manager.categories (name, slug, description, parent_id, display_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, slug, description || null, parent_id || null, display_order, userId]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Failed to create category', error as Error);
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  });

  // Tags routes
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/tags', async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT * FROM plugin_content_manager.tags ORDER BY name`
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Failed to list tags', error as Error);
      res.status(500).json({ success: false, error: 'Failed to list tags' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/tags', async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, slug: inputSlug } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({ success: false, error: 'Editor role required' });
        return;
      }

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({ success: false, error: 'Tag name is required and must be a non-empty string' });
        return;
      }

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const slug = inputSlug || slugify(name, { lower: true, strict: true });

      const result = await pool.query(
        `INSERT INTO plugin_content_manager.tags (name, slug, created_by)
         VALUES ($1, $2, $3) RETURNING *`,
        [name, slug, userId]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Failed to create tag', error as Error);
      res.status(500).json({ success: false, error: 'Failed to create tag' });
    }
  });

  // TODO: Implement UPDATE and DELETE operations for categories and tags

  return router;
}
