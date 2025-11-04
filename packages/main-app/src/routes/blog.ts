/**
 * Blog Routes
 * CRUD operations for blog posts
 */

import { Router, Request } from 'express';
import type { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import { getUserId } from '@monorepo/shared';
import slugify from 'slugify';
import { authMiddleware } from '../auth';

// Use global Request type which already includes user
type AuthRequest = Request;

export function createBlogRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();

  // Apply authentication middleware to all non-public routes
  // Public routes are explicitly defined below without auth

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
  router.post('/', authMiddleware, async (req, res): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
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
  router.put('/:id', authMiddleware, async (req, res): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
      const userRole = (req as AuthRequest).user?.role;
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

      // Check if the post exists and get its author
      const existingPost = await pool.query(
        `SELECT author_id FROM plugin_blog.blog_posts
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (existingPost.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify authorization: user must be the author or an admin
      const authorId = existingPost.rows[0].author_id;
      if (authorId !== userId && userRole !== 'admin') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Check for slug uniqueness if slug is being updated
      if (slug !== undefined) {
        const slugCheck = await pool.query(
          `SELECT id FROM plugin_blog.blog_posts
           WHERE slug = $1 AND id != $2 AND deleted_at IS NULL`,
          [slug, id]
        );
        if (slugCheck.rows.length > 0) {
          res.status(409).json({ error: 'Slug already exists' });
          return;
        }
      }

      // Validate status if provided
      if (status !== undefined) {
        const validStatuses = ['draft', 'published', 'scheduled'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({ error: 'Invalid status value' });
          return;
        }
      }

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
  router.delete('/:id', authMiddleware, async (req, res): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
      const userRole = (req as AuthRequest).user?.role;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Check if the post exists and get its author
      const existingPost = await pool.query(
        `SELECT author_id FROM plugin_blog.blog_posts
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (existingPost.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify authorization: user must be the author or an admin
      const authorId = existingPost.rows[0].author_id;
      if (authorId !== userId && userRole !== 'admin') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      await pool.query(
        `UPDATE plugin_blog.blog_posts
         SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [userId, id]
      );

      logger.info(`Blog post deleted: ${id}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting blog post', error as Error);
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  });

  // Publish blog post
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/publish', authMiddleware, async (req, res): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
      const userRole = (req as AuthRequest).user?.role;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Get existing post to verify authorization, state, and required fields
      const existingPost = await pool.query(
        `SELECT author_id, status, title, body_html FROM plugin_blog.blog_posts
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (existingPost.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      const post = existingPost.rows[0];

      // Verify authorization: user must be the author, editor, or admin
      if (post.author_id !== userId && userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Verify required fields are present
      if (!post.title || !post.body_html) {
        res.status(400).json({ error: 'Title and body are required to publish' });
        return;
      }

      // Check if already published (idempotency)
      if (post.status === 'published') {
        res.status(409).json({ error: 'Blog post is already published' });
        return;
      }

      const result = await pool.query(
        `UPDATE plugin_blog.blog_posts
         SET status = 'published',
             published_at = CURRENT_TIMESTAMP,
             updated_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, id]
      );

      logger.info(`Blog post published: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error publishing blog post', error as Error);
      res.status(500).json({ error: 'Failed to publish blog post' });
    }
  });

  // Unpublish blog post
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/unpublish', authMiddleware, async (req, res): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
      const userRole = (req as AuthRequest).user?.role;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Get existing post to verify authorization
      const existingPost = await pool.query(
        `SELECT author_id FROM plugin_blog.blog_posts
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (existingPost.rows.length === 0) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify authorization: user must be the author, editor, or admin
      const authorId = existingPost.rows[0].author_id;
      if (authorId !== userId && userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const result = await pool.query(
        `UPDATE plugin_blog.blog_posts
         SET status = 'draft',
             updated_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, id]
      );

      logger.info(`Blog post unpublished: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error unpublishing blog post', error as Error);
      res.status(500).json({ error: 'Failed to unpublish blog post' });
    }
  });

  return router;
}
