/**
 * Database queries for user-manager plugin
 * All queries use parameterized statements for SQL injection prevention
 * All queries are scoped to the plugin_user_manager schema
 */

import { Pool, QueryResult } from 'pg';

// Types for database results
export interface UserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface CustomFieldsRow {
  id: string;
  user_id: string;
  field_data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface ActivityLogRow {
  id: string;
  user_id: string;
  activity_type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  related_user_id: string | null;
  session_id: string | null;
}

export interface AuditLogRow {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  activity_log_id: string | null;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface UserFilterParams {
  role?: string;
  search?: string;
  sortBy?: 'email' | 'username' | 'created_at' | 'updated_at';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * User queries - extends core user management
 */
export const userQueries = {
  /**
   * List users with pagination and filtering
   * Queries the core users table, not plugin schema
   */
  async listUsers(
    pool: Pool,
    filters: UserFilterParams,
    pagination: PaginationParams
  ): Promise<QueryResult<UserRow>> {
    let query = `
      SELECT id, email, username, role, created_at, updated_at
      FROM public.users
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.role) {
      query += ` AND role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (email ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Validate and normalize sortBy against allowlist to prevent SQL injection
    const allowedSortColumns: Record<string, string> = {
      'email': 'email',
      'username': 'username',
      'created_at': 'created_at',
      'updated_at': 'updated_at'
    };
    const sortBy = filters.sortBy || 'created_at';
    const validatedSortBy = allowedSortColumns[sortBy] || 'created_at';

    // Validate and normalize sortOrder to prevent SQL injection
    const sortOrder = filters.sortOrder || 'DESC';
    const validatedSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${validatedSortBy} ${validatedSortOrder}`;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, pagination.offset);

    return pool.query<UserRow>(query, params);
  },

  /**
   * Get total count of users with filters
   */
  async countUsers(pool: Pool, filters: UserFilterParams): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM public.users WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.role) {
      query += ` AND role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (email ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
    }

    const result = await pool.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Get user by ID
   */
  async getUserById(pool: Pool, userId: string): Promise<QueryResult<UserRow>> {
    return pool.query<UserRow>(
      'SELECT id, email, username, role, created_at, updated_at FROM public.users WHERE id = $1',
      [userId]
    );
  },
};

/**
 * Custom fields queries
 */
export const customFieldsQueries = {
  /**
   * Get custom fields for a user
   */
  async getCustomFields(pool: Pool, userId: string): Promise<QueryResult<CustomFieldsRow>> {
    return pool.query<CustomFieldsRow>(
      `SELECT id, user_id, field_data, created_at, updated_at, created_by, updated_by
       FROM plugin_user_manager.user_custom_fields
       WHERE user_id = $1`,
      [userId]
    );
  },

  /**
   * Create custom fields for a user
   */
  async createCustomFields(
    pool: Pool,
    userId: string,
    fieldData: Record<string, unknown>,
    createdBy: string
  ): Promise<QueryResult<CustomFieldsRow>> {
    return pool.query<CustomFieldsRow>(
      `INSERT INTO plugin_user_manager.user_custom_fields
       (user_id, field_data, created_by, updated_by)
       VALUES ($1, $2, $3, $3)
       RETURNING *`,
      [userId, JSON.stringify(fieldData), createdBy]
    );
  },

  /**
   * Update custom fields for a user
   */
  async updateCustomFields(
    pool: Pool,
    userId: string,
    fieldData: Record<string, unknown>,
    updatedBy: string
  ): Promise<QueryResult<CustomFieldsRow>> {
    return pool.query<CustomFieldsRow>(
      `UPDATE plugin_user_manager.user_custom_fields
       SET field_data = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId, JSON.stringify(fieldData), updatedBy]
    );
  },

  /**
   * Upsert custom fields (insert or update)
   */
  async upsertCustomFields(
    pool: Pool,
    userId: string,
    fieldData: Record<string, unknown>,
    actorId: string
  ): Promise<QueryResult<CustomFieldsRow>> {
    return pool.query<CustomFieldsRow>(
      `INSERT INTO plugin_user_manager.user_custom_fields
       (user_id, field_data, created_by, updated_by)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET
         field_data = EXCLUDED.field_data,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, JSON.stringify(fieldData), actorId]
    );
  },

  /**
   * Delete custom fields for a user
   */
  async deleteCustomFields(pool: Pool, userId: string): Promise<QueryResult> {
    return pool.query(
      'DELETE FROM plugin_user_manager.user_custom_fields WHERE user_id = $1',
      [userId]
    );
  },
};

/**
 * Activity log queries
 */
export const activityLogQueries = {
  /**
   * Log user activity
   */
  async logActivity(
    pool: Pool,
    activity: {
      userId: string;
      activityType: string;
      description?: string;
      metadata?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
      relatedUserId?: string;
      sessionId?: string;
    }
  ): Promise<QueryResult<ActivityLogRow>> {
    return pool.query<ActivityLogRow>(
      `INSERT INTO plugin_user_manager.user_activity_log
       (user_id, activity_type, description, metadata, ip_address, user_agent, related_user_id, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        activity.userId,
        activity.activityType,
        activity.description || null,
        JSON.stringify(activity.metadata || {}),
        activity.ipAddress || null,
        activity.userAgent || null,
        activity.relatedUserId || null,
        activity.sessionId || null,
      ]
    );
  },

  /**
   * Get activity log for a user
   */
  async getUserActivity(
    pool: Pool,
    userId: string,
    pagination: PaginationParams,
    activityType?: string
  ): Promise<QueryResult<ActivityLogRow>> {
    let query = `
      SELECT id, user_id, activity_type, description, metadata, ip_address,
             user_agent, created_at, related_user_id, session_id
      FROM plugin_user_manager.user_activity_log
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (activityType) {
      query += ` AND activity_type = $${paramIndex}`;
      params.push(activityType);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, pagination.offset);

    return pool.query<ActivityLogRow>(query, params);
  },

  /**
   * Count activity for a user
   */
  async countUserActivity(pool: Pool, userId: string, activityType?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM plugin_user_manager.user_activity_log WHERE user_id = $1';
    const params: unknown[] = [userId];

    if (activityType) {
      query += ' AND activity_type = $2';
      params.push(activityType);
    }

    const result = await pool.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Get recent activity across all users
   */
  async getRecentActivity(
    pool: Pool,
    pagination: PaginationParams,
    activityType?: string
  ): Promise<QueryResult<ActivityLogRow>> {
    let query = `
      SELECT id, user_id, activity_type, description, metadata, ip_address,
             user_agent, created_at, related_user_id, session_id
      FROM plugin_user_manager.user_activity_log
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (activityType) {
      query += ` AND activity_type = $${paramIndex}`;
      params.push(activityType);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, pagination.offset);

    return pool.query<ActivityLogRow>(query, params);
  },
};

/**
 * Audit log queries
 */
export const auditLogQueries = {
  /**
   * Create audit log entry
   */
  async createAuditEntry(
    pool: Pool,
    audit: {
      actorId: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      details?: Record<string, unknown>;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      activityLogId?: string;
    }
  ): Promise<QueryResult<AuditLogRow>> {
    return pool.query<AuditLogRow>(
      `INSERT INTO plugin_user_manager.audit_log
       (actor_id, action, resource_type, resource_id, details, reason, ip_address, user_agent, activity_log_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        audit.actorId,
        audit.action,
        audit.resourceType,
        audit.resourceId || null,
        JSON.stringify(audit.details || {}),
        audit.reason || null,
        audit.ipAddress || null,
        audit.userAgent || null,
        audit.activityLogId || null,
      ]
    );
  },

  /**
   * Query audit log with filters
   */
  async queryAuditLog(
    pool: Pool,
    filters: {
      actorId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination: PaginationParams
  ): Promise<QueryResult<AuditLogRow>> {
    let query = `
      SELECT id, actor_id, action, resource_type, resource_id, details,
             reason, ip_address, user_agent, created_at, activity_log_id
      FROM plugin_user_manager.audit_log
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.actorId) {
      query += ` AND actor_id = $${paramIndex}`;
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.resourceType) {
      query += ` AND resource_type = $${paramIndex}`;
      params.push(filters.resourceType);
      paramIndex++;
    }

    if (filters.resourceId) {
      query += ` AND resource_id = $${paramIndex}`;
      params.push(filters.resourceId);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, pagination.offset);

    return pool.query<AuditLogRow>(query, params);
  },

  /**
   * Count audit log entries with filters
   */
  async countAuditLog(
    pool: Pool,
    filters: {
      actorId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM plugin_user_manager.audit_log WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.actorId) {
      query += ` AND actor_id = $${paramIndex}`;
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.resourceType) {
      query += ` AND resource_type = $${paramIndex}`;
      params.push(filters.resourceType);
      paramIndex++;
    }

    if (filters.resourceId) {
      query += ` AND resource_id = $${paramIndex}`;
      params.push(filters.resourceId);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
    }

    const result = await pool.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count, 10);
  },
};
