/**
 * Page Service
 * Database operations for pages, versions, templates, and reusable blocks
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';
import {
  Page,
  PageVersion,
  Template,
  ReusableBlock,
  PageLayout,
  PageStatus,
  validatePageLayout
} from '../types';

export interface CreatePageInput {
  title: string;
  slug: string;
  layout_json: PageLayout;
  meta_description?: string;
  meta_keywords?: string;
  status?: PageStatus;
  publish_at?: Date;
  created_by: string;
}

export interface UpdatePageInput {
  title?: string;
  slug?: string;
  layout_json?: PageLayout;
  meta_description?: string;
  meta_keywords?: string;
  status?: PageStatus;
  publish_at?: Date;
  updated_by: string;
}

export interface ListPagesOptions {
  status?: PageStatus;
  limit?: number;
  offset?: number;
  search?: string;
  created_by?: string;
}

export class PageService {
  constructor(private pool: Pool) {}

  /**
   * Create a new page
   */
  async createPage(input: CreatePageInput): Promise<Page> {
    const id = uuidv4();

    // Validate layout
    const validatedLayout = validatePageLayout(input.layout_json);

    // Sanitize inputs
    const sanitizedTitle = sanitizeHtml(input.title, { allowedTags: [] });
    const sanitizedMetaDesc = input.meta_description
      ? sanitizeHtml(input.meta_description, { allowedTags: [] })
      : null;

    const result = await this.pool.query(
      `INSERT INTO plugin_page_builder.pages
       (id, title, slug, layout_json, meta_description, meta_keywords, status, publish_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        sanitizedTitle,
        input.slug,
        JSON.stringify(validatedLayout),
        sanitizedMetaDesc,
        input.meta_keywords || null,
        input.status || 'draft',
        input.publish_at || null,
        input.created_by
      ]
    );

    return this.mapRowToPage(result.rows[0]);
  }

  /**
   * Get page by ID
   */
  async getPageById(id: string, includeDeleted = false): Promise<Page | null> {
    const query = includeDeleted
      ? 'SELECT * FROM plugin_page_builder.pages WHERE id = $1'
      : 'SELECT * FROM plugin_page_builder.pages WHERE id = $1 AND deleted_at IS NULL';

    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPage(result.rows[0]);
  }

  /**
   * Get page by slug
   */
  async getPageBySlug(slug: string): Promise<Page | null> {
    const result = await this.pool.query(
      'SELECT * FROM plugin_page_builder.pages WHERE slug = $1 AND deleted_at IS NULL',
      [slug]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPage(result.rows[0]);
  }

  /**
   * List pages with filtering and pagination
   */
  async listPages(options: ListPagesOptions = {}): Promise<{ pages: Page[]; total: number }> {
    const { status, limit = 20, offset = 0, search, created_by } = options;

    let whereConditions = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (created_by) {
      whereConditions.push(`created_by = $${paramIndex}`);
      params.push(created_by);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(
        `(title ILIKE $${paramIndex} OR slug ILIKE $${paramIndex} OR meta_description ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM plugin_page_builder.pages WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get pages
    const result = await this.pool.query(
      `SELECT * FROM plugin_page_builder.pages
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const pages = result.rows.map(row => this.mapRowToPage(row));

    return { pages, total };
  }

  /**
   * Update page
   */
  async updatePage(id: string, input: UpdatePageInput): Promise<Page | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(sanitizeHtml(input.title, { allowedTags: [] }));
      paramIndex++;
    }

    if (input.slug !== undefined) {
      updates.push(`slug = $${paramIndex}`);
      params.push(input.slug);
      paramIndex++;
    }

    if (input.layout_json !== undefined) {
      const validatedLayout = validatePageLayout(input.layout_json);
      updates.push(`layout_json = $${paramIndex}`);
      params.push(JSON.stringify(validatedLayout));
      paramIndex++;
    }

    if (input.meta_description !== undefined) {
      updates.push(`meta_description = $${paramIndex}`);
      params.push(input.meta_description ? sanitizeHtml(input.meta_description, { allowedTags: [] }) : null);
      paramIndex++;
    }

    if (input.meta_keywords !== undefined) {
      updates.push(`meta_keywords = $${paramIndex}`);
      params.push(input.meta_keywords || null);
      paramIndex++;
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;

      // Set published_at if transitioning to published
      if (input.status === 'published') {
        updates.push(`published_at = CURRENT_TIMESTAMP`);
      }
    }

    if (input.publish_at !== undefined) {
      updates.push(`publish_at = $${paramIndex}`);
      params.push(input.publish_at);
      paramIndex++;
    }

    updates.push(`updated_by = $${paramIndex}`);
    params.push(input.updated_by);
    paramIndex++;

    if (updates.length === 0) {
      return this.getPageById(id);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE plugin_page_builder.pages
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPage(result.rows[0]);
  }

  /**
   * Soft delete page
   */
  async deletePage(id: string, deleted_by: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE plugin_page_builder.pages
       SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [deleted_by, id]
    );

    return result.rows.length > 0;
  }

  /**
   * Get page versions
   */
  async getPageVersions(pageId: string): Promise<PageVersion[]> {
    const result = await this.pool.query(
      `SELECT * FROM plugin_page_builder.page_versions
       WHERE page_id = $1
       ORDER BY version_number DESC`,
      [pageId]
    );

    return result.rows.map(row => this.mapRowToPageVersion(row));
  }

  /**
   * Get specific page version
   */
  async getPageVersion(pageId: string, versionNumber: number): Promise<PageVersion | null> {
    const result = await this.pool.query(
      `SELECT * FROM plugin_page_builder.page_versions
       WHERE page_id = $1 AND version_number = $2`,
      [pageId, versionNumber]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPageVersion(result.rows[0]);
  }

  /**
   * Create template from page
   */
  async createTemplate(input: {
    name: string;
    description?: string;
    thumbnail_url?: string;
    layout_json: PageLayout;
    category?: string;
    is_public: boolean;
    created_by: string;
  }): Promise<Template> {
    const id = uuidv4();
    const validatedLayout = validatePageLayout(input.layout_json);

    const result = await this.pool.query(
      `INSERT INTO plugin_page_builder.templates
       (id, name, description, thumbnail_url, layout_json, category, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        sanitizeHtml(input.name, { allowedTags: [] }),
        input.description || null,
        input.thumbnail_url || null,
        JSON.stringify(validatedLayout),
        input.category || null,
        input.is_public,
        input.created_by
      ]
    );

    return this.mapRowToTemplate(result.rows[0]);
  }

  /**
   * List templates
   */
  async listTemplates(userId: string, category?: string): Promise<Template[]> {
    let query = `
      SELECT * FROM plugin_page_builder.templates
      WHERE deleted_at IS NULL
        AND (is_public = TRUE OR created_by = $1)
    `;
    const params: any[] = [userId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToTemplate(row));
  }

  /**
   * Create reusable block
   */
  async createReusableBlock(input: {
    name: string;
    description?: string;
    thumbnail_url?: string;
    block_json: any;
    category?: string;
    created_by: string;
  }): Promise<ReusableBlock> {
    const id = uuidv4();

    const result = await this.pool.query(
      `INSERT INTO plugin_page_builder.reusable_blocks
       (id, name, description, thumbnail_url, block_json, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        sanitizeHtml(input.name, { allowedTags: [] }),
        input.description || null,
        input.thumbnail_url || null,
        JSON.stringify(input.block_json),
        input.category || null,
        input.created_by
      ]
    );

    return this.mapRowToReusableBlock(result.rows[0]);
  }

  /**
   * List reusable blocks
   */
  async listReusableBlocks(userId: string, category?: string): Promise<ReusableBlock[]> {
    let query = `
      SELECT * FROM plugin_page_builder.reusable_blocks
      WHERE deleted_at IS NULL AND created_by = $1
    `;
    const params: any[] = [userId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToReusableBlock(row));
  }

  // Helper methods to map database rows to types
  private mapRowToPage(row: any): Page {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      layout_json: row.layout_json,
      meta_description: row.meta_description,
      meta_keywords: row.meta_keywords,
      status: row.status,
      publish_at: row.publish_at,
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by
    };
  }

  private mapRowToPageVersion(row: any): PageVersion {
    return {
      id: row.id,
      page_id: row.page_id,
      version_number: row.version_number,
      title: row.title,
      slug: row.slug,
      layout_json: row.layout_json,
      status: row.status,
      change_summary: row.change_summary,
      created_at: row.created_at,
      created_by: row.created_by
    };
  }

  private mapRowToTemplate(row: any): Template {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      thumbnail_url: row.thumbnail_url,
      layout_json: row.layout_json,
      category: row.category,
      is_public: row.is_public,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by
    };
  }

  private mapRowToReusableBlock(row: any): ReusableBlock {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      thumbnail_url: row.thumbnail_url,
      block_json: row.block_json,
      category: row.category,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by
    };
  }
}
