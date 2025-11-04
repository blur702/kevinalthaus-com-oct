/**
 * Blog Routes - Service-Based Example
 *
 * This demonstrates the minimal-boilerplate approach using the service layer
 * and decorators for authentication and authorization.
 *
 * Compare this to the traditional approach in blog.ts to see the difference.
 */

import { Router, Request, Response } from 'express';
import type { IAuthService, IDatabaseService } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { getServiceContainer } from '@monorepo/shared';
import slugify from 'slugify';

/**
 * Blog Route Handler Class
 *
 * This class demonstrates using services instead of direct database/middleware access.
 * The key benefits:
 * - No manual auth middleware - use authService.middleware()
 * - No manual role checks - use authService.requireRole()
 * - Clean database access via Knex query builder
 * - Type-safe service access
 */
export class BlogRouteHandler {
  private router: Router;
  private authService: IAuthService;
  private dbService: IDatabaseService;

  constructor() {
    this.router = Router();

    // Get services from container
    const container = getServiceContainer();
    this.authService = container.get<IAuthService>('auth');
    this.dbService = container.get<IDatabaseService>('database');

    // Register routes
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // Public routes - no auth required
    this.router.get('/public', this.getPublicPosts.bind(this));
    this.router.get('/:id', this.getPost.bind(this));

    // Protected routes - auth required
    this.router.post(
      '/',
      this.authService.middleware(),  // Just 1 line for auth!
      this.createPost.bind(this)
    );

    this.router.put(
      '/:id',
      this.authService.middleware(),  // Auth check
      this.updatePost.bind(this)
    );

    this.router.delete(
      '/:id',
      this.authService.middleware(),  // Auth check
      this.deletePost.bind(this)
    );

    // Admin-only routes
    this.router.post(
      '/:id/publish',
      this.authService.requireRole(Role.ADMIN),  // Role check in 1 line!
      this.publishPost.bind(this)
    );
  }

  /**
   * Get public blog posts
   * No auth required
   */
  private async getPublicPosts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(String(req.query.page), 10) || 1;
      const limit = parseInt(String(req.query.limit), 10) || 10;
      const offset = (page - 1) * limit;

      // Use database service with Knex query builder
      const knex = this.dbService.getKnex('plugin_blog');

      const posts = await knex('blog_posts')
        .select('*')
        .where({ status: 'published', deleted_at: null })
        .orderBy('published_at', 'desc')
        .limit(limit)
        .offset(offset);

      const [{ total }] = await knex('blog_posts')
        .count('* as total')
        .where({ status: 'published', deleted_at: null });

      res.json({
        posts,
        total: Number(total),
        page,
        limit,
        total_pages: Math.ceil(Number(total) / limit),
      });
    } catch (error) {
      console.error('Error listing public blog posts', error);
      res.status(500).json({ error: 'Failed to list blog posts' });
    }
  }

  /**
   * Get single blog post
   * No auth required
   */
  private async getPost(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const knex = this.dbService.getKnex('plugin_blog');
      const post = await knex('blog_posts')
        .select('*')
        .where({ id, deleted_at: null })
        .first();

      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      res.json(post);
    } catch (error) {
      console.error('Error getting blog post', error);
      res.status(500).json({ error: 'Failed to get blog post' });
    }
  }

  /**
   * Create blog post
   * Auth required (handled by middleware in registerRoutes)
   */
  private async createPost(req: Request, res: Response): Promise<void> {
    try {
      // Get current user from auth service
      const user = await this.authService.getCurrentUser(req);
      if (!user) {
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

      // Use Knex query builder
      const knex = this.dbService.getKnex('plugin_blog');

      // Check if slug already exists
      const existing = await knex('blog_posts')
        .select('id')
        .where({ slug, deleted_at: null })
        .first();

      if (existing) {
        res.status(409).json({ error: 'Slug already exists' });
        return;
      }

      // Create post
      const [post] = await knex('blog_posts')
        .insert({
          title,
          slug,
          body_html,
          excerpt,
          meta_description,
          meta_keywords,
          author_id: user.id,
          reading_time_minutes,
          allow_comments,
          featured_image_id,
          status,
          publish_at,
          created_by: user.id,
        })
        .returning('*');

      console.log(`Blog post created: ${post.id}`);
      res.status(201).json(post);
    } catch (error) {
      console.error('Error creating blog post', error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  }

  /**
   * Update blog post
   * Auth required + ownership check
   */
  private async updatePost(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.authService.getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const knex = this.dbService.getKnex('plugin_blog');

      // Get existing post
      const existingPost = await knex('blog_posts')
        .select('author_id')
        .where({ id, deleted_at: null })
        .first();

      if (!existingPost) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Check authorization: user must be the author or an admin
      const isAdmin = this.authService.hasRole(user, Role.ADMIN);
      const isAuthor = existingPost.author_id === user.id;

      if (!isAdmin && !isAuthor) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Update post
      const updateData: Record<string, unknown> = {
        ...req.body,
        updated_by: user.id,
      };
      delete updateData.id;
      delete updateData.created_at;
      delete updateData.deleted_at;

      const [updatedPost] = await knex('blog_posts')
        .where({ id })
        .update(updateData)
        .returning('*');

      console.log(`Blog post updated: ${id}`);
      res.json(updatedPost);
    } catch (error) {
      console.error('Error updating blog post', error);
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  }

  /**
   * Delete blog post (soft delete)
   * Auth required + ownership check
   */
  private async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.authService.getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const knex = this.dbService.getKnex('plugin_blog');

      // Get existing post
      const existingPost = await knex('blog_posts')
        .select('author_id')
        .where({ id, deleted_at: null })
        .first();

      if (!existingPost) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Check authorization: user must be the author or an admin
      const isAdmin = this.authService.hasRole(user, Role.ADMIN);
      const isAuthor = existingPost.author_id === user.id;

      if (!isAdmin && !isAuthor) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Soft delete
      await knex('blog_posts')
        .where({ id })
        .update({
          deleted_at: knex.fn.now(),
          deleted_by: user.id,
        });

      console.log(`Blog post deleted: ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting blog post', error);
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  }

  /**
   * Publish blog post
   * Admin-only (handled by requireRole middleware in registerRoutes)
   */
  private async publishPost(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.authService.getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const knex = this.dbService.getKnex('plugin_blog');

      // Get existing post
      const existingPost = await knex('blog_posts')
        .select('status', 'title', 'body_html')
        .where({ id, deleted_at: null })
        .first();

      if (!existingPost) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      // Verify required fields
      if (!existingPost.title || !existingPost.body_html) {
        res.status(400).json({ error: 'Title and body are required to publish' });
        return;
      }

      // Check if already published
      if (existingPost.status === 'published') {
        res.status(409).json({ error: 'Blog post is already published' });
        return;
      }

      // Publish
      const [publishedPost] = await knex('blog_posts')
        .where({ id })
        .update({
          status: 'published',
          published_at: knex.fn.now(),
          updated_by: user.id,
        })
        .returning('*');

      console.log(`Blog post published: ${id}`);
      res.json(publishedPost);
    } catch (error) {
      console.error('Error publishing blog post', error);
      res.status(500).json({ error: 'Failed to publish blog post' });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}

/**
 * Factory function to create blog router with services
 */
export function createServiceBlogRouter(): Router {
  const handler = new BlogRouteHandler();
  return handler.getRouter();
}
