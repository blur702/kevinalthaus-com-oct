/**
 * Bulk operations routes - Import and export users
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { parse } from 'csv-parse/sync';
import { BulkService } from '../services/bulkService';
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

export function createBulkRouter(pool: Pool, logger: Logger): Router {
  const router = Router();
  const bulkService = new BulkService(pool, logger);
  const activityService = new ActivityService(pool, logger);

  /**
   * Bulk import users from CSV or JSON
   * POST /api/users-manager/bulk/import
   * Required capability: database:write
   * Required role: admin (enforced by plugin engine middleware)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/import', async (req: Request, res: Response): Promise<void> => {
    try {
      const { content, format } = req.body as { content?: unknown; format?: unknown };

      // Validate actor
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Validate input
      if (!content || typeof content !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'content must be a string',
        });
        return;
      }

      if (!format || typeof format !== 'string' || !['csv', 'json'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format',
          message: 'format must be either "csv" or "json"',
        });
        return;
      }

      // Validate file structure first
      const validation = bulkService.validateImportFile(content, format as 'csv' | 'json');
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid import file',
          errors: validation.errors,
        });
        return;
      }

      // Perform import
      let result;
      if (format === 'csv') {
        result = await bulkService.importFromCSV(content, req.user.id);
      } else {
        result = await bulkService.importFromJSON(content, req.user.id);
      }

      // Log activity
      void activityService.logBulkOperation(
        req.user.id,
        'import',
        result.successful,
        req.ip,
        req.headers['user-agent']
      );

      void activityService.auditBulkImport(
        req.user.id,
        result.total,
        result.successful,
        result.failed,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to import users', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to import users',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Bulk export users to CSV or JSON
   * POST /api/users-manager/bulk/export
   * Required capability: database:read
   * Required role: admin (enforced by plugin engine middleware)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/export', async (req: Request, res: Response): Promise<void> => {
    try {
      const { format, includeCustomFields, filters } = req.body as {
        format?: unknown;
        includeCustomFields?: unknown;
        filters?: unknown;
      };

      // Validate actor
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Validate format
      if (!format || typeof format !== 'string' || !['csv', 'json'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format',
          message: 'format must be either "csv" or "json"',
        });
        return;
      }

      // Perform export
      let content: string;
      let contentType: string;
      let filename: string;

      const exportOptions = {
        format: format as 'csv' | 'json',
        includeCustomFields: includeCustomFields === true,
        filters: filters || {},
      };

      if (format === 'csv') {
        content = await bulkService.exportToCSV(exportOptions);
        contentType = 'text/csv';
        filename = bulkService.sanitizeExportFilename(
          `users-export-${new Date().toISOString().split('T')[0]}.csv`
        );
      } else {
        content = await bulkService.exportToJSON(exportOptions);
        contentType = 'application/json';
        filename = bulkService.sanitizeExportFilename(
          `users-export-${new Date().toISOString().split('T')[0]}.json`
        );
      }

      // Count records properly using csv-parse for CSV
      let recordCount: number;
      if (format === 'csv') {
        try {
          const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          }) as Array<Record<string, string>>;
          recordCount = records.length;
        } catch {
          // Fallback to simple counting if parsing fails
          recordCount = Math.max(0, content.split('\n').length - 1);
        }
      } else {
        recordCount = (JSON.parse(content) as unknown[]).length;
      }

      // Log activity
      void activityService.logBulkOperation(
        req.user.id,
        'export',
        recordCount,
        req.ip,
        req.headers['user-agent']
      );

      void activityService.auditBulkExport(
        req.user.id,
        recordCount,
        format as 'csv' | 'json',
        req.ip,
        req.headers['user-agent']
      );

      // Set headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      logger.error('Failed to export users', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to export users',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Validate import file without importing
   * POST /api/users-manager/bulk/validate
   * Required capability: database:read
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises, @typescript-eslint/require-await
  router.post('/validate', async (req: Request, res: Response): Promise<void> => {
    try {
      const { content, format } = req.body as { content?: unknown; format?: unknown };

      // Validate input
      if (!content || typeof content !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'content must be a string',
        });
        return;
      }

      if (!format || typeof format !== 'string' || !['csv', 'json'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format',
          message: 'format must be either "csv" or "json"',
        });
        return;
      }

      const validation = bulkService.validateImportFile(content, format as 'csv' | 'json');

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('Failed to validate import file', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate import file',
        message: (error as Error).message,
      });
    }
  });

  return router;
}
