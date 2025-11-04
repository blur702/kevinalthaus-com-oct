/**
 * Activity service - Business logic for activity tracking and audit logging
 */

import { Pool } from 'pg';
import {
  activityLogQueries,
  auditLogQueries,
  ActivityLogRow,
  AuditLogRow,
  PaginationParams,
} from '../db/queries';

// Simple logger interface for services
interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void;
}

export interface ActivityLogEntry {
  userId: string;
  activityType: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  relatedUserId?: string;
  sessionId?: string;
}

export interface AuditLogEntry {
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

export interface PaginatedActivityResult {
  data: ActivityLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedAuditResult {
  data: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ActivityService {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  /**
   * Log user activity
   */
  async logActivity(activity: ActivityLogEntry): Promise<ActivityLogRow> {
    try {
      const result = await activityLogQueries.logActivity(this.pool, activity);
      this.logger.info(`Logged activity: ${activity.activityType} for user ${activity.userId}`);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to log activity', error as Error);
      throw error;
    }
  }

  /**
   * Get activity log for a specific user
   */
  async getUserActivity(
    userId: string,
    page: number = 1,
    pageSize: number = 50,
    activityType?: string
  ): Promise<PaginatedActivityResult> {
    try {
      const offset = (page - 1) * pageSize;
      const pagination: PaginationParams = { limit: pageSize, offset };

      const [activityResult, total] = await Promise.all([
        activityLogQueries.getUserActivity(this.pool, userId, pagination, activityType),
        activityLogQueries.countUserActivity(this.pool, userId, activityType),
      ]);

      this.logger.info(`Retrieved ${activityResult.rows.length} activities for user ${userId}`);

      return {
        data: activityResult.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      this.logger.error(`Failed to get activity for user ${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get recent activity across all users
   */
  async getRecentActivity(
    page: number = 1,
    pageSize: number = 100,
    activityType?: string
  ): Promise<PaginatedActivityResult> {
    try {
      const offset = (page - 1) * pageSize;
      const pagination: PaginationParams = { limit: pageSize, offset };

      const activityResult = await activityLogQueries.getRecentActivity(
        this.pool,
        pagination,
        activityType
      );

      // For recent activity, we don't count total (expensive operation)
      // Client can paginate until no more results
      this.logger.info(`Retrieved ${activityResult.rows.length} recent activities`);

      return {
        data: activityResult.rows,
        total: activityResult.rows.length, // Approximate
        page,
        pageSize,
        totalPages: 1, // Unknown
      };
    } catch (error) {
      this.logger.error('Failed to get recent activity', error as Error);
      throw error;
    }
  }

  /**
   * Log user login activity
   */
  async logLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string
  ): Promise<ActivityLogRow> {
    return this.logActivity({
      userId,
      activityType: 'login',
      description: 'User logged in',
      ipAddress,
      userAgent,
      sessionId,
    });
  }

  /**
   * Log user logout activity
   */
  async logLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string
  ): Promise<ActivityLogRow> {
    return this.logActivity({
      userId,
      activityType: 'logout',
      description: 'User logged out',
      ipAddress,
      userAgent,
      sessionId,
    });
  }

  /**
   * Log profile update activity
   */
  async logProfileUpdate(
    userId: string,
    changedFields: string[],
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ActivityLogRow> {
    return this.logActivity({
      userId,
      activityType: 'profile_update',
      description: `Profile updated: ${changedFields.join(', ')}`,
      metadata: { changedFields, actorId },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log custom field update activity
   */
  async logCustomFieldUpdate(
    userId: string,
    updatedBy: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ActivityLogRow> {
    return this.logActivity({
      userId,
      activityType: 'custom_field_update',
      description: 'Custom fields updated',
      metadata: { updatedBy },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log bulk operation activity
   */
  async logBulkOperation(
    userId: string,
    operationType: 'import' | 'export',
    recordCount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ActivityLogRow> {
    return this.logActivity({
      userId,
      activityType: 'bulk_operation',
      description: `Bulk ${operationType}: ${recordCount} records`,
      metadata: { operationType, recordCount },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Create audit log entry
   */
  async createAuditEntry(audit: AuditLogEntry): Promise<AuditLogRow> {
    try {
      const result = await auditLogQueries.createAuditEntry(this.pool, audit);
      this.logger.info(`Created audit entry: ${audit.action} on ${audit.resourceType} by ${audit.actorId}`);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to create audit entry', error as Error);
      throw error;
    }
  }

  /**
   * Query audit log with filters
   */
  async queryAuditLog(
    filters: {
      actorId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedAuditResult> {
    try {
      const offset = (page - 1) * pageSize;
      const pagination: PaginationParams = { limit: pageSize, offset };

      const [auditResult, total] = await Promise.all([
        auditLogQueries.queryAuditLog(this.pool, filters, pagination),
        auditLogQueries.countAuditLog(this.pool, filters),
      ]);

      this.logger.info(`Retrieved ${auditResult.rows.length} audit entries`);

      return {
        data: auditResult.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      this.logger.error('Failed to query audit log', error as Error);
      throw error;
    }
  }

  /**
   * Audit user read operation
   */
  async auditUserRead(
    actorId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLogRow> {
    return this.createAuditEntry({
      actorId,
      action: 'read',
      resourceType: 'user',
      resourceId: userId,
      details: { operation: 'view_user_details' },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Audit user update operation
   */
  async auditUserUpdate(
    actorId: string,
    userId: string,
    changes: Record<string, unknown>,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLogRow> {
    return this.createAuditEntry({
      actorId,
      action: 'update',
      resourceType: 'user',
      resourceId: userId,
      details: { changes },
      reason,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Audit bulk import operation
   */
  async auditBulkImport(
    actorId: string,
    recordCount: number,
    successCount: number,
    failureCount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLogRow> {
    return this.createAuditEntry({
      actorId,
      action: 'bulk_import',
      resourceType: 'user',
      details: { recordCount, successCount, failureCount },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Audit bulk export operation
   */
  async auditBulkExport(
    actorId: string,
    recordCount: number,
    format: 'csv' | 'json',
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLogRow> {
    return this.createAuditEntry({
      actorId,
      action: 'bulk_export',
      resourceType: 'user',
      details: { recordCount, format },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Get activity statistics for a user
   */
  async getUserActivityStats(userId: string): Promise<Record<string, number>> {
    try {
      const result = await this.pool.query<{ activity_type: string; count: string }>(
        `SELECT activity_type, COUNT(*) as count
         FROM plugin_user_manager.user_activity_log
         WHERE user_id = $1
         GROUP BY activity_type`,
        [userId]
      );

      const stats: Record<string, number> = {};
      result.rows.forEach((row) => {
        stats[row.activity_type] = parseInt(row.count, 10);
      });

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get activity stats for user ${userId}`, error as Error);
      throw error;
    }
  }
}
