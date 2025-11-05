/**
 * Blog Routes
 * CRUD operations for blog posts using BlogService
 */

import { Router, Request, Response } from 'express';
import type { PluginLogger } from '@monorepo/shared';
import type { IBlogService } from '@monorepo/shared';
import { getUserId } from '@monorepo/shared';
import { authMiddleware } from '../auth';

// Use global Request type which already includes user
type AuthRequest = Request;

export function createBlogRouter(blogService: IBlogService, logger: PluginLogger): Router {
  const router = Router();

  // Apply authentication middleware to all non-public routes
  // Public routes are explicitly defined below without auth

  // List blog posts
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page), 10) || 1;
      const limit = parseInt(String(req.query.limit), 10) || 10;
      const status = req.query.status as string | undefined;
      const authorId = req.query.author_id as string | undefined;

      const result = await blogService.listPosts({ page, limit, status, authorId });

      res.json(result);
    } catch (error) {
      logger.error('Error listing blog posts', error as Error);
      res.status(500).json({ error: 'Failed to list blog posts' });
    }
  });

  // List blog posts by specific user
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/by-user/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const page = parseInt(String(req.query.page), 10) || 1;
      const limit = parseInt(String(req.query.limit), 10) || 10;
      const status = req.query.status as string | undefined;

      const result = await blogService.listPosts({ page, limit, status, authorId: userId });

      res.json(result);
    } catch (error) {
      logger.error('Error listing user blog posts', error as Error);
      res.status(500).json({ error: 'Failed to list user blog posts' });
    }
  });

  // Public endpoints
  // Get published blog posts
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/public', async (req: Request, res: Response): Promise<void> => {
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
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
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
  router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
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
  router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
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

      // Get existing post to verify authorization
      const existingPost = await blogService.getPostById(id);

      if (!existingPost) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify authorization: user must be the author or an admin
      if (existingPost.author_id !== userId && userRole !== 'admin') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Validate status if provided
      if (status !== undefined) {
        const validStatuses = ['draft', 'published', 'scheduled'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({ error: 'Invalid status value' });
          return;
        }
      }

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
  router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
      const userRole = (req as AuthRequest).user?.role;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Get existing post to verify authorization
      const existingPost = await blogService.getPostById(id);

      if (!existingPost) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify authorization: user must be the author or an admin
      if (existingPost.author_id !== userId && userRole !== 'admin') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

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
  router.post('/:id/publish', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
      const userRole = (req as AuthRequest).user?.role;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Get existing post to verify authorization and state
      const existingPost = await blogService.getPostById(id);

      if (!existingPost) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify authorization: user must be the author, editor, or admin
      if (existingPost.author_id !== userId && userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Verify required fields are present
      if (!existingPost.title || !existingPost.body_html) {
        res.status(400).json({ error: 'Title and body are required to publish' });
        return;
      }

      // Check if already published (idempotency)
      if (existingPost.status === 'published') {
        res.status(409).json({ error: 'Blog post is already published' });
        return;
      }

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
  router.post('/:id/unpublish', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId((req as AuthRequest).user);
      const userRole = (req as AuthRequest).user?.role;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Get existing post to verify authorization
      const existingPost = await blogService.getPostById(id);

      if (!existingPost) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify authorization: user must be the author, editor, or admin
      if (existingPost.author_id !== userId && userRole !== 'admin' && userRole !== 'editor') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

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
