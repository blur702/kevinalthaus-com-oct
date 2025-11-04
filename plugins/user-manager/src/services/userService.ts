/**
 * User service - Business logic for user operations
 */

import { Pool } from 'pg';
import {
  userQueries,
  customFieldsQueries,
  UserRow,
  CustomFieldsRow,
  PaginationParams,
  UserFilterParams,
} from '../db/queries';

// Simple logger interface for services
interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void;
}

export interface UserWithCustomFields extends UserRow {
  customFields?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class UserService {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  /**
   * List users with pagination and filtering
   */
  async listUsers(
    filters: UserFilterParams,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<UserRow>> {
    try {
      const offset = (page - 1) * pageSize;
      const pagination: PaginationParams = { limit: pageSize, offset };

      const [usersResult, total] = await Promise.all([
        userQueries.listUsers(this.pool, filters, pagination),
        userQueries.countUsers(this.pool, filters),
      ]);

      this.logger.info(`Listed ${usersResult.rows.length} users (page ${page}/${Math.ceil(total / pageSize)})`);

      return {
        data: usersResult.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      this.logger.error('Failed to list users', error as Error);
      throw error;
    }
  }

  /**
   * Get user by ID with optional custom fields
   */
  async getUserById(userId: string, includeCustomFields: boolean = false): Promise<UserWithCustomFields | null> {
    try {
      const userResult = await userQueries.getUserById(this.pool, userId);

      if (userResult.rows.length === 0) {
        return null;
      }

      const user: UserWithCustomFields = userResult.rows[0];

      if (includeCustomFields) {
        const customFieldsResult = await customFieldsQueries.getCustomFields(this.pool, userId);
        if (customFieldsResult.rows.length > 0) {
          user.customFields = customFieldsResult.rows[0].field_data;
        }
      }

      this.logger.info(`Retrieved user ${userId}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get custom fields for a user
   */
  async getCustomFields(userId: string): Promise<Record<string, unknown>> {
    try {
      const result = await customFieldsQueries.getCustomFields(this.pool, userId);

      if (result.rows.length === 0) {
        return {};
      }

      return result.rows[0].field_data;
    } catch (error) {
      this.logger.error(`Failed to get custom fields for user ${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Update custom fields for a user
   */
  async updateCustomFields(
    userId: string,
    fieldData: Record<string, unknown>,
    actorId: string
  ): Promise<CustomFieldsRow> {
    try {
      // Validate that user exists
      const user = await this.getUserById(userId, false);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Upsert custom fields
      const result = await customFieldsQueries.upsertCustomFields(
        this.pool,
        userId,
        fieldData,
        actorId
      );

      this.logger.info(`Updated custom fields for user ${userId} by ${actorId}`);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to update custom fields for user ${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Merge custom fields (partial update)
   */
  async mergeCustomFields(
    userId: string,
    newFields: Record<string, unknown>,
    actorId: string
  ): Promise<CustomFieldsRow> {
    try {
      // Get existing fields
      const existingFields = await this.getCustomFields(userId);

      // Merge with new fields
      const mergedFields = { ...existingFields, ...newFields };

      // Update
      return this.updateCustomFields(userId, mergedFields, actorId);
    } catch (error) {
      this.logger.error(`Failed to merge custom fields for user ${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Delete custom fields for a user
   */
  async deleteCustomFields(userId: string): Promise<void> {
    try {
      await customFieldsQueries.deleteCustomFields(this.pool, userId);
      this.logger.info(`Deleted custom fields for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete custom fields for user ${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Bulk get users by IDs
   */
  async getUsersByIds(userIds: string[]): Promise<UserRow[]> {
    try {
      if (userIds.length === 0) {
        return [];
      }

      // Build parameterized query for multiple IDs
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
      const query = `
        SELECT id, email, username, role, created_at, updated_at
        FROM public.users
        WHERE id IN (${placeholders})
      `;

      const result = await this.pool.query<UserRow>(query, userIds);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get users by IDs', error as Error);
      throw error;
    }
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM public.users WHERE id = $1)',
        [userId]
      );
      return result.rows[0].exists;
    } catch (error) {
      this.logger.error(`Failed to check if user ${userId} exists`, error as Error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    usersByRole: Record<string, number>;
    usersWithCustomFields: number;
  }> {
    try {
      const [totalResult, roleResult, customFieldsResult] = await Promise.all([
        this.pool.query<{ count: string }>('SELECT COUNT(*) as count FROM public.users'),
        this.pool.query<{ role: string; count: string }>(
          'SELECT role, COUNT(*) as count FROM public.users GROUP BY role'
        ),
        this.pool.query<{ count: string }>(
          'SELECT COUNT(*) as count FROM plugin_user_manager.user_custom_fields'
        ),
      ]);

      const usersByRole: Record<string, number> = {};
      roleResult.rows.forEach((row) => {
        usersByRole[row.role] = parseInt(row.count, 10);
      });

      return {
        totalUsers: parseInt(totalResult.rows[0].count, 10),
        usersByRole,
        usersWithCustomFields: parseInt(customFieldsResult.rows[0].count, 10),
      };
    } catch (error) {
      this.logger.error('Failed to get user statistics', error as Error);
      throw error;
    }
  }
}
