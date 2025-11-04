/**
 * Taxonomy Routes (Categories and Tags)
 * Proxies to shared taxonomy service with content-manager namespace
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import { TaxonomyService } from '@monorepo/taxonomy';

const NAMESPACE = 'content-manager';

export function createTaxonomyRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();
  const taxonomyService = new TaxonomyService(pool, logger);

  // Categories routes
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/categories', async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, page, page_size } = req.query;

      const result = await taxonomyService.listCategories({
        namespace: NAMESPACE,
        search: search ? String(search) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        page_size: page_size ? parseInt(String(page_size), 10) : undefined,
        sort: 'display_order',
        direction: 'ASC'
      });

      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('Failed to list categories', error as Error);
      res.status(500).json({ success: false, error: 'Failed to list categories' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/categories/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const category = await taxonomyService.getCategory(id);

      if (!category) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      // Verify it belongs to content-manager namespace
      if (category.namespace !== NAMESPACE) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      res.json({ success: true, data: category });
    } catch (error) {
      logger.error('Failed to get category', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get category' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/categories', async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, slug, description, parent_id, display_order, metadata } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({ success: false, error: 'Category name is required and must be a non-empty string' });
        return;
      }

      const category = await taxonomyService.createCategory({
        namespace: NAMESPACE,
        name,
        slug,
        description,
        parent_id,
        display_order,
        metadata
      }, userId);

      res.status(201).json({ success: true, data: category });
    } catch (error) {
      logger.error('Failed to create category', error as Error);
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/categories/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, slug, description, parent_id, display_order, metadata } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // Verify category exists and belongs to content-manager
      const existing = await taxonomyService.getCategory(id);
      if (!existing || existing.namespace !== NAMESPACE) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      const category = await taxonomyService.updateCategory(id, {
        name,
        slug,
        description,
        parent_id,
        display_order,
        metadata
      }, userId);

      res.json({ success: true, data: category });
    } catch (error) {
      logger.error('Failed to update category', error as Error);
      res.status(500).json({ success: false, error: 'Failed to update category' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/categories/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      // Verify category exists and belongs to content-manager
      const existing = await taxonomyService.getCategory(id);
      if (!existing || existing.namespace !== NAMESPACE) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      await taxonomyService.deleteCategory(id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete category', error as Error);
      res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
  });

  // Tags routes
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/tags', async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, page, page_size } = req.query;

      const result = await taxonomyService.listTags({
        namespace: NAMESPACE,
        search: search ? String(search) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        page_size: page_size ? parseInt(String(page_size), 10) : undefined
      });

      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('Failed to list tags', error as Error);
      res.status(500).json({ success: false, error: 'Failed to list tags' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/tags/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tag = await taxonomyService.getTag(id);

      if (!tag) {
        res.status(404).json({ success: false, error: 'Tag not found' });
        return;
      }

      // Verify it belongs to content-manager namespace
      if (tag.namespace !== NAMESPACE) {
        res.status(404).json({ success: false, error: 'Tag not found' });
        return;
      }

      res.json({ success: true, data: tag });
    } catch (error) {
      logger.error('Failed to get tag', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get tag' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/tags', async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, slug, metadata } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({ success: false, error: 'Editor role required' });
        return;
      }

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({ success: false, error: 'Tag name is required and must be a non-empty string' });
        return;
      }

      const tag = await taxonomyService.createTag({
        namespace: NAMESPACE,
        name,
        slug,
        metadata
      }, userId);

      res.status(201).json({ success: true, data: tag });
    } catch (error) {
      logger.error('Failed to create tag', error as Error);
      res.status(500).json({ success: false, error: 'Failed to create tag' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/tags/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, slug, metadata } = req.body;
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({ success: false, error: 'Editor role required' });
        return;
      }

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // Verify tag exists and belongs to content-manager
      const existing = await taxonomyService.getTag(id);
      if (!existing || existing.namespace !== NAMESPACE) {
        res.status(404).json({ success: false, error: 'Tag not found' });
        return;
      }

      const tag = await taxonomyService.updateTag(id, {
        name,
        slug,
        metadata
      });

      res.json({ success: true, data: tag });
    } catch (error) {
      logger.error('Failed to update tag', error as Error);
      res.status(500).json({ success: false, error: 'Failed to update tag' });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/tags/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin role required' });
        return;
      }

      // Verify tag exists and belongs to content-manager
      const existing = await taxonomyService.getTag(id);
      if (!existing || existing.namespace !== NAMESPACE) {
        res.status(404).json({ success: false, error: 'Tag not found' });
        return;
      }

      await taxonomyService.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete tag', error as Error);
      res.status(500).json({ success: false, error: 'Failed to delete tag' });
    }
  });

  return router;
}
