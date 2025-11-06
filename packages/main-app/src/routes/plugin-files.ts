/**
 * Plugin File Operation Routes
 *
 * Plugin-scoped endpoints for file uploads and management.
 * Plugins can only access their own files (enforced by pluginId parameter).
 * Requires FILE_VIEW, FILE_UPLOAD, or FILE_DELETE capabilities.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../auth';
import { requireCapability } from '../auth/rbac-middleware';
import { Capability } from '@monorepo/shared';
import type { StorageService } from '../services/StorageService';
import { ImageTransformService } from '../services/ImageTransformService';
import { createLogger, LogLevel } from '@monorepo/shared';

const router = Router();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max (will be validated against allowed_file_types)
  },
});

/**
 * Initialize plugin file routes
 */
export function createPluginFileRoutes(storageService: StorageService): Router {
  // Initialize image transformation service
  const logger = createLogger({
    level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
    service: 'plugin-files',
    format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
  });
  const transformService = new ImageTransformService(logger);
  void transformService.initialize();

  // All routes require authentication
  router.use(authMiddleware);

  // ==========================================================================
  // Plugin File Listing & Retrieval
  // ==========================================================================

  /**
   * GET /plugins/:pluginId/files
   * List files for a specific plugin
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:pluginId/files', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { pluginId } = req.params;
      const {
        mimeType,
        tags,
        limit,
        offset,
        orderBy,
        orderDirection,
      } = req.query;

      const result = await storageService.listFiles({
        pluginId, // Enforce plugin scope
        mimeType: mimeType ? String(mimeType) : undefined,
        tags: tags ? String(tags).split(',') : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
        orderBy: orderBy as 'created_at' | 'filename' | 'file_size' | undefined,
        orderDirection: orderDirection as 'asc' | 'desc' | undefined,
        includeDeleted: false, // Plugins cannot see deleted files
      });

      res.json(result);
    } catch (error) {
      console.error('[PluginFileRoutes] List files error:', error);
      res.status(500).json({
        error: 'Failed to list files',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /plugins/:pluginId/files/:id
   * Get file metadata by ID (plugin-scoped)
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:pluginId/files/:id', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { pluginId, id } = req.params;
      const file = await storageService.getFile(id, pluginId); // Enforce plugin scope

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      res.json(file);
    } catch (error) {
      console.error('[PluginFileRoutes] Get file error:', error);
      res.status(500).json({
        error: 'Failed to retrieve file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /plugins/:pluginId/files/:id/transform
   * Transform an image on-the-fly (plugin-scoped)
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:pluginId/files/:id/transform', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { pluginId, id } = req.params;

      // Get file metadata (enforce plugin scope)
      const file = await storageService.getFile(id, pluginId);
      if (!file) {
        res.status(404).json({ error: 'File not found or does not belong to this plugin' });
        return;
      }

      // Check if file is an image
      if (!file.mimeType.startsWith('image/')) {
        res.status(400).json({ error: 'File is not an image' });
        return;
      }

      // Parse transformation options
      const transformOptions = transformService.parseQueryParams(req.query);

      // Validate options
      const validation = transformService.validateOptions(transformOptions);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      // Build source path using absolute path from config
      const storageDir = path.resolve(process.env.STORAGE_PATH || './storage');
      const sourcePath = path.join(storageDir, file.storagePath);

      // Transform image
      const result = await transformService.transform(sourcePath, transformOptions);

      // Set headers
      res.setHeader('Content-Type', `image/${result.format}`);
      res.setHeader('Content-Length', result.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Transform-Cache-Key', result.cacheKey);

      res.send(result.buffer);
    } catch (error) {
      console.error('[PluginFileRoutes] Transform error:', error);
      res.status(500).json({
        error: 'Failed to transform image',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // Plugin File Upload
  // ==========================================================================

  /**
   * POST /plugins/:pluginId/files
   * Upload a file for a specific plugin
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:pluginId/files', requireCapability(Capability.FILE_UPLOAD), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { pluginId } = req.params;
      const { generateThumbnail, thumbnailWidth, thumbnailHeight, quality } = req.body;
      const user = req.user!;

      const result = await storageService.uploadFile(
        pluginId, // Use plugin ID from route
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        user.id,
        {
          generateThumbnail: generateThumbnail === 'true' || generateThumbnail === true,
          thumbnailWidth: thumbnailWidth ? parseInt(thumbnailWidth, 10) : undefined,
          thumbnailHeight: thumbnailHeight ? parseInt(thumbnailHeight, 10) : undefined,
          quality: quality ? parseInt(quality, 10) : undefined,
        }
      );

      res.status(201).json(result);
    } catch (error) {
      console.error('[PluginFileRoutes] Upload file error:', error);
      res.status(500).json({
        error: 'Failed to upload file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /plugins/:pluginId/files/bulk
   * Upload multiple files for a specific plugin
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:pluginId/files/bulk', requireCapability(Capability.FILE_UPLOAD), upload.array('files', 50), async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
      }

      const { pluginId } = req.params;
      const { generateThumbnails, thumbnailWidth, thumbnailHeight, quality, continueOnError } = req.body;
      const user = req.user!;

      const files = req.files.map((file) => ({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }));

      const result = await storageService.bulkUploadFiles(
        pluginId, // Use plugin ID from route
        files,
        user.id,
        {
          generateThumbnails: generateThumbnails === 'true' || generateThumbnails === true,
          thumbnailWidth: thumbnailWidth ? parseInt(thumbnailWidth, 10) : undefined,
          thumbnailHeight: thumbnailHeight ? parseInt(thumbnailHeight, 10) : undefined,
          quality: quality ? parseInt(quality, 10) : undefined,
          continueOnError: continueOnError === 'true' || continueOnError === true,
        }
      );

      res.status(201).json(result);
    } catch (error) {
      console.error('[PluginFileRoutes] Bulk upload error:', error);
      res.status(500).json({
        error: 'Failed to upload files',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // Plugin File Metadata Updates
  // ==========================================================================

  /**
   * PATCH /plugins/:pluginId/files/:id
   * Update file metadata (altText, caption, tags) for plugin-owned file
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.patch('/:pluginId/files/:id', requireCapability(Capability.FILE_UPLOAD), async (req: Request, res: Response): Promise<void> => {
    try {
      const { pluginId, id } = req.params;
      const { altText, caption, tags } = req.body;
      const user = req.user!;

      // Verify file belongs to plugin
      const file = await storageService.getFile(id, pluginId);
      if (!file) {
        res.status(404).json({ error: 'File not found or does not belong to this plugin' });
        return;
      }

      const result = await storageService.updateFileMetadata(
        id,
        { altText, caption, tags },
        user.id
      );

      res.json(result);
    } catch (error) {
      console.error('[PluginFileRoutes] Update file metadata error:', error);
      res.status(500).json({
        error: 'Failed to update file metadata',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // Plugin File Deletion
  // ==========================================================================

  /**
   * DELETE /plugins/:pluginId/files/:id
   * Soft delete a plugin-owned file
   * Requires: FILE_DELETE capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:pluginId/files/:id', requireCapability(Capability.FILE_DELETE), async (req: Request, res: Response): Promise<void> => {
    try {
      const { pluginId, id } = req.params;
      const user = req.user!;

      await storageService.deleteFile(id, user.id, pluginId); // Enforce plugin scope

      res.status(204).send();
    } catch (error) {
      console.error('[PluginFileRoutes] Delete file error:', error);
      res.status(500).json({
        error: 'Failed to delete file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // Plugin Utilities
  // ==========================================================================

  /**
   * GET /plugins/:pluginId/allowed-types
   * Get list of allowed file types (filtered by category if provided)
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:pluginId/allowed-types', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.query;
      const allowedTypes = await storageService.getAllowedFileTypes(
        category ? String(category) : undefined
      );

      res.json({ allowedTypes });
    } catch (error) {
      console.error('[PluginFileRoutes] Get allowed file types error:', error);
      res.status(500).json({
        error: 'Failed to retrieve allowed file types',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

export default createPluginFileRoutes;
