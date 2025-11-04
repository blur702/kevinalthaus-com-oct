/**
 * Audit log routes - Query audit logs for administrative actions
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ActivityService } from '../services/activityService';

// Import Express type augmentation for req.user
import type {} from '@monorepo/shared';

// Simple logger interface for routes
interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void;
}

export function createAuditRouter(pool: Pool, logger: Logger): Router {
  const router = Router();
  const activityService = new ActivityService(pool, logger);

  /**
   * Query audit log with filters
   * GET /api/users-manager/audit
   * Required capability: database:read
   * Required role: admin (enforced by plugin engine middleware)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      // Extract query parameters
      const page = parseInt(String(req.query.page || '1'), 10);
      const pageSize = Math.min(parseInt(String(req.query.pageSize || '50'), 10), 200);

      const actorId = req.query.actorId as string | undefined;
      const action = req.query.action as string | undefined;
      const resourceType = req.query.resourceType as string | undefined;
      const resourceId = req.query.resourceId as string | undefined;

      // Date range filters
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (req.query.startDate) {
        startDate = new Date(String(req.query.startDate));
        if (isNaN(startDate.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid startDate format',
            message: 'startDate must be a valid ISO 8601 date string',
          });
          return;
        }
      }

      if (req.query.endDate) {
        endDate = new Date(String(req.query.endDate));
        if (isNaN(endDate.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid endDate format',
            message: 'endDate must be a valid ISO 8601 date string',
          });
          return;
        }
      }

      const result = await activityService.queryAuditLog(
        {
          actorId,
          action,
          resourceType,
          resourceId,
          startDate,
          endDate,
        },
        page,
        pageSize
      );

      // Log this audit query
      if (req.user?.id) {
        void activityService.logActivity({
          userId: req.user.id,
          activityType: 'api_access',
          description: 'Queried audit log',
          metadata: {
            filters: { actorId, action, resourceType, resourceId, startDate, endDate },
            page,
            pageSize,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to query audit log', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to query audit log',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Get recent activity across all users
   * GET /api/users-manager/audit/activity/recent
   * Required capability: database:read
   * Required role: admin (enforced by plugin engine middleware)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/activity/recent', async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page || '1'), 10);
      const pageSize = Math.min(parseInt(String(req.query.pageSize || '100'), 10), 500);
      const activityType = req.query.activityType as string | undefined;

      const result = await activityService.getRecentActivity(page, pageSize, activityType);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get recent activity', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent activity',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Get activity statistics for a specific user
   * GET /api/users-manager/audit/activity/:userId/stats
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/activity/:userId/stats', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;

      const stats = await activityService.getUserActivityStats(userId);

      res.json({
        success: true,
        data: {
          userId,
          stats,
        },
      });
    } catch (error) {
      logger.error('Failed to get activity statistics', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get activity statistics',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Get available audit actions
   * GET /api/users-manager/audit/actions
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/actions', async (req: Request, res: Response): Promise<void> => {
    try {
      // Query distinct actions from audit log
      const result = await pool.query<{ action: string }>(
        'SELECT DISTINCT action FROM plugin_user_manager.audit_log ORDER BY action'
      );

      const actions = result.rows.map((row) => row.action);

      res.json({
        success: true,
        data: { actions },
      });
    } catch (error) {
      logger.error('Failed to get audit actions', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit actions',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Get available activity types
   * GET /api/users-manager/audit/activity-types
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/activity-types', async (req: Request, res: Response): Promise<void> => {
    try {
      // Query distinct activity types from activity log
      const result = await pool.query<{ activity_type: string }>(
        'SELECT DISTINCT activity_type FROM plugin_user_manager.user_activity_log ORDER BY activity_type'
      );

      const activityTypes = result.rows.map((row) => row.activity_type);

      res.json({
        success: true,
        data: { activityTypes },
      });
    } catch (error) {
      logger.error('Failed to get activity types', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get activity types',
        message: (error as Error).message,
      });
    }
  });

  return router;
}
