/**
 * Taxonomy API Routes
 * Provides RESTful API for category and tag management
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import Joi from 'joi';
import type { PluginLogger } from '@monorepo/shared';
import { TaxonomyService } from '../services/TaxonomyService';

export function createTaxonomyRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();
  const taxonomyService = new TaxonomyService(pool, logger);

  /**
   * List categories
   * GET /api/taxonomy/categories
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/categories', async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, parent_id, search, page, page_size, sort, direction } = req.query;

      const result = await taxonomyService.listCategories({
        namespace: namespace ? String(namespace) : undefined,
        parent_id: parent_id === 'null' ? null : (parent_id ? String(parent_id) : undefined),
        search: search ? String(search) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        page_size: page_size ? parseInt(String(page_size), 10) : undefined,
        sort: sort as 'name' | 'created_at' | 'display_order' | undefined,
        direction: direction as 'ASC' | 'DESC' | undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to list categories', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to list categories'
      });
    }
  });

  /**
   * Get category tree for namespace
   * GET /api/taxonomy/categories/tree/:namespace
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/categories/tree/:namespace', async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace } = req.params;
      const tree = await taxonomyService.getCategoryTree(namespace);

      res.json({
        success: true,
        data: tree
      });
    } catch (error) {
      logger.error('Failed to get category tree', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category tree'
      });
    }
  });

  /**
   * Get single category
   * GET /api/taxonomy/categories/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/categories/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const category = await taxonomyService.getCategory(id);

      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found'
        });
        return;
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Failed to get category', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category'
      });
    }
  });

  /**
   * Create category
   * POST /api/taxonomy/categories
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/categories', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const schema = Joi.object({
        namespace: Joi.string().required().max(100),
        name: Joi.string().required().max(255),
        slug: Joi.string().optional().max(255),
        description: Joi.string().optional().allow(''),
        parent_id: Joi.string().uuid().optional().allow(null),
        display_order: Joi.number().integer().min(0).optional(),
        metadata: Joi.object().optional()
      });

      const { error, value } = schema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const category = await taxonomyService.createCategory(value, userId);

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Failed to create category', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create category'
      });
    }
  });

  /**
   * Update category
   * PUT /api/taxonomy/categories/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/categories/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { id } = req.params;

      const schema = Joi.object({
        name: Joi.string().optional().max(255),
        slug: Joi.string().optional().max(255),
        description: Joi.string().optional().allow(''),
        parent_id: Joi.string().uuid().optional().allow(null),
        display_order: Joi.number().integer().min(0).optional(),
        metadata: Joi.object().optional()
      });

      const { error, value } = schema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const category = await taxonomyService.updateCategory(id, value, userId);

      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found'
        });
        return;
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Failed to update category', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update category'
      });
    }
  });

  /**
   * Delete category
   * DELETE /api/taxonomy/categories/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/categories/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required'
        });
        return;
      }

      const { id } = req.params;
      const deleted = await taxonomyService.deleteCategory(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Category not found'
        });
        return;
      }

      res.json({
        success: true
      });
    } catch (error) {
      logger.error('Failed to delete category', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete category'
      });
    }
  });

  /**
   * List tags
   * GET /api/taxonomy/tags
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/tags', async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, search, page, page_size } = req.query;

      const result = await taxonomyService.listTags({
        namespace: namespace ? String(namespace) : undefined,
        search: search ? String(search) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        page_size: page_size ? parseInt(String(page_size), 10) : undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to list tags', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to list tags'
      });
    }
  });

  /**
   * Get single tag
   * GET /api/taxonomy/tags/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/tags/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tag = await taxonomyService.getTag(id);

      if (!tag) {
        res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
        return;
      }

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      logger.error('Failed to get tag', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tag'
      });
    }
  });

  /**
   * Create tag
   * POST /api/taxonomy/tags
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/tags', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const schema = Joi.object({
        namespace: Joi.string().required().max(100),
        name: Joi.string().required().max(100),
        slug: Joi.string().optional().max(100),
        metadata: Joi.object().optional()
      });

      const { error, value } = schema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const tag = await taxonomyService.createTag(value, userId);

      res.status(201).json({
        success: true,
        data: tag
      });
    } catch (error) {
      logger.error('Failed to create tag', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create tag'
      });
    }
  });

  /**
   * Update tag
   * PUT /api/taxonomy/tags/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/tags/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { id } = req.params;

      const schema = Joi.object({
        name: Joi.string().optional().max(100),
        slug: Joi.string().optional().max(100),
        metadata: Joi.object().optional()
      });

      const { error, value } = schema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const tag = await taxonomyService.updateTag(id, value);

      if (!tag) {
        res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
        return;
      }

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      logger.error('Failed to update tag', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update tag'
      });
    }
  });

  /**
   * Delete tag
   * DELETE /api/taxonomy/tags/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/tags/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required'
        });
        return;
      }

      const { id } = req.params;
      const deleted = await taxonomyService.deleteTag(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
        return;
      }

      res.json({
        success: true
      });
    } catch (error) {
      logger.error('Failed to delete tag', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete tag'
      });
    }
  });

  /**
   * Get entity categories
   * GET /api/taxonomy/relationships/:namespace/:entityId/categories
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/relationships/:namespace/:entityId/categories', async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, entityId } = req.params;
      const categories = await taxonomyService.getEntityCategories(namespace, entityId);

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Failed to get entity categories', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get entity categories'
      });
    }
  });

  /**
   * Attach categories to entity
   * POST /api/taxonomy/relationships/:namespace/:entityId/categories
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/relationships/:namespace/:entityId/categories', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { namespace, entityId } = req.params;
      const { category_ids } = req.body;

      if (!Array.isArray(category_ids)) {
        res.status(400).json({
          success: false,
          error: 'category_ids must be an array'
        });
        return;
      }

      await taxonomyService.attachCategories(namespace, entityId, category_ids);

      res.json({
        success: true
      });
    } catch (error) {
      logger.error('Failed to attach categories', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to attach categories'
      });
    }
  });

  /**
   * Get entity tags
   * GET /api/taxonomy/relationships/:namespace/:entityId/tags
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/relationships/:namespace/:entityId/tags', async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, entityId } = req.params;
      const tags = await taxonomyService.getEntityTags(namespace, entityId);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      logger.error('Failed to get entity tags', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get entity tags'
      });
    }
  });

  /**
   * Attach tags to entity
   * POST /api/taxonomy/relationships/:namespace/:entityId/tags
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/relationships/:namespace/:entityId/tags', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { namespace, entityId } = req.params;
      const { tag_ids } = req.body;

      if (!Array.isArray(tag_ids)) {
        res.status(400).json({
          success: false,
          error: 'tag_ids must be an array'
        });
        return;
      }

      await taxonomyService.attachTags(namespace, entityId, tag_ids);

      res.json({
        success: true
      });
    } catch (error) {
      logger.error('Failed to attach tags', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to attach tags'
      });
    }
  });

  return router;
}
