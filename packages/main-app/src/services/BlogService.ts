/**
 * Blog Service Implementation
 *
 * Provides data layer for blog post operations. This service handles all
 * database interactions for blog posts, following the service layer pattern
 * where services collect and store data, and plugins process/present it.
 *
 * Features:
 * - CRUD operations for blog posts
 * - Pagination support
 * - Status filtering (draft, published, scheduled)
 * - Slug uniqueness validation
 * - Soft delete support
 * - Author information enrichment
 */

import type {
  IBlogService,
  BlogPost,
  BlogPostList,
  CreateBlogPostData,
  UpdateBlogPostData,
} from '@monorepo/shared';
import { Pool } from 'pg';
import slugify from 'slugify';

/**
 * Blog Service
 * Manages blog posts in the database
 */
export class BlogService implements IBlogService {
  public readonly name = 'blog';
  private pool: Pool;
  private initialized = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('BlogService is already initialized');
    }

    // Verify blog schema exists
    const schemaCheck = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'plugin_blog'`
    );

    if (schemaCheck.rows.length === 0) {
      console.warn('[BlogService] ⚠ plugin_blog schema not found - blog plugin may not be installed');
    }

    this.initialized = true;
    console.log('[BlogService] ✓ Initialized');
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.initialized = false;
    console.log('[BlogService] ✓ Shut down');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return { healthy: false, message: 'Service not initialized' };
    }

    try {
      // Check if we can query the blog_posts table
      await this.pool.query('SELECT 1 FROM plugin_blog.blog_posts LIMIT 1');
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List all blog posts with pagination and optional filtering
   */
  async listPosts(options: {
    page?: number;
    limit?: number;
    status?: string;
    authorId?: string;
  }): Promise<BlogPostList> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const status = options.status;
    const authorId = options.authorId;

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

    if (authorId) {
      params.push(authorId);
      query += ` AND bp.author_id = $${params.length}`;
    }

    query += ` ORDER BY bp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.pool.query<BlogPost>(query, params);

    // Build count query with same filters
    let countQuery = `
      SELECT COUNT(*) as total
      FROM plugin_blog.blog_posts
      WHERE deleted_at IS NULL
    `;
    const countParams: (string | number)[] = [];

    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }

    if (authorId) {
      countParams.push(authorId);
      countQuery += ` AND author_id = $${countParams.length}`;
    }

    const countResult = await this.pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total as string, 10);

    return {
      posts: result.rows,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * List published blog posts (public endpoint)
   */
  async listPublishedPosts(options: {
    page?: number;
    limit?: number;
  }): Promise<BlogPostList> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const result = await this.pool.query<BlogPost>(
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

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total
       FROM plugin_blog.blog_posts
       WHERE status = 'published' AND deleted_at IS NULL`
    );
    const total = parseInt(countResult.rows[0].total as string, 10);

    return {
      posts: result.rows,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single blog post by ID
   */
  async getPostById(id: string): Promise<BlogPost | null> {
    const result = await this.pool.query<BlogPost>(
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

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Create a new blog post
   */
  async createPost(data: CreateBlogPostData, userId: string): Promise<BlogPost> {
    // Generate slug if not provided
    const slug = data.slug || slugify(data.title, { lower: true, strict: true });

    // Check if slug already exists
    const exists = await this.slugExists(slug);
    if (exists) {
      throw new Error('Slug already exists');
    }

    const result = await this.pool.query<BlogPost>(
      `INSERT INTO plugin_blog.blog_posts (
        title, slug, body_html, excerpt, meta_description, meta_keywords,
        author_id, reading_time_minutes, allow_comments, featured_image_id,
        status, publish_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.title,
        slug,
        data.body_html,
        data.excerpt,
        data.meta_description,
        data.meta_keywords,
        userId,
        data.reading_time_minutes,
        data.allow_comments ?? true,
        data.featured_image_id,
        data.status || 'draft',
        data.publish_at,
        userId,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update an existing blog post
   */
  async updatePost(
    id: string,
    data: UpdateBlogPostData,
    userId: string
  ): Promise<BlogPost | null> {
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(data.title);
    }
    if (data.slug !== undefined) {
      updateFields.push(`slug = $${paramCount++}`);
      values.push(data.slug);
    }
    if (data.body_html !== undefined) {
      updateFields.push(`body_html = $${paramCount++}`);
      values.push(data.body_html);
    }
    if (data.excerpt !== undefined) {
      updateFields.push(`excerpt = $${paramCount++}`);
      values.push(data.excerpt);
    }
    if (data.meta_description !== undefined) {
      updateFields.push(`meta_description = $${paramCount++}`);
      values.push(data.meta_description);
    }
    if (data.meta_keywords !== undefined) {
      updateFields.push(`meta_keywords = $${paramCount++}`);
      values.push(data.meta_keywords);
    }
    if (data.reading_time_minutes !== undefined) {
      updateFields.push(`reading_time_minutes = $${paramCount++}`);
      values.push(data.reading_time_minutes);
    }
    if (data.allow_comments !== undefined) {
      updateFields.push(`allow_comments = $${paramCount++}`);
      values.push(data.allow_comments);
    }
    if (data.featured_image_id !== undefined) {
      updateFields.push(`featured_image_id = $${paramCount++}`);
      values.push(data.featured_image_id);
    }
    if (data.status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.publish_at !== undefined) {
      updateFields.push(`publish_at = $${paramCount++}`);
      values.push(data.publish_at);
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

    const result = await this.pool.query<BlogPost>(query, values);

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Delete a blog post (soft delete)
   */
  async deletePost(id: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE plugin_blog.blog_posts
       SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [userId, id]
    );

    return result.rows.length > 0;
  }

  /**
   * Publish a blog post
   */
  async publishPost(id: string, userId: string): Promise<BlogPost | null> {
    const result = await this.pool.query<BlogPost>(
      `UPDATE plugin_blog.blog_posts
       SET status = 'published',
           published_at = CURRENT_TIMESTAMP,
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Unpublish a blog post
   */
  async unpublishPost(id: string, userId: string): Promise<BlogPost | null> {
    const result = await this.pool.query<BlogPost>(
      `UPDATE plugin_blog.blog_posts
       SET status = 'draft',
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    let query = `SELECT id FROM plugin_blog.blog_posts WHERE slug = $1 AND deleted_at IS NULL`;
    const params: (string | undefined)[] = [slug];

    if (excludeId) {
      query += ` AND id != $2`;
      params.push(excludeId);
    }

    const result = await this.pool.query(query, params);
    return result.rows.length > 0;
  }
}
