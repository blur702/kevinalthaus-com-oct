/// <reference path="../types/express.d.ts" />

/**
 * User routes - List and view user operations
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';

// Simple logger interface for routes
interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void;
}

// Note: RBAC middleware should be applied by the plugin engine
// This is just the business logic

export function createUsersRouter(pool: Pool, logger: Logger): Router {
  const router = Router();
  const userService = new UserService(pool, logger);
  const activityService = new ActivityService(pool, logger);

  /**
   * List users with pagination and filtering
   * GET /api/users-manager
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      // Extract query parameters
      const page = parseInt(String(req.query.page || '1'), 10);
      const pageSize = Math.min(parseInt(String(req.query.pageSize || '20'), 10), 100);
      const role = req.query.role as string | undefined;
      const search = req.query.search as string | undefined;
      const sortBy = (req.query.sortBy as 'email' | 'username' | 'created_at' | 'updated_at') || 'created_at';
      const sortOrder = (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC';

      const result = await userService.listUsers(
        { role, search, sortBy, sortOrder },
        page,
        pageSize
      );

      // Log activity
      if (req.user?.id) {
        void activityService.logActivity({
          userId: req.user.id,
          activityType: 'api_access',
          description: 'Listed users',
          metadata: { page, pageSize, role, search },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to list users', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to list users',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Get user by ID with activity history
   * GET /api/users-manager/:id
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;
      const includeCustomFields = req.query.includeCustomFields === 'true';
      const includeActivity = req.query.includeActivity === 'true';

      // Get user details
      const user = await userService.getUserById(userId, includeCustomFields);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Optionally include activity history
      let activity = undefined;
      if (includeActivity) {
        const activityPage = parseInt(String(req.query.activityPage || '1'), 10);
        const activityPageSize = Math.min(
          parseInt(String(req.query.activityPageSize || '20'), 10),
          100
        );
        activity = await activityService.getUserActivity(userId, activityPage, activityPageSize);
      }

      // Log activity
      if (req.user?.id) {
        void activityService.auditUserRead(
          req.user.id,
          userId,
          req.ip,
          req.headers['user-agent']
        );
      }

      res.json({
        success: true,
        data: {
          user,
          activity,
        },
      });
    } catch (error) {
      logger.error('Failed to get user', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Get user activity log
   * GET /api/users-manager/:id/activity
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id/activity', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;
      const page = parseInt(String(req.query.page || '1'), 10);
      const pageSize = Math.min(parseInt(String(req.query.pageSize || '50'), 10), 200);
      const activityType = req.query.activityType as string | undefined;

      // Verify user exists
      const userExists = await userService.userExists(userId);
      if (!userExists) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const result = await activityService.getUserActivity(userId, page, pageSize, activityType);

      // Log activity
      if (req.user?.id) {
        void activityService.logActivity({
          userId: req.user.id,
          activityType: 'api_access',
          description: 'Viewed user activity log',
          metadata: { targetUserId: userId, page, pageSize, activityType },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get user activity', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user activity',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Get user statistics
   * GET /api/users-manager/stats
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/stats/summary', async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await userService.getUserStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get user statistics', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user statistics',
        message: (error as Error).message,
      });
    }
  });

  return router;
}
