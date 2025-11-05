/**
 * Base Service Pattern
 *
 * Provides thin service layer that delegates to repositories.
 * Services should be 2-3 line implementations focusing on business logic only.
 *
 * Architecture:
 * - BaseService: Common CRUD operations (delegates to repository)
 * - Specific Services: Extend BaseService, add 2-3 lines of business logic
 * - Keep services lean and focused
 */

import type { IRepository, QueryOptions } from './interfaces';

/**
 * Base Service - handles common CRUD operations
 * All services should extend this and keep implementations minimal
 */
export abstract class BaseService<T extends Record<string, unknown>> {
  constructor(protected repository: IRepository<T>) {}

  /**
   * Find all records with optional filters
   * Services should override only if adding business logic
   */
  async findAll(filters?: Partial<T>, options?: QueryOptions): Promise<T[]> {
    return this.repository.findAll(filters, options);
  }

  /**
   * Find single record by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.repository.findById(id);
  }

  /**
   * Find single record by filters
   */
  async findOne(filters: Partial<T>): Promise<T | null> {
    return this.repository.findOne(filters);
  }

  /**
   * Create new record
   * Override to add validation/business logic (2-3 lines max)
   */
  async create(data: Partial<T>): Promise<T> {
    return this.repository.create(data);
  }

  /**
   * Update existing record
   * Override to add validation/business logic (2-3 lines max)
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    return this.repository.update(id, data);
  }

  /**
   * Delete record
   * Override to add soft delete or business logic (2-3 lines max)
   */
  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /**
   * Count records with optional filters
   */
  async count(filters?: Partial<T>): Promise<number> {
    return this.repository.count(filters);
  }

  /**
   * Check if record exists
   */
  async exists(filters: Partial<T>): Promise<boolean> {
    const record = await this.repository.findOne(filters);
    return record !== null;
  }
}

/**
 * Example: How to extend BaseService
 *
 * class BlogService extends BaseService<BlogPost> {
 *   // Add only business logic - keep it to 2-3 lines
 *   async publish(id: string, userId: string): Promise<BlogPost> {
 *     return this.repository.update(id, { status: 'published', published_by: userId, published_at: new Date() });
 *   }
 *
 *   async unpublish(id: string): Promise<BlogPost> {
 *     return this.repository.update(id, { status: 'draft', published_at: null });
 *   }
 * }
 */
