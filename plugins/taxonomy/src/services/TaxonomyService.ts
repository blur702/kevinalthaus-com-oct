/**
 * Shared Taxonomy Service
 * Provides category and tag management for all plugins
 */

import { Pool } from 'pg';
import slugify from 'slugify';
import type { PluginLogger } from '@monorepo/shared';
import type {
  Category,
  Tag,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTagInput,
  UpdateTagInput,
  CategoryTree,
  TaxonomyQueryOptions
} from '../types';

export class TaxonomyService {
  private pool: Pool;
  private logger: PluginLogger;

  constructor(pool: Pool, logger: PluginLogger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return slugify(name, { lower: true, strict: true });
  }

  /**
   * Create a new category
   */
  async createCategory(input: CreateCategoryInput, userId: string): Promise<Category> {
    const slug = input.slug || this.generateSlug(input.name);

    const result = await this.pool.query<Category>(
      `INSERT INTO plugin_taxonomy.categories (
        namespace, name, slug, description, parent_id, display_order, metadata, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *`,
      [
        input.namespace,
        input.name,
        slug,
        input.description || null,
        input.parent_id || null,
        input.display_order || 0,
        JSON.stringify(input.metadata || {}),
        userId
      ]
    );

    this.logger.info(`Category created: ${result.rows[0].id} in namespace ${input.namespace}`);
    return result.rows[0];
  }

  /**
   * Get category by ID
   */
  async getCategory(id: string): Promise<Category | null> {
    const result = await this.pool.query<Category>(
      'SELECT * FROM plugin_taxonomy.categories WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * List categories with optional filtering
   */
  async listCategories(options: TaxonomyQueryOptions = {}): Promise<{
    data: Category[];
    pagination: {
      page: number;
      page_size: number;
      total_count: number;
      total_pages: number;
    };
  }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.page_size || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.namespace) {
      conditions.push(`namespace = $${paramIndex++}`);
      params.push(options.namespace);
    }

    if (options.parent_id !== undefined) {
      if (options.parent_id === null) {
        conditions.push('parent_id IS NULL');
      } else {
        conditions.push(`parent_id = $${paramIndex++}`);
        params.push(options.parent_id);
      }
    }

    if (options.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM plugin_taxonomy.categories ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get data with sorting
    const sortColumn = options.sort || 'created_at';
    const sortDirection = options.direction || 'DESC';

    const allowedSortColumns: Record<string, string> = {
      'name': 'name',
      'created_at': 'created_at',
      'display_order': 'display_order'
    };

    const orderBy = allowedSortColumns[sortColumn] || 'created_at';

    // Validate and normalize sort direction to prevent SQL injection
    const normalizedDirection = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataResult = await this.pool.query<Category>(
      `SELECT * FROM plugin_taxonomy.categories
       ${whereClause}
       ORDER BY ${orderBy} ${normalizedDirection}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset]
    );

    return {
      data: dataResult.rows,
      pagination: {
        page,
        page_size: pageSize,
        total_count: totalCount,
        total_pages: Math.ceil(totalCount / pageSize)
      }
    };
  }

  /**
   * Build category tree from flat list
   */
  buildCategoryTree(categories: Category[], parentId: string | null = null): CategoryTree[] {
    const children = categories.filter(cat => cat.parent_id === parentId);

    return children
      .sort((a, b) => a.display_order - b.display_order)
      .map(cat => ({
        ...cat,
        children: this.buildCategoryTree(categories, cat.id)
      }));
  }

  /**
   * Get category tree for a namespace
   */
  async getCategoryTree(namespace: string): Promise<CategoryTree[]> {
    const result = await this.pool.query<Category>(
      'SELECT * FROM plugin_taxonomy.categories WHERE namespace = $1 ORDER BY display_order ASC',
      [namespace]
    );

    return this.buildCategoryTree(result.rows);
  }

  /**
   * Update category
   */
  async updateCategory(id: string, input: UpdateCategoryInput, userId: string): Promise<Category | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }

    if (input.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(input.slug);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description || null);
    }

    if (input.parent_id !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`);
      params.push(input.parent_id || null);
    }

    if (input.display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      params.push(input.display_order);
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0) {
      return this.getCategory(id);
    }

    updates.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    params.push(id);

    const result = await this.pool.query<Category>(
      `UPDATE plugin_taxonomy.categories
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length > 0) {
      this.logger.info(`Category updated: ${id}`);
    }

    return result.rows[0] || null;
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM plugin_taxonomy.categories WHERE id = $1',
      [id]
    );

    const deleted = result.rowCount !== null && result.rowCount > 0;
    if (deleted) {
      this.logger.info(`Category deleted: ${id}`);
    }

    return deleted;
  }

  /**
   * Create a new tag
   */
  async createTag(input: CreateTagInput, userId: string): Promise<Tag> {
    const slug = input.slug || this.generateSlug(input.name);

    const result = await this.pool.query<Tag>(
      `INSERT INTO plugin_taxonomy.tags (
        namespace, name, slug, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        input.namespace,
        input.name,
        slug,
        JSON.stringify(input.metadata || {}),
        userId
      ]
    );

    this.logger.info(`Tag created: ${result.rows[0].id} in namespace ${input.namespace}`);
    return result.rows[0];
  }

  /**
   * Get tag by ID
   */
  async getTag(id: string): Promise<Tag | null> {
    const result = await this.pool.query<Tag>(
      'SELECT * FROM plugin_taxonomy.tags WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * List tags with optional filtering
   */
  async listTags(options: TaxonomyQueryOptions = {}): Promise<{
    data: Tag[];
    pagination: {
      page: number;
      page_size: number;
      total_count: number;
      total_pages: number;
    };
  }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.page_size || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.namespace) {
      conditions.push(`namespace = $${paramIndex++}`);
      params.push(options.namespace);
    }

    if (options.search) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM plugin_taxonomy.tags ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get data with sorting
    const sortColumn = options.sort || 'name';
    const sortDirection = options.direction || 'ASC';

    const allowedSortColumns: Record<string, string> = {
      'name': 'name',
      'created_at': 'created_at'
    };

    const orderBy = allowedSortColumns[sortColumn] || 'name';

    // Validate and normalize sort direction to prevent SQL injection
    const normalizedDirection = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataResult = await this.pool.query<Tag>(
      `SELECT * FROM plugin_taxonomy.tags
       ${whereClause}
       ORDER BY ${orderBy} ${normalizedDirection}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset]
    );

    return {
      data: dataResult.rows,
      pagination: {
        page,
        page_size: pageSize,
        total_count: totalCount,
        total_pages: Math.ceil(totalCount / pageSize)
      }
    };
  }

  /**
   * Update tag
   */
  async updateTag(id: string, input: UpdateTagInput): Promise<Tag | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }

    if (input.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(input.slug);
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0) {
      return this.getTag(id);
    }

    params.push(id);

    const result = await this.pool.query<Tag>(
      `UPDATE plugin_taxonomy.tags
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length > 0) {
      this.logger.info(`Tag updated: ${id}`);
    }

    return result.rows[0] || null;
  }

  /**
   * Delete tag
   */
  async deleteTag(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM plugin_taxonomy.tags WHERE id = $1',
      [id]
    );

    const deleted = result.rowCount !== null && result.rowCount > 0;
    if (deleted) {
      this.logger.info(`Tag deleted: ${id}`);
    }

    return deleted;
  }

  /**
   * Attach categories to an entity
   */
  async attachCategories(namespace: string, entityId: string, categoryIds: string[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing relationships
      await client.query(
        'DELETE FROM plugin_taxonomy.entity_categories WHERE namespace = $1 AND entity_id = $2',
        [namespace, entityId]
      );

      // Insert new relationships
      if (categoryIds.length > 0) {
        const values = categoryIds.map((_catId, idx) =>
          `($1, $2, $${idx + 3})`
        ).join(', ');

        await client.query(
          `INSERT INTO plugin_taxonomy.entity_categories (namespace, entity_id, category_id)
           VALUES ${values}`,
          [namespace, entityId, ...categoryIds]
        );

        this.logger.info(`Categories attached to ${namespace}:${entityId}`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to attach categories', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get categories for an entity
   */
  async getEntityCategories(namespace: string, entityId: string): Promise<Category[]> {
    const result = await this.pool.query<Category>(
      `SELECT c.* FROM plugin_taxonomy.categories c
       INNER JOIN plugin_taxonomy.entity_categories ec ON c.id = ec.category_id
       WHERE ec.namespace = $1 AND ec.entity_id = $2
       ORDER BY c.display_order ASC`,
      [namespace, entityId]
    );

    return result.rows;
  }

  /**
   * Attach tags to an entity
   */
  async attachTags(namespace: string, entityId: string, tagIds: string[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing relationships
      await client.query(
        'DELETE FROM plugin_taxonomy.entity_tags WHERE namespace = $1 AND entity_id = $2',
        [namespace, entityId]
      );

      // Insert new relationships
      if (tagIds.length > 0) {
        const values = tagIds.map((_tagId, idx) =>
          `($1, $2, $${idx + 3})`
        ).join(', ');

        await client.query(
          `INSERT INTO plugin_taxonomy.entity_tags (namespace, entity_id, tag_id)
           VALUES ${values}`,
          [namespace, entityId, ...tagIds]
        );

        this.logger.info(`Tags attached to ${namespace}:${entityId}`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to attach tags', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get tags for an entity
   */
  async getEntityTags(namespace: string, entityId: string): Promise<Tag[]> {
    const result = await this.pool.query<Tag>(
      `SELECT t.* FROM plugin_taxonomy.tags t
       INNER JOIN plugin_taxonomy.entity_tags et ON t.id = et.tag_id
       WHERE et.namespace = $1 AND et.entity_id = $2
       ORDER BY t.name ASC`,
      [namespace, entityId]
    );

    return result.rows;
  }
}
