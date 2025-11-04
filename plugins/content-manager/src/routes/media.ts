/**
 * Media Management Routes
 * Handles file uploads and media library
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import type { PluginLogger } from '@monorepo/shared';
import { MediaService } from '../services/mediaService';
import Joi from 'joi';

export function createMediaRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();

  // Initialize media service
  const mediaService = new MediaService(pool, logger);

  // Initialize upload directory (will be awaited in plugin activation)
  // Note: Plugin system calls this synchronously, init must complete before routes are used
  mediaService.init().catch((error: Error) => {
    logger.error('Failed to initialize media service', error);
  });

  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const quarantineDir = './uploads/quarantine';
      try {
        await fs.mkdir(quarantineDir, { recursive: true });
        cb(null, quarantineDir);
      } catch (error) {
        cb(error as Error, quarantineDir);
      }
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const ext = path.extname(file.originalname);
      cb(null, `upload-${uniqueSuffix}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max (will be validated against allowed_file_types)
      files: 1
    }
  });

  /**
   * Upload media file
   * POST /api/content/media/upload
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post(
    '/upload',
    upload.single('file'),
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req: Request, res: Response): Promise<void> => {
      try {
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
          res.status(403).json({
            success: false,
            error: 'Editor role required to upload media'
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({
            success: false,
            error: 'No file uploaded'
          });
          return;
        }

        // Validate file
        const validation = await mediaService.validateFile(req.file);
        if (!validation.valid) {
          // Clean up quarantine file
          try {
            await fs.unlink(req.file.path);
          } catch (error) {
            logger.warn('Failed to clean up quarantine file', { error: (error as Error).message });
          }

          res.status(400).json({
            success: false,
            error: validation.error || 'File validation failed'
          });
          return;
        }

        // Get optional metadata from request body
        const { content_id, alt_text, caption } = req.body;

        // Save media
        const media = await mediaService.saveMediaMetadata(
          req.file,
          validation,
          userId,
          {
            contentId: content_id,
            altText: alt_text,
            caption
          }
        );

        logger.info(`Media uploaded: ${media.id} by ${userId}`);

        res.status(201).json({
          success: true,
          data: media
        });
      } catch (error) {
        logger.error('Failed to upload media', error as Error);

        // Clean up file if exists
        if (req.file?.path) {
          try {
            await fs.unlink(req.file.path);
          } catch (cleanupError) {
            logger.warn('Failed to clean up file after error', { error: (cleanupError as Error).message });
          }
        }

        res.status(500).json({
          success: false,
          error: 'Failed to upload media'
        });
      }
    }
  );

  /**
   * List media files
   * GET /api/content/media
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, content_id, page = '1', page_size = '20', search } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(String(page_size), 10)));
      const offset = (pageNum - 1) * pageSizeNum;

      const conditions: string[] = ['deleted_at IS NULL'];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (type) {
        conditions.push(`media_type = $${paramIndex++}`);
        params.push(type);
      }

      if (content_id) {
        conditions.push(`content_id = $${paramIndex++}`);
        params.push(content_id);
      }

      if (search) {
        conditions.push(`(original_name ILIKE $${paramIndex} OR alt_text ILIKE $${paramIndex} OR caption ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM plugin_content_manager.media WHERE ${whereClause}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

      // Whitelist ORDER BY columns for security
      const allowedSortColumns: Record<string, string> = {
        'created_at': 'm.created_at',
        'original_name': 'm.original_name',
        'file_size': 'm.file_size',
        'uploaded_by': 'uploaded_by_email'
      };

      // Default sorting
      const sortColumn = allowedSortColumns['created_at'];
      const sortDirection = 'DESC';

      const dataResult = await pool.query(
        `
        SELECT m.*, u.email as uploaded_by_email
        FROM plugin_content_manager.media m
        LEFT JOIN public.users u ON m.uploaded_by = u.id
        WHERE ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `,
        [...params, pageSizeNum, offset]
      );

      res.json({
        success: true,
        data: {
          data: dataResult.rows,
          pagination: {
            page: pageNum,
            page_size: pageSizeNum,
            total_count: totalCount,
            total_pages: Math.ceil(totalCount / pageSizeNum)
          }
        }
      });
    } catch (error) {
      logger.error('Failed to list media', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to list media'
      });
    }
  });

  /**
   * Get single media file
   * GET /api/content/media/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const media = await mediaService.getMedia(id);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media not found'
        });
        return;
      }

      res.json({
        success: true,
        data: media
      });
    } catch (error) {
      logger.error('Failed to get media', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get media'
      });
    }
  });

  /**
   * Update media metadata
   * PUT /api/content/media/:id
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || (userRole !== 'admin' && userRole !== 'editor')) {
        res.status(403).json({
          success: false,
          error: 'Editor role required'
        });
        return;
      }

      const schema = Joi.object({
        alt_text: Joi.string().optional().allow('').max(255),
        caption: Joi.string().optional().allow(''),
        content_id: Joi.string().uuid().optional().allow(null)
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (value.alt_text !== undefined) {
        updates.push(`alt_text = $${paramIndex++}`);
        params.push(value.alt_text || null);
      }

      if (value.caption !== undefined) {
        updates.push(`caption = $${paramIndex++}`);
        params.push(value.caption || null);
      }

      if (value.content_id !== undefined) {
        updates.push(`content_id = $${paramIndex++}`);
        params.push(value.content_id || null);
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
        return;
      }

      params.push(id);
      const result = await pool.query(
        `UPDATE plugin_content_manager.media
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Media not found'
        });
        return;
      }

      logger.info(`Media updated: ${id} by ${userId}`);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Failed to update media', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update media'
      });
    }
  });

  /**
   * Delete media file
   * DELETE /api/content/media/:id
   * Requires: Admin role
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin role required to delete media'
        });
        return;
      }

      const deleted = await mediaService.deleteMedia(id, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Media not found'
        });
        return;
      }

      logger.info(`Media deleted: ${id} by ${userId}`);

      res.json({
        success: true
      });
    } catch (error) {
      logger.error('Failed to delete media', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete media'
      });
    }
  });

  return router;
}
