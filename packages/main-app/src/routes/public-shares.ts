/**
 * Public File Share Routes
 *
 * Public endpoints for accessing shared files via share tokens.
 * No authentication required - access controlled by share token validation.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { FileShareService } from '../services/FileShareService';
import type { StorageService } from '../services/StorageService';
import { createLogger, LogLevel } from '@monorepo/shared';

const router = Router();

/**
 * Initialize public share routes
 */
export function createPublicShareRoutes(
  storageService: StorageService,
  dbPool: import('pg').Pool
): Router {
  const logger = createLogger({
    level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
    service: 'public-shares',
    format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
  });

  const shareService = new FileShareService(dbPool, logger);

  /**
   * GET /share/:token
   * Access a shared file via token
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:token', async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const { password } = req.query;

      // Validate share token
      const validation = await shareService.validateShare(
        token,
        password ? String(password) : undefined
      );

      if (!validation.valid) {
        if (validation.requiresPassword) {
          res.status(401).json({
            error: 'Password required',
            requiresPassword: true,
          });
          return;
        }

        res.status(403).json({ error: validation.error || 'Access denied' });
        return;
      }

      // Get file metadata
      const file = await storageService.getFile(validation.fileId!);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Build file path
      const filePath = path.join('./storage', file.storagePath);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      // Record download
      await shareService.recordDownload(token);

      // Send file
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('[PublicShareRoutes] Share access error:', error);
      res.status(500).json({
        error: 'Failed to access shared file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /share/:token/info
   * Get information about a shared file without downloading
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:token/info', async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const { password } = req.query;

      // Validate share token
      const validation = await shareService.validateShare(
        token,
        password ? String(password) : undefined
      );

      if (!validation.valid) {
        if (validation.requiresPassword) {
          res.status(401).json({
            error: 'Password required',
            requiresPassword: true,
          });
          return;
        }

        res.status(403).json({ error: validation.error || 'Access denied' });
        return;
      }

      // Get file metadata
      const file = await storageService.getFile(validation.fileId!);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Return sanitized file info (exclude internal fields)
      res.json({
        filename: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        width: file.width,
        height: file.height,
        createdAt: file.createdAt,
      });
    } catch (error) {
      console.error('[PublicShareRoutes] Share info error:', error);
      res.status(500).json({
        error: 'Failed to retrieve share information',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /share/:token/download
   * Download a shared file (forces download vs inline display)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:token/download', async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const { password } = req.query;

      // Validate share token
      const validation = await shareService.validateShare(
        token,
        password ? String(password) : undefined
      );

      if (!validation.valid) {
        if (validation.requiresPassword) {
          res.status(401).json({
            error: 'Password required',
            requiresPassword: true,
          });
          return;
        }

        res.status(403).json({ error: validation.error || 'Access denied' });
        return;
      }

      // Get file metadata
      const file = await storageService.getFile(validation.fileId!);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Build file path
      const filePath = path.join('./storage', file.storagePath);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      // Record download
      await shareService.recordDownload(token);

      // Send file with download disposition
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('[PublicShareRoutes] Share download error:', error);
      res.status(500).json({
        error: 'Failed to download shared file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

export default createPublicShareRoutes;
