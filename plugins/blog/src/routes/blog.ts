/// <reference path="../types/express.d.ts" />

/**
 * Blog Routes
 * CRUD operations for blog posts using BlogService
 */

import { Router } from 'express';
import type { PluginLogger } from '@monorepo/shared';
import type { IBlogService } from '@monorepo/shared';

export function createBlogRouter(blogService: IBlogService, logger: PluginLogger): Router {
  const router = Router();

  // List blog posts
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req, res): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page), 10) || 1;
      const limit = parseInt(String(req.query.limit), 10) || 10;
      const status = req.query.status as string | undefined;

      const result = await blogService.listPosts({ page, limit, status });

      res.json(result);
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

      const result = await blogService.listPublishedPosts({ page, limit });

      res.json(result);
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

      const post = await blogService.getPostById(id);

      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      res.json(post);
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

      if (!title || !body_html) {
        res.status(400).json({ error: 'Title and body are required' });
        return;
      }

      try {
        const post = await blogService.createPost(
          {
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
          },
          userId
        );

        logger.info(`Blog post created: ${post.id}`);
        res.status(201).json(post);
      } catch (error) {
        if (error instanceof Error && error.message === 'Slug already exists') {
          res.status(409).json({ error: 'Slug already exists' });
          return;
        }
        throw error;
      }
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

      const post = await blogService.updatePost(
        id,
        {
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
        },
        userId
      );

      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      logger.info(`Blog post updated: ${id}`);
      res.json(post);
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

      const success = await blogService.deletePost(id, userId);

      if (!success) {
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

      const post = await blogService.publishPost(id, userId);

      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      logger.info(`Blog post published: ${id}`);
      res.json(post);
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

      const post = await blogService.unpublishPost(id, userId);

      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      logger.info(`Blog post unpublished: ${id}`);
      res.json(post);
    } catch (error) {
      logger.error('Error unpublishing blog post', error as Error);
      res.status(500).json({ error: 'Failed to unpublish blog post' });
    }
  });

  return router;
}
