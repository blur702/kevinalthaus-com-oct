/**
 * Public settings endpoints - no authentication required
 * Used by frontend to fetch public configuration like site name
 */

import { Router, Response, Request } from 'express';
import { defaultLogger as logger } from '@monorepo/shared';
import { query } from '../db';
import { Sentry, isSentryEnabled } from '../instrument';

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

const PUBLIC_SETTINGS_CACHE_MS = Number(process.env.PUBLIC_SETTINGS_CACHE_MS || 60000);
const PUBLIC_SETTINGS_CACHE_S = Math.max(1, Math.floor(PUBLIC_SETTINGS_CACHE_MS / 1000));

type PublicSettingsResponse = {
  site_name: string;
  site_description: string;
  site_url: string;
  language: string;
};

let cachedResponse: { data: PublicSettingsResponse; expiresAt: number } | null = null;

async function getPublicSettings(): Promise<PublicSettingsResponse> {
  const now = Date.now();
  if (cachedResponse && cachedResponse.expiresAt > now) {
    return cachedResponse.data;
  }

  const keys = ['site_name', 'site_description', 'site_url', 'language'];
  const settings = await getSettings(keys);

  const response: PublicSettingsResponse = {
    site_name: (settings.site_name as string) || 'Kevin Althaus',
    site_description: (settings.site_description as string) || '',
    site_url: (settings.site_url as string) || '',
    language: (settings.language as string) || 'en',
  };

  cachedResponse = {
    data: response,
    expiresAt: now + PUBLIC_SETTINGS_CACHE_MS,
  };

  return response;
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
      const response = await getPublicSettings();
      res.setHeader('Cache-Control', `public, max-age=${PUBLIC_SETTINGS_CACHE_S}`);
      res.json(response);
    } catch (error) {
      logger.error('Error fetching public settings', error as Error, {});
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({ error: 'Failed to fetch public settings' });
    }
  }
);

export default router;
