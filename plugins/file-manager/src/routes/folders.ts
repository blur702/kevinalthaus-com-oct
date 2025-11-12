/**
 * Folder Management Routes
 * Handles folder CRUD operations and file-folder associations
 *
 * SECURITY NOTE: All routes in this router require authentication middleware
 * to be applied at the plugin level. Routes assume req.user is populated
 * by upstream authentication middleware.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import { FolderService } from '../services/folderService';
import Joi from 'joi';

// Input sanitization helper
function sanitizeString(input: string): string {
  // Remove potentially dangerous characters while preserving valid folder names
  return input
    .replace(/[<>\"'`]/g, '') // Remove HTML/script injection characters
    .replace(/\.\./g, '') // Remove path traversal attempts
    .trim();
}

export function createFoldersRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();
  const folderService = new FolderService(pool, logger);

  /**
   * GET / - List folders with hierarchy
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const { parent_id, max_depth } = req.query;

      const folders = await folderService.getFolderHierarchy(
        parent_id as string | undefined,
        max_depth ? parseInt(max_depth as string, 10) : undefined
      );

      res.json({ success: true, data: folders });
    } catch (error) {
      logger.error('Failed to list folders', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to list folders'
      });
    }
  });

  /**
   * GET /:id - Get single folder with contents
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { include_files } = req.query;

      if (include_files === 'false') {
        // Just return folder without files
        const result = await pool.query(
          `SELECT * FROM plugin_file_manager.folders WHERE id = $1 AND deleted_at IS NULL`,
          [id]
        );

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: 'Folder not found'
          });
          return;
        }

        res.json({ success: true, data: { folder: result.rows[0], files: [] } });
      } else {
        const result = await folderService.getFolderWithFiles(id);
        res.json({ success: true, data: result });
      }
    } catch (error) {
      logger.error('Failed to get folder', error as Error);

      if ((error as Error).message === 'Folder not found') {
        res.status(404).json({
          success: false,
          error: 'Folder not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get folder'
        });
      }
    }
  });

  /**
   * POST / - Create new folder
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required to create folders'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        name: Joi.string().required().max(255),
        slug: Joi.string().optional().max(255),
        description: Joi.string().optional().allow(null),
        parent_id: Joi.string().uuid().optional().allow(null),
        color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().allow(null),
        icon: Joi.string().max(50).optional().allow(null)
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      // Sanitize string inputs to prevent XSS
      if (value.name) value.name = sanitizeString(value.name);
      if (value.slug) value.slug = sanitizeString(value.slug);
      if (value.description) value.description = sanitizeString(value.description);

      const folder = await folderService.createFolder(value, userId);

      res.status(201).json({ success: true, data: folder });
    } catch (error) {
      logger.error('Failed to create folder', error as Error);

      const message = (error as Error).message;
      if (message.includes('duplicate') || message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: message
        });
      } else if (message.includes('Parent folder not found')) {
        res.status(404).json({
          success: false,
          error: message
        });
      } else if (message.includes('Maximum folder depth')) {
        res.status(400).json({
          success: false,
          error: message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create folder'
        });
      }
    }
  });

  /**
   * PUT /:id - Update folder metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        name: Joi.string().max(255).optional(),
        slug: Joi.string().max(255).optional(),
        description: Joi.string().optional().allow(null),
        color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().allow(null),
        icon: Joi.string().max(50).optional().allow(null)
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      // Sanitize string inputs to prevent XSS
      if (value.name) value.name = sanitizeString(value.name);
      if (value.slug) value.slug = sanitizeString(value.slug);
      if (value.description) value.description = sanitizeString(value.description);

      const folder = await folderService.updateFolder(id, value, userId);

      res.json({ success: true, data: folder });
    } catch (error) {
      logger.error('Failed to update folder', error as Error);

      const message = (error as Error).message;
      if (message === 'Folder not found') {
        res.status(404).json({
          success: false,
          error: message
        });
      } else if (message === 'Cannot modify system folder') {
        res.status(403).json({
          success: false,
          error: message
        });
      } else if (message.includes('duplicate') || message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update folder'
        });
      }
    }
  });

  /**
   * DELETE /:id - Delete folder
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { id } = req.params;
      const { force } = req.query;

      if (!userId || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required to delete folders'
        });
        return;
      }

      const hardDelete = force === 'true';

      await folderService.deleteFolder(id, userId, hardDelete);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete folder', error as Error);

      const message = (error as Error).message;
      if (message === 'Folder not found') {
        res.status(404).json({
          success: false,
          error: message
        });
      } else if (message === 'Cannot delete system folder') {
        res.status(403).json({
          success: false,
          error: message
        });
      } else if (message.includes('children')) {
        res.status(400).json({
          success: false,
          error: message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete folder'
        });
      }
    }
  });

  /**
   * POST /:id/move - Move folder to new parent
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/move', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { id } = req.params;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required to move folders'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        parent_id: Joi.string().uuid().allow(null).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const folder = await folderService.moveFolder(id, value.parent_id, userId);

      res.json({ success: true, data: folder });
    } catch (error) {
      logger.error('Failed to move folder', error as Error);

      const message = (error as Error).message;
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: message
        });
      } else if (message.includes('circular') || message.includes('descendant')) {
        res.status(400).json({
          success: false,
          error: message
        });
      } else if (message.includes('Maximum folder depth')) {
        res.status(400).json({
          success: false,
          error: message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to move folder'
        });
      }
    }
  });

  return router;
}

/**
 * Create file-folder association router
 * Mounted at /api/file-manager/files
 */
export function createFilesFolderRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();
  const folderService = new FolderService(pool, logger);

  /**
   * POST /:fileId/folder - Add file to folder
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:fileId/folder', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { fileId } = req.params;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required to add files to folders'
        });
        return;
      }

      // Validate request body
      const schema = Joi.object({
        folder_id: Joi.string().uuid().required(),
        position: Joi.number().integer().min(0).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const association = await folderService.addFileToFolder(
        fileId,
        value.folder_id,
        userId,
        value.position
      );

      res.status(201).json({ success: true, data: association });
    } catch (error) {
      logger.error('Failed to add file to folder', error as Error);

      const message = (error as Error).message;
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to add file to folder'
        });
      }
    }
  });

  /**
   * DELETE /:fileId/folder - Remove file from folder
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:fileId/folder', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { fileId } = req.params;
      const { folder_id } = req.query;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required to remove files from folders'
        });
        return;
      }

      if (!folder_id) {
        res.status(400).json({
          success: false,
          error: 'folder_id query parameter required'
        });
        return;
      }

      await folderService.removeFileFromFolder(fileId, folder_id as string);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to remove file from folder', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to remove file from folder'
      });
    }
  });

  return router;
}
