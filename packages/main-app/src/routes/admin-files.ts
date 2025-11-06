/**
 * Admin File Management Routes
 *
 * Admin-only endpoints for managing all files across all plugins.
 * Requires FILE_VIEW, FILE_DELETE, or FILE_MANAGE_TYPES capabilities.
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
import { FileShareService } from '../services/FileShareService';
import { FileVersionService } from '../services/FileVersionService';
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
 * Initialize admin file routes
 */
export function createAdminFileRoutes(storageService: StorageService, dbPool: import('pg').Pool): Router {
  // Initialize services
  const logger = createLogger({
    level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
    service: 'admin-files',
    format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
  });
  const transformService = new ImageTransformService(logger);
  void transformService.initialize();
  const shareService = new FileShareService(dbPool, logger);
  const versionService = new FileVersionService(dbPool, logger);

  // All routes require authentication
  router.use(authMiddleware);

  // ==========================================================================
  // File Listing & Retrieval
  // ==========================================================================

  /**
   * GET /admin/files
   * List all files with filters and pagination
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        pluginId,
        mimeType,
        tags,
        limit,
        offset,
        orderBy,
        orderDirection,
        includeDeleted,
      } = req.query;

      const result = await storageService.listFiles({
        pluginId: pluginId ? String(pluginId) : undefined,
        mimeType: mimeType ? String(mimeType) : undefined,
        tags: tags ? String(tags).split(',') : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
        orderBy: orderBy as 'created_at' | 'filename' | 'file_size' | undefined,
        orderDirection: orderDirection as 'asc' | 'desc' | undefined,
        includeDeleted: includeDeleted === 'true',
      });

      res.json(result);
    } catch (error) {
      console.error('[AdminFileRoutes] List files error:', error);
      res.status(500).json({
        error: 'Failed to list files',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /admin/files/:id
   * Get file metadata by ID
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const file = await storageService.getFile(id);

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      res.json(file);
    } catch (error) {
      console.error('[AdminFileRoutes] Get file error:', error);
      res.status(500).json({
        error: 'Failed to retrieve file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /admin/files/:id/transform
   * Transform an image on-the-fly with query parameters
   * Requires: FILE_VIEW capability
   *
   * Query parameters:
   *   - width: number (1-4000)
   *   - height: number (1-4000)
   *   - fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
   *   - format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'
   *   - quality: number (1-100)
   *   - grayscale: boolean
   *   - blur: number (0.3-1000)
   *   - sharpen: boolean
   *   - rotate: number (-360 to 360)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id/transform', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Get file metadata
      const file = await storageService.getFile(id);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Check if file is an image
      if (!file.mimeType.startsWith('image/')) {
        res.status(400).json({ error: 'File is not an image' });
        return;
      }

      // Parse transformation options from query params
      const transformOptions = transformService.parseQueryParams(req.query);

      // Validate options
      const validation = transformService.validateOptions(transformOptions);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      // Build full path to source file
      const sourcePath = path.join('./storage', file.storagePath);

      // Transform image
      const result = await transformService.transform(sourcePath, transformOptions);

      // Set appropriate headers
      const mimeType = `image/${result.format}`;
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', result.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
      res.setHeader('X-Transform-Cache-Key', result.cacheKey);

      res.send(result.buffer);
    } catch (error) {
      console.error('[AdminFileRoutes] Image transformation error:', error);
      res.status(500).json({
        error: 'Failed to transform image',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // File Upload
  // ==========================================================================

  /**
   * POST /admin/files
   * Upload a file (admin can upload for any plugin)
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/', requireCapability(Capability.FILE_UPLOAD), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { pluginId, generateThumbnail, thumbnailWidth, thumbnailHeight, quality } = req.body;

      if (!pluginId) {
        res.status(400).json({ error: 'pluginId is required' });
        return;
      }

      const user = req.user!;

      const result = await storageService.uploadFile(
        pluginId,
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
      console.error('[AdminFileRoutes] Upload file error:', error);
      res.status(500).json({
        error: 'Failed to upload file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /admin/files/bulk
   * Upload multiple files at once (admin can upload for any plugin)
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/bulk', requireCapability(Capability.FILE_UPLOAD), upload.array('files', 50), async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
      }

      const { pluginId, generateThumbnails, thumbnailWidth, thumbnailHeight, quality, continueOnError } = req.body;

      if (!pluginId) {
        res.status(400).json({ error: 'pluginId is required' });
        return;
      }

      const user = req.user!;

      const files = req.files.map((file) => ({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }));

      const result = await storageService.bulkUploadFiles(
        pluginId,
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
      console.error('[AdminFileRoutes] Bulk upload error:', error);
      res.status(500).json({
        error: 'Failed to upload files',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // File Metadata Updates
  // ==========================================================================

  /**
   * PATCH /admin/files/:id
   * Update file metadata (altText, caption, tags)
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.patch('/:id', requireCapability(Capability.FILE_UPLOAD), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { altText, caption, tags } = req.body;
      const user = req.user!;

      const result = await storageService.updateFileMetadata(
        id,
        { altText, caption, tags },
        user.id
      );

      res.json(result);
    } catch (error) {
      console.error('[AdminFileRoutes] Update file metadata error:', error);
      res.status(500).json({
        error: 'Failed to update file metadata',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // File Deletion
  // ==========================================================================

  /**
   * DELETE /admin/files/:id
   * Soft delete a file
   * Requires: FILE_DELETE capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id', requireCapability(Capability.FILE_DELETE), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      await storageService.deleteFile(id, user.id);

      res.status(204).send();
    } catch (error) {
      console.error('[AdminFileRoutes] Delete file error:', error);
      res.status(500).json({
        error: 'Failed to delete file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /admin/files/:id/permanent
   * Permanently delete a file from disk and database
   * Requires: FILE_DELETE capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id/permanent', requireCapability(Capability.FILE_DELETE), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      await storageService.hardDeleteFile(id, user.id);

      res.status(204).send();
    } catch (error) {
      console.error('[AdminFileRoutes] Hard delete file error:', error);
      res.status(500).json({
        error: 'Failed to permanently delete file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // Allowed File Types Management
  // ==========================================================================

  /**
   * GET /admin/files/allowed-types
   * Get list of allowed file types
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/allowed-types', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.query;
      const allowedTypes = await storageService.getAllowedFileTypes(
        category ? String(category) : undefined
      );

      res.json({ allowedTypes });
    } catch (error) {
      console.error('[AdminFileRoutes] Get allowed file types error:', error);
      res.status(500).json({
        error: 'Failed to retrieve allowed file types',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // File Sharing
  // ==========================================================================

  /**
   * POST /admin/files/:id/share
   * Create a share link for a file
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/share', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { expiresAt, maxDownloads, password } = req.body;
      const user = req.user!;

      // Verify file exists
      const file = await storageService.getFile(id);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const share = await shareService.createShare({
        fileId: id,
        createdBy: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxDownloads: maxDownloads ? parseInt(maxDownloads, 10) : undefined,
        password,
      });

      res.status(201).json(share);
    } catch (error) {
      console.error('[AdminFileRoutes] Create share error:', error);
      res.status(500).json({
        error: 'Failed to create share',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /admin/files/:id/shares
   * List all shares for a specific file
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id/shares', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Verify file exists
      const file = await storageService.getFile(id);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const shares = await shareService.listSharesForFile(id);

      res.json({ shares });
    } catch (error) {
      console.error('[AdminFileRoutes] List file shares error:', error);
      res.status(500).json({
        error: 'Failed to list shares',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /admin/shares
   * List all shares created by the current user
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/shares', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { includeInactive, limit, offset } = req.query;
      const user = req.user!;

      const result = await shareService.listSharesByUser(user.id, {
        includeInactive: includeInactive === 'true',
        limit: limit ? parseInt(String(limit), 10) : undefined,
        offset: offset ? parseInt(String(offset), 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error('[AdminFileRoutes] List user shares error:', error);
      res.status(500).json({
        error: 'Failed to list shares',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PATCH /admin/shares/:shareId
   * Update share settings
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.patch('/shares/:shareId', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { shareId } = req.params;
      const { expiresAt, maxDownloads, isActive } = req.body;
      const user = req.user!;

      const updates: {
        expiresAt?: Date | null;
        maxDownloads?: number | null;
        isActive?: boolean;
      } = {};

      if (expiresAt !== undefined) {
        updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      }
      if (maxDownloads !== undefined) {
        updates.maxDownloads = maxDownloads ? parseInt(maxDownloads, 10) : null;
      }
      if (isActive !== undefined) {
        updates.isActive = isActive === 'true' || isActive === true;
      }

      const share = await shareService.updateShare(shareId, user.id, updates);

      if (!share) {
        res.status(404).json({ error: 'Share not found or you do not have permission' });
        return;
      }

      res.json(share);
    } catch (error) {
      console.error('[AdminFileRoutes] Update share error:', error);
      res.status(500).json({
        error: 'Failed to update share',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /admin/shares/:shareId
   * Revoke (deactivate) a share
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/shares/:shareId', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { shareId } = req.params;
      const user = req.user!;

      const revoked = await shareService.revokeShare(shareId, user.id);

      if (!revoked) {
        res.status(404).json({ error: 'Share not found or you do not have permission' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('[AdminFileRoutes] Revoke share error:', error);
      res.status(500).json({
        error: 'Failed to revoke share',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /admin/shares/:shareId/permanent
   * Permanently delete a share
   * Requires: FILE_DELETE capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/shares/:shareId/permanent', requireCapability(Capability.FILE_DELETE), async (req: Request, res: Response): Promise<void> => {
    try {
      const { shareId } = req.params;
      const user = req.user!;

      const deleted = await shareService.deleteShare(shareId, user.id);

      if (!deleted) {
        res.status(404).json({ error: 'Share not found or you do not have permission' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('[AdminFileRoutes] Delete share error:', error);
      res.status(500).json({
        error: 'Failed to delete share',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ==========================================================================
  // File Versioning
  // ==========================================================================

  /**
   * GET /admin/files/:id/versions
   * List all versions of a file
   * Requires: FILE_VIEW capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id/versions', requireCapability(Capability.FILE_VIEW), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;

      // Verify file exists
      const file = await storageService.getFile(id);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const result = await versionService.listVersions(id, {
        limit: limit ? parseInt(String(limit), 10) : undefined,
        offset: offset ? parseInt(String(offset), 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error('[AdminFileRoutes] List file versions error:', error);
      res.status(500).json({
        error: 'Failed to list versions',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /admin/files/:id/versions
   * Manually create a version of a file
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/versions', requireCapability(Capability.FILE_UPLOAD), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Get file metadata
      const file = await storageService.getFile(id);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const version = await versionService.createVersion({
        fileId: id,
        currentStoragePath: file.storagePath,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdBy: user.id,
      });

      res.status(201).json(version);
    } catch (error) {
      console.error('[AdminFileRoutes] Create version error:', error);
      res.status(500).json({
        error: 'Failed to create version',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /admin/versions/:versionId/restore
   * Restore a file to a specific version
   * Requires: FILE_UPLOAD capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/versions/:versionId/restore', requireCapability(Capability.FILE_UPLOAD), async (req: Request, res: Response): Promise<void> => {
    try {
      const { versionId } = req.params;
      const { fileId } = req.body;
      const user = req.user!;

      if (!fileId) {
        res.status(400).json({ error: 'fileId is required' });
        return;
      }

      const result = await versionService.restoreVersion(versionId, fileId, user.id);

      res.json(result);
    } catch (error) {
      console.error('[AdminFileRoutes] Restore version error:', error);
      res.status(500).json({
        error: 'Failed to restore version',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /admin/versions/:versionId
   * Delete a specific version
   * Requires: FILE_DELETE capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/versions/:versionId', requireCapability(Capability.FILE_DELETE), async (req: Request, res: Response): Promise<void> => {
    try {
      const { versionId } = req.params;
      const { fileId } = req.query;

      if (!fileId) {
        res.status(400).json({ error: 'fileId is required' });
        return;
      }

      const deleted = await versionService.deleteVersion(versionId, String(fileId));

      if (!deleted) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('[AdminFileRoutes] Delete version error:', error);
      res.status(500).json({
        error: 'Failed to delete version',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /admin/files/:id/versions/cleanup
   * Clean up old versions (retention policy)
   * Requires: FILE_DELETE capability
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/versions/cleanup', requireCapability(Capability.FILE_DELETE), async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { keepCount } = req.body;

      // Verify file exists
      const file = await storageService.getFile(id);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const deletedCount = await versionService.cleanupOldVersions(
        id,
        keepCount ? parseInt(keepCount, 10) : 10
      );

      res.json({ deletedCount });
    } catch (error) {
      console.error('[AdminFileRoutes] Cleanup versions error:', error);
      res.status(500).json({
        error: 'Failed to cleanup versions',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

export default createAdminFileRoutes;
