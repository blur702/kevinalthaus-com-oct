/**
 * Custom fields routes - Get and update custom user fields
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { UserService } from '../services/userService';
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

export function createCustomFieldsRouter(pool: Pool, logger: Logger): Router {
  const router = Router();
  const userService = new UserService(pool, logger);
  const activityService = new ActivityService(pool, logger);

  /**
   * Get custom fields for a user
   * GET /api/users-manager/:id/custom-fields
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id/custom-fields', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;

      // Validate actor
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Verify user exists
      const userExists = await userService.userExists(userId);
      if (!userExists) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const customFields = await userService.getCustomFields(userId);

      res.json({
        success: true,
        data: {
          userId,
          customFields,
        },
      });
    } catch (error) {
      logger.error('Failed to get custom fields', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get custom fields',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Update custom fields for a user (full replace)
   * PATCH /api/users-manager/:id/custom-fields
   * Required capability: database:write
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.patch('/:id/custom-fields', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { customFields, merge } = req.body;

      // Validate actor
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Validate custom fields
      if (!customFields || typeof customFields !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid custom fields data',
          message: 'customFields must be an object',
        });
        return;
      }

      // Verify user exists
      const userExists = await userService.userExists(userId);
      if (!userExists) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Update or merge custom fields
      let result;
      if (merge === true) {
        result = await userService.mergeCustomFields(
          userId,
          customFields as Record<string, unknown>,
          req.user.id
        );
      } else {
        result = await userService.updateCustomFields(
          userId,
          customFields as Record<string, unknown>,
          req.user.id
        );
      }

      // Log activity
      void activityService.logCustomFieldUpdate(
        userId,
        req.user.id,
        req.ip,
        req.headers['user-agent']
      );

      void activityService.auditUserUpdate(
        req.user.id,
        userId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { customFields },
        'Updated custom fields',
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to update custom fields', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update custom fields',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Delete custom fields for a user
   * DELETE /api/users-manager/:id/custom-fields
   * Required capability: database:write
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id/custom-fields', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id;

      // Validate actor
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Verify user exists
      const userExists = await userService.userExists(userId);
      if (!userExists) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      await userService.deleteCustomFields(userId);

      // Log activity
      void activityService.logActivity({
        userId: req.user.id,
        activityType: 'custom_field_update',
        description: 'Deleted custom fields',
        metadata: { targetUserId: userId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      void activityService.auditUserUpdate(
        req.user.id,
        userId,
        { customFieldsDeleted: true },
        'Deleted custom fields',
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: 'Custom fields deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete custom fields', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete custom fields',
        message: (error as Error).message,
      });
    }
  });

  return router;
}
