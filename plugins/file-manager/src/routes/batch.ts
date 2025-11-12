/**
 * Batch Operations Routes
 * Handles bulk operations on files and folders
 *
 * SECURITY NOTE: All routes require authentication middleware.
 * Rate limiting is enforced via max array sizes to prevent abuse.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import { BatchService } from '../services/batchService';
import Joi from 'joi';

// Rate limiting constants
const MAX_BATCH_SIZE = 100; // Maximum items per batch operation
const MAX_TAG_COUNT = 50; // Maximum tags per operation

export function createBatchRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();
  const batchService = new BatchService(pool, logger);

  /**
   * POST /move - Move multiple files/folders
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/move', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required for batch operations'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        file_ids: Joi.array().items(Joi.string().uuid()).max(MAX_BATCH_SIZE).optional(),
        folder_ids: Joi.array().items(Joi.string().uuid()).max(MAX_BATCH_SIZE).optional(),
        target_folder_id: Joi.string().uuid().allow(null).required()
      }).custom((value, helpers) => {
        if (!value.file_ids && !value.folder_ids) {
          return helpers.error('custom.atLeastOne');
        }
        return value;
      }, 'At least one of file_ids or folder_ids required').messages({
        'custom.atLeastOne': 'At least one of file_ids or folder_ids must be provided'
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      let result = { successful: [], failed: [], total: 0 };

      // Move files
      if (value.file_ids && value.file_ids.length > 0) {
        const fileResult = await batchService.batchMoveFiles(
          value.file_ids,
          value.target_folder_id,
          userId
        );
        result.successful.push(...fileResult.successful);
        result.failed.push(...fileResult.failed);
        result.total += fileResult.total;
      }

      // Move folders
      if (value.folder_ids && value.folder_ids.length > 0) {
        const folderResult = await batchService.batchMoveFolders(
          value.folder_ids,
          value.target_folder_id,
          userId
        );
        result.successful.push(...folderResult.successful);
        result.failed.push(...folderResult.failed);
        result.total += folderResult.total;
      }

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to batch move', error as Error);

      const message = (error as Error).message;
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: message
        });
      } else if (message.includes('depth')) {
        res.status(400).json({
          success: false,
          error: message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to batch move items'
        });
      }
    }
  });

  /**
   * POST /copy - Copy multiple files
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/copy', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required for batch operations'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        file_ids: Joi.array().items(Joi.string().uuid()).min(1).max(MAX_BATCH_SIZE).required(),
        target_folder_id: Joi.string().uuid().allow(null).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const result = await batchService.batchCopyFiles(
        value.file_ids,
        value.target_folder_id,
        userId
      );

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to batch copy', error as Error);

      const message = (error as Error).message;
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to batch copy files'
        });
      }
    }
  });

  /**
   * POST /tag - Tag multiple files
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/tag', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required for batch operations'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        file_ids: Joi.array().items(Joi.string().uuid()).min(1).max(MAX_BATCH_SIZE).required(),
        tags: Joi.array().items(Joi.string()).min(1).max(MAX_TAG_COUNT).required(),
        operation: Joi.string().valid('add', 'remove', 'replace').required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const result = await batchService.batchTagFiles(
        value.file_ids,
        value.tags,
        value.operation,
        userId
      );

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to batch tag', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to batch tag files'
      });
    }
  });

  /**
   * POST /delete - Delete multiple files/folders
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/delete', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required for batch delete'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        file_ids: Joi.array().items(Joi.string().uuid()).max(MAX_BATCH_SIZE).optional(),
        folder_ids: Joi.array().items(Joi.string().uuid()).max(MAX_BATCH_SIZE).optional(),
        hard_delete: Joi.boolean().default(false)
      }).custom((value, helpers) => {
        if (!value.file_ids && !value.folder_ids) {
          return helpers.error('custom.atLeastOne');
        }
        return value;
      }, 'At least one of file_ids or folder_ids required').messages({
        'custom.atLeastOne': 'At least one of file_ids or folder_ids must be provided'
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      let result = { successful: [], failed: [], total: 0 };

      // Delete files
      if (value.file_ids && value.file_ids.length > 0) {
        const fileResult = await batchService.batchDeleteFiles(
          value.file_ids,
          value.hard_delete,
          userId
        );
        result.successful.push(...fileResult.successful);
        result.failed.push(...fileResult.failed);
        result.total += fileResult.total;
      }

      // Delete folders
      if (value.folder_ids && value.folder_ids.length > 0) {
        const folderResult = await batchService.batchDeleteFolders(
          value.folder_ids,
          value.hard_delete,
          userId
        );
        result.successful.push(...folderResult.successful);
        result.failed.push(...folderResult.failed);
        result.total += folderResult.total;
      }

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to batch delete', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to batch delete items'
      });
    }
  });

  return router;
}
