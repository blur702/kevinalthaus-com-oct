/**
 * Plugin settings handlers (GET/PUT)
 * Manages USPS API key and other plugin configuration
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';
import type { PluginSettings } from '../types';

/**
 * Get plugin settings handler
 */
export function getSettingsHandler(context: PluginExecutionContext) {
  return async (_req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      logger.info('Getting plugin settings');

      // Query settings from database
      const query = `
        SELECT key, value, category
        FROM plugin_ssdd_validator.settings
        WHERE category = 'plugin'
      `;

      const result = await pool.query<{ key: string; value: string; category: string }>(query);

      // Parse settings into PluginSettings object
      const settings: PluginSettings = {
        uspsApiKeyConfigured: false,
        pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://python-service:8000',
      };

      for (const row of result.rows) {
        switch (row.key) {
          case 'usps_api_key':
            settings.uspsApiKeyConfigured = !!row.value && row.value.length > 0;
            // Don't send the actual API key to the client
            break;
          case 'last_member_sync':
            if (row.value) {
              settings.lastMemberSync = new Date(row.value);
            }
            break;
          default:
            break;
        }
      }

      logger.info('Settings retrieved successfully', {
        uspsApiKeyConfigured: settings.uspsApiKeyConfigured,
        lastMemberSync: settings.lastMemberSync,
      });

      res.status(200).json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error('Error getting plugin settings', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while getting settings',
      });
    }
  };
}

/**
 * Update plugin settings handler
 */
export function updateSettingsHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      const { uspsApiKey } = req.body as { uspsApiKey?: string };

      // Validate input
      if (!uspsApiKey || typeof uspsApiKey !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid uspsApiKey. Must be a non-empty string',
        });
        return;
      }

      // Sanitize API key (strip HTML but preserve special characters)
      const sanitizedApiKey = uspsApiKey.trim();

      if (sanitizedApiKey.length === 0) {
        res.status(400).json({
          success: false,
          error: 'USPS API key cannot be empty',
        });
        return;
      }

      logger.info('Updating plugin settings (USPS API key)');

      // Upsert USPS API key
      const upsertQuery = `
        INSERT INTO plugin_ssdd_validator.settings (key, value, category, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key, category)
        DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
        RETURNING key, category
      `;

      await pool.query(upsertQuery, [
        'usps_api_key',
        sanitizedApiKey,
        'plugin',
        'USPS Web Tools API Key for address validation',
      ]);

      logger.info('USPS API key updated successfully');

      // Return updated settings (without exposing the actual key)
      const settings: PluginSettings = {
        uspsApiKeyConfigured: true,
        pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://python-service:8000',
      };

      res.status(200).json({
        success: true,
        settings,
        message: 'USPS API key updated successfully',
      });
    } catch (error) {
      logger.error('Error updating plugin settings', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while updating settings',
      });
    }
  };
}

