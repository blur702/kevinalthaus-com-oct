/// <reference path="../types/express.d.ts" />

/**
 * Content Management Routes
 * Handles CRUD operations for content with version history
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import slugify from 'slugify';
import Joi from 'joi';

// Import types from shared package
import type { PluginLogger } from '@monorepo/shared';

export function createContentRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();

  /**
   * Validation schemas
   */
  const createContentSchema = Joi.object({
    title: Joi.string().required().max(500),
    slug: Joi.string().optional().max(500).pattern(/^[a-z0-9-]+$/),
    body_html: Joi.string().required(),
    excerpt: Joi.string().optional().allow(''),
    meta_description: Joi.string().optional().max(160).allow(''),
    meta_keywords: Joi.string().optional().allow(''),
    featured_image_id: Joi.string().uuid().optional(),
    status: Joi.string().valid('draft', 'published', 'scheduled', 'archived').default('draft'),
    publish_at: Joi.date().iso().optional(),
    category_ids: Joi.array().items(Joi.string().uuid()).optional(),
    tag_ids: Joi.array().items(Joi.string().uuid()).optional()
  });

  const updateContentSchema = Joi.object({
    title: Joi.string().optional().max(500),
    slug: Joi.string().optional().max(500).pattern(/^[a-z0-9-]+$/),
    body_html: Joi.string().optional(),
    excerpt: Joi.string().optional().allow(''),
    meta_description: Joi.string().optional().max(160).allow(''),
    meta_keywords: Joi.string().optional().allow(''),
    featured_image_id: Joi.string().uuid().optional().allow(null),
    status: Joi.string().valid('draft', 'published', 'scheduled', 'archived').optional(),
    publish_at: Joi.date().iso().optional().allow(null),
    change_summary: Joi.string().optional().max(500),
    category_ids: Joi.array().items(Joi.string().uuid()).optional(),
    tag_ids: Joi.array().items(Joi.string().uuid()).optional()
  });

  /**
   * List content with filtering and pagination
   * GET /api/content
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        status,
        category_id,
        tag_id,
        search,
        created_by,
        from_date,
        to_date,
        page = '1',
        page_size = '20',
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(String(page_size), 10)));
      const offset = (pageNum - 1) * pageSizeNum;

      // Build WHERE conditions
      const conditions: string[] = ['c.deleted_at IS NULL'];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`c.status = $${paramIndex++}`);
        params.push(status);
      }

      if (created_by) {
        conditions.push(`c.created_by = $${paramIndex++}`);
        params.push(created_by);
      }

      if (from_date) {
        conditions.push(`c.created_at >= $${paramIndex++}`);
        params.push(from_date);
      }

      if (to_date) {
        conditions.push(`c.created_at <= $${paramIndex++}`);
        params.push(to_date);
      }

      if (search) {
        conditions.push(`(c.title ILIKE $${paramIndex} OR c.body_html ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (category_id) {
        conditions.push(`EXISTS (
          SELECT 1 FROM plugin_content_manager.content_categories cc
          WHERE cc.content_id = c.id AND cc.category_id = $${paramIndex++}
        )`);
        params.push(category_id);
      }

      if (tag_id) {
        conditions.push(`EXISTS (
          SELECT 1 FROM plugin_content_manager.content_tags ct
          WHERE ct.content_id = c.id AND ct.tag_id = $${paramIndex++}
        )`);
        params.push(tag_id);
      }

      const whereClause = conditions.join(' AND ');

      // Validate sort_by to prevent SQL injection
      const allowedSortColumns = ['created_at', 'updated_at', 'published_at', 'title'];
      const sortColumn = allowedSortColumns.includes(String(sort_by)) ? sort_by : 'created_at';
      const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

      // Get total count
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM plugin_content_manager.content c WHERE ${whereClause}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

      // Get paginated results
      const dataResult = await pool.query(
        `
        SELECT
          c.*,
          u.email as created_by_email,
          (
            SELECT json_agg(cat.*)
            FROM plugin_content_manager.categories cat
            INNER JOIN plugin_content_manager.content_categories cc ON cat.id = cc.category_id
            WHERE cc.content_id = c.id
          ) as categories,
          (
            SELECT json_agg(t.*)
            FROM plugin_content_manager.tags t
            INNER JOIN plugin_content_manager.content_tags ct ON t.id = ct.tag_id
            WHERE ct.content_id = c.id
          ) as tags
        FROM plugin_content_manager.content c
        LEFT JOIN public.users u ON c.created_by = u.id
        WHERE ${whereClause}
        ORDER BY c.${sortColumn} ${sortDirection}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `,
        [...params, pageSizeNum, offset]
      );

      res.json({
        success: true,
        data: {
          data: dataResult.rows,
          pagination: {
            page: pageNum,
            page_size: pageSizeNum,
            total_count: totalCount,
            total_pages: Math.ceil(totalCount / pageSizeNum)
          }
        }
      });
    } catch (error) {
      logger.error('Failed to list content', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to list content'
      });
    }
  });

  /**
   * Get single content item
   * GET /api/content/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT
          c.*,
          u.email as created_by_email,
          m.* as featured_image,
          (
            SELECT json_agg(cat.*)
            FROM plugin_content_manager.categories cat
            INNER JOIN plugin_content_manager.content_categories cc ON cat.id = cc.category_id
            WHERE cc.content_id = c.id
          ) as categories,
          (
            SELECT json_agg(t.*)
            FROM plugin_content_manager.tags t
            INNER JOIN plugin_content_manager.content_tags ct ON t.id = ct.tag_id
            WHERE ct.content_id = c.id
          ) as tags
        FROM plugin_content_manager.content c
        LEFT JOIN public.users u ON c.created_by = u.id
        LEFT JOIN plugin_content_manager.media m ON c.featured_image_id = m.id
        WHERE c.id = $1 AND c.deleted_at IS NULL
        `,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Failed to get content', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get content'
      });
    }
  });

  /**
   * Create new content
   * POST /api/content
   * Requires: Editor role
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const { error, value } = createContentSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      // Check user permission (Editor or Admin)
      const userRole = req.user?.role;
      if (userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({
          success: false,
          error: 'Editor role required to create content'
        });
        return;
      }

      // Generate slug if not provided
      let slug = value.slug;
      if (!slug) {
        slug = slugify(value.title, { lower: true, strict: true });

        // Ensure uniqueness with bounded attempts
        const maxAttempts = 100;
        let counter = 1;
        let uniqueSlug = slug;
        let attempts = 0;

        while (attempts < maxAttempts) {
          const existingResult = await pool.query(
            'SELECT id FROM plugin_content_manager.content WHERE slug = $1 AND deleted_at IS NULL',
            [uniqueSlug]
          );
          if (existingResult.rows.length === 0) {
            slug = uniqueSlug;
            break;
          }
          uniqueSlug = `${slug}-${counter++}`;
          attempts++;
        }

        if (attempts >= maxAttempts) {
          res.status(409).json({
            success: false,
            error: 'Could not generate unique slug after 100 attempts'
          });
          return;
        }
      }

      // Validate scheduled publish date
      if (value.status === 'scheduled' && !value.publish_at) {
        res.status(400).json({
          success: false,
          error: 'publish_at is required when status is scheduled'
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      // Insert content
      const result = await pool.query(
        `
        INSERT INTO plugin_content_manager.content (
          title, slug, body_html, excerpt, meta_description, meta_keywords,
          featured_image_id, status, publish_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          value.title,
          slug,
          value.body_html,
          value.excerpt || null,
          value.meta_description || null,
          value.meta_keywords || null,
          value.featured_image_id || null,
          value.status,
          value.publish_at || null,
          userId
        ]
      );

      const contentId = result.rows[0].id;

      // Add categories
      if (value.category_ids && value.category_ids.length > 0) {
        for (const categoryId of value.category_ids) {
          await pool.query(
            'INSERT INTO plugin_content_manager.content_categories (content_id, category_id) VALUES ($1, $2)',
            [contentId, categoryId]
          );
        }
      }

      // Add tags
      if (value.tag_ids && value.tag_ids.length > 0) {
        for (const tagId of value.tag_ids) {
          await pool.query(
            'INSERT INTO plugin_content_manager.content_tags (content_id, tag_id) VALUES ($1, $2)',
            [contentId, tagId]
          );
        }
      }

      // Set published_at if status is published
      if (value.status === 'published') {
        await pool.query(
          'UPDATE plugin_content_manager.content SET published_at = CURRENT_TIMESTAMP WHERE id = $1',
          [contentId]
        );
      }

      logger.info(`Content created: ${value.title} (${contentId}) by ${userId}`);

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Failed to create content', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create content'
      });
    }
  });

  /**
   * Update content
   * PUT /api/content/:id
   * Requires: Editor for drafts, Admin for published content
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Validate request body
      const { error, value } = updateContentSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      // Get existing content
      const existingResult = await pool.query(
        'SELECT * FROM plugin_content_manager.content WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (existingResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }

      const existingContent = existingResult.rows[0];

      // Check permissions
      if (existingContent.status === 'published' && userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required to update published content'
        });
        return;
      }

      // Build update query dynamically
      const updates: string[] = ['updated_by = $1', 'updated_at = CURRENT_TIMESTAMP'];
      const params: unknown[] = [userId];
      let paramIndex = 2;

      if (value.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        params.push(value.title);
      }

      if (value.slug !== undefined) {
        updates.push(`slug = $${paramIndex++}`);
        params.push(value.slug);
      }

      if (value.body_html !== undefined) {
        updates.push(`body_html = $${paramIndex++}`);
        params.push(value.body_html);
      }

      if (value.excerpt !== undefined) {
        updates.push(`excerpt = $${paramIndex++}`);
        params.push(value.excerpt || null);
      }

      if (value.meta_description !== undefined) {
        updates.push(`meta_description = $${paramIndex++}`);
        params.push(value.meta_description || null);
      }

      if (value.meta_keywords !== undefined) {
        updates.push(`meta_keywords = $${paramIndex++}`);
        params.push(value.meta_keywords || null);
      }

      if (value.featured_image_id !== undefined) {
        updates.push(`featured_image_id = $${paramIndex++}`);
        params.push(value.featured_image_id || null);
      }

      if (value.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        params.push(value.status);

        // Set published_at if changing to published
        if (value.status === 'published' && existingContent.status !== 'published') {
          updates.push('published_at = CURRENT_TIMESTAMP');
        }
      }

      if (value.publish_at !== undefined) {
        updates.push(`publish_at = $${paramIndex++}`);
        params.push(value.publish_at || null);
      }

      // Execute update with transaction for categories/tags
      const client = await pool.connect();
      let result;

      try {
        await client.query('BEGIN');

        // Update main content
        params.push(id);
        result = await client.query(
          `UPDATE plugin_content_manager.content SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          params
        );

        // Update categories if provided
        if (value.category_ids !== undefined) {
          await client.query('DELETE FROM plugin_content_manager.content_categories WHERE content_id = $1', [id]);
          for (const categoryId of value.category_ids) {
            await client.query(
              'INSERT INTO plugin_content_manager.content_categories (content_id, category_id) VALUES ($1, $2)',
              [id, categoryId]
            );
          }
        }

        // Update tags if provided
        if (value.tag_ids !== undefined) {
          await client.query('DELETE FROM plugin_content_manager.content_tags WHERE content_id = $1', [id]);
          for (const tagId of value.tag_ids) {
            await client.query(
              'INSERT INTO plugin_content_manager.content_tags (content_id, tag_id) VALUES ($1, $2)',
              [id, tagId]
            );
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      logger.info(`Content updated: ${id} by ${userId}`);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Failed to update content', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update content'
      });
    }
  });

  /**
   * Delete content (soft delete)
   * DELETE /api/content/:id
   * Requires: Admin role
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required to delete content'
        });
        return;
      }

      const result = await pool.query(
        `UPDATE plugin_content_manager.content
         SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }

      logger.info(`Content deleted: ${id} by ${userId}`);

      res.json({
        success: true
      });
    } catch (error) {
      logger.error('Failed to delete content', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete content'
      });
    }
  });

  /**
   * Publish content
   * POST /api/content/:id/publish
   * Requires: Admin role
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/publish', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { publish_at } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required to publish content'
        });
        return;
      }

      const status = publish_at ? 'scheduled' : 'published';
      const publishedAt = publish_at ? null : 'CURRENT_TIMESTAMP';

      const result = await pool.query(
        `UPDATE plugin_content_manager.content
         SET status = $1, publish_at = $2, published_at = COALESCE(published_at, ${publishedAt}), updated_by = $3
         WHERE id = $4 AND deleted_at IS NULL
         RETURNING *`,
        [status, publish_at || null, userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }

      logger.info(`Content published: ${id} by ${userId}`);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Failed to publish content', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to publish content'
      });
    }
  });

  /**
   * Unpublish content (revert to draft)
   * POST /api/content/:id/unpublish
   * Requires: Admin role
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/unpublish', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required to unpublish content'
        });
        return;
      }

      const result = await pool.query(
        `UPDATE plugin_content_manager.content
         SET status = 'draft', publish_at = NULL, updated_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }

      logger.info(`Content unpublished: ${id} by ${userId}`);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Failed to unpublish content', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to unpublish content'
      });
    }
  });

  /**
   * Get version history for content
   * GET /api/content/:id/versions
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id/versions', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT
          v.*,
          u.email as created_by_email
        FROM plugin_content_manager.content_versions v
        LEFT JOIN public.users u ON v.created_by = u.id
        WHERE v.content_id = $1
        ORDER BY v.version_number DESC
        `,
        [id]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Failed to get version history', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get version history'
      });
    }
  });

  /**
   * Restore content to a previous version
   * POST /api/content/:id/restore/:version
   * Requires: Admin role
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/restore/:version', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, version } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required to restore versions'
        });
        return;
      }

      // Get the version
      const versionResult = await pool.query(
        'SELECT * FROM plugin_content_manager.content_versions WHERE content_id = $1 AND version_number = $2',
        [id, version]
      );

      if (versionResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Version not found'
        });
        return;
      }

      const versionData = versionResult.rows[0];

      // Restore content to this version
      const result = await pool.query(
        `UPDATE plugin_content_manager.content
         SET title = $1, slug = $2, body_html = $3, excerpt = $4,
             meta_description = $5, meta_keywords = $6, updated_by = $7
         WHERE id = $8 AND deleted_at IS NULL
         RETURNING *`,
        [
          versionData.title,
          versionData.slug,
          versionData.body_html,
          versionData.excerpt,
          versionData.meta_description,
          versionData.meta_keywords,
          userId,
          id
        ]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }

      logger.info(`Content restored to version ${version}: ${id} by ${userId}`);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Failed to restore version', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to restore version'
      });
    }
  });

  return router;
}
