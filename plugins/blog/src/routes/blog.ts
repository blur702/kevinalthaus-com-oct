/// <reference path="../types/express.d.ts" />

/**
 * Blog Routes
 * CRUD operations for blog posts
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import slugify from 'slugify';

export function createBlogRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();

  // List blog posts
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req, res): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page), 10) || 1;
      const limit = parseInt(String(req.query.limit), 10) || 10;
      const offset = (page - 1) * limit;
      const status = req.query.status as string | undefined;

      let query = `
        SELECT bp.*,
               u.email as author_email,
               ap.display_name as author_display_name
        FROM plugin_blog.blog_posts bp
        LEFT JOIN public.users u ON bp.author_id = u.id
        LEFT JOIN plugin_blog.author_profiles ap ON bp.author_id = ap.user_id
        WHERE bp.deleted_at IS NULL
      `;
      const params: (string | number)[] = [];

      if (status) {
        params.push(status);
        query += ` AND bp.status = $${params.length}`;
      }

      query += ` ORDER BY bp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM plugin_blog.blog_posts
        WHERE deleted_at IS NULL
        ${status ? `AND status = $1` : ''}
      `;
      const countResult = await pool.query(countQuery, status ? [status] : []);
      const total = parseInt(countResult.rows[0].total, 10);

      res.json({
        posts: result.rows,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      });
    } catch (error) {
      logger.error('Error listing blog posts', error as Error);
      res.status(500).json({ error: 'Failed to list blog posts' });
    }
  });

  // Public endpoints
  // Get published blog posts
  // IMPORTANT: This route must come before /:id to prevent /public being captured as an id parameter
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/public', async (req, res): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page), 10) || 1;
      const limit = parseInt(String(req.query.limit), 10) || 10;
      const offset = (page - 1) * limit;

      const result = await pool.query(
        `SELECT bp.*,
                u.email as author_email,
                ap.display_name as author_display_name,
                ap.avatar_url as author_avatar_url
         FROM plugin_blog.blog_posts bp
         LEFT JOIN public.users u ON bp.author_id = u.id
         LEFT JOIN plugin_blog.author_profiles ap ON bp.author_id = ap.user_id
         WHERE bp.status = 'published' AND bp.deleted_at IS NULL
         ORDER BY bp.published_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM plugin_blog.blog_posts
         WHERE status = 'published' AND deleted_at IS NULL`
      );
      const total = parseInt(countResult.rows[0].total, 10);

      res.json({
        posts: result.rows,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      });
    } catch (error) {
      logger.error('Error listing public blog posts', error as Error);
      res.status(500).json({ error: 'Failed to list blog posts' });
    }
  });

  // Get single blog post
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', async (req, res): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT bp.*,
                u.email as author_email,
                ap.display_name as author_display_name,
                ap.bio as author_bio,
                ap.avatar_url as author_avatar_url
         FROM plugin_blog.blog_posts bp
         LEFT JOIN public.users u ON bp.author_id = u.id
         LEFT JOIN plugin_blog.author_profiles ap ON bp.author_id = ap.user_id
         WHERE bp.id = $1 AND bp.deleted_at IS NULL`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error getting blog post', error as Error);
      res.status(500).json({ error: 'Failed to get blog post' });
    }
  });

  // Create blog post
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/', async (req, res): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        title,
        slug: providedSlug,
        body_html,
        excerpt,
        meta_description,
        meta_keywords,
        reading_time_minutes,
        allow_comments = true,
        featured_image_id,
        status = 'draft',
        publish_at,
      } = req.body;

      if (!title || !body_html) {
        res.status(400).json({ error: 'Title and body are required' });
        return;
      }

      // Generate slug if not provided
      const slug = providedSlug || slugify(title, { lower: true, strict: true });

      // Check if slug already exists
      const slugCheck = await pool.query(
        `SELECT id FROM plugin_blog.blog_posts WHERE slug = $1 AND deleted_at IS NULL`,
        [slug]
      );

      if (slugCheck.rows.length > 0) {
        res.status(409).json({ error: 'Slug already exists' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO plugin_blog.blog_posts (
          title, slug, body_html, excerpt, meta_description, meta_keywords,
          author_id, reading_time_minutes, allow_comments, featured_image_id,
          status, publish_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          title,
          slug,
          body_html,
          excerpt,
          meta_description,
          meta_keywords,
          userId,
          reading_time_minutes,
          allow_comments,
          featured_image_id,
          status,
          publish_at,
          userId,
        ]
      );

      logger.info(`Blog post created: ${result.rows[0].id}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Error creating blog post', error as Error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  });

  // Update blog post
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/:id', async (req, res): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const {
        title,
        slug,
        body_html,
        excerpt,
        meta_description,
        meta_keywords,
        reading_time_minutes,
        allow_comments,
        featured_image_id,
        status,
        publish_at,
      } = req.body;

      const updateFields: string[] = [];
      const values: unknown[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updateFields.push(`title = $${paramCount++}`);
        values.push(title);
      }
      if (slug !== undefined) {
        updateFields.push(`slug = $${paramCount++}`);
        values.push(slug);
      }
      if (body_html !== undefined) {
        updateFields.push(`body_html = $${paramCount++}`);
        values.push(body_html);
      }
      if (excerpt !== undefined) {
        updateFields.push(`excerpt = $${paramCount++}`);
        values.push(excerpt);
      }
      if (meta_description !== undefined) {
        updateFields.push(`meta_description = $${paramCount++}`);
        values.push(meta_description);
      }
      if (meta_keywords !== undefined) {
        updateFields.push(`meta_keywords = $${paramCount++}`);
        values.push(meta_keywords);
      }
      if (reading_time_minutes !== undefined) {
        updateFields.push(`reading_time_minutes = $${paramCount++}`);
        values.push(reading_time_minutes);
      }
      if (allow_comments !== undefined) {
        updateFields.push(`allow_comments = $${paramCount++}`);
        values.push(allow_comments);
      }
      if (featured_image_id !== undefined) {
        updateFields.push(`featured_image_id = $${paramCount++}`);
        values.push(featured_image_id);
      }
      if (status !== undefined) {
        updateFields.push(`status = $${paramCount++}`);
        values.push(status);
      }
      if (publish_at !== undefined) {
        updateFields.push(`publish_at = $${paramCount++}`);
        values.push(publish_at);
      }

      updateFields.push(`updated_by = $${paramCount++}`);
      values.push(userId);

      values.push(id);

      const query = `
        UPDATE plugin_blog.blog_posts
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      logger.info(`Blog post updated: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error updating blog post', error as Error);
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  });

  // Delete blog post (soft delete)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id', async (req, res): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      const result = await pool.query(
        `UPDATE plugin_blog.blog_posts
         SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      logger.info(`Blog post deleted: ${id}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting blog post', error as Error);
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  });

  // Publish blog post
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/publish', async (req, res): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      const result = await pool.query(
        `UPDATE plugin_blog.blog_posts
         SET status = 'published',
             published_at = CURRENT_TIMESTAMP,
             updated_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      logger.info(`Blog post published: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error publishing blog post', error as Error);
      res.status(500).json({ error: 'Failed to publish blog post' });
    }
  });

  // Unpublish blog post
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/unpublish', async (req, res): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      const result = await pool.query(
        `UPDATE plugin_blog.blog_posts
         SET status = 'draft',
             updated_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      logger.info(`Blog post unpublished: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error unpublishing blog post', error as Error);
      res.status(500).json({ error: 'Failed to unpublish blog post' });
    }
  });

  return router;
}
