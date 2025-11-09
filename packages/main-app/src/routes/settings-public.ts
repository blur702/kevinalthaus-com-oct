/**
 * Public settings endpoints - no authentication required
 * Used by frontend to fetch public configuration like site name
 */

import { Router, Response, Request } from 'express';
import { defaultLogger as logger } from '@monorepo/shared';
import { query } from '../db';

const router = Router();

// Helper: Get settings from database
async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const validKeyPattern = /^[a-z_.:]+$/;
  for (const key of keys) {
    if (!validKeyPattern.test(key)) {
      throw new Error(`Invalid setting key: ${key}`);
    }
  }

  const result = await query<{ key: string; value: unknown }>(
    'SELECT key, value FROM system_settings WHERE key = ANY($1::text[])',
    [keys]
  );

  const settings: Record<string, unknown> = {};
  for (const row of result.rows) {
    try {
      settings[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

/**
 * GET /api/settings/public
 * Fetch public settings (site name, description, etc.)
 * No authentication required - this is public information
 */
router.get(
  '/',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const keys = ['site_name', 'site_description', 'site_url', 'language'];
      const settings = await getSettings(keys);

      const response = {
        site_name: (settings.site_name as string) || 'Kevin Althaus',
        site_description: (settings.site_description as string) || '',
        site_url: (settings.site_url as string) || '',
        language: (settings.language as string) || 'en',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching public settings', error as Error, {});
      res.status(500).json({ error: 'Failed to fetch public settings' });
    }
  }
);

export default router;
