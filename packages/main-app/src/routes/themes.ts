import { Router, Response } from 'express';
import { query, transaction } from '../db';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role } from '@monorepo/shared';
import { createLogger, LogLevel } from '@monorepo/shared';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));

// Paths for theme files
const ADMIN_THEME_PATH = path.join(process.cwd(), 'public', 'admin-theme-overrides.css');
const FRONTEND_THEME_PATH = path.join(process.cwd(), 'public', 'frontend-theme-overrides.css');

// GET /api/themes/config - Get current theme configuration
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT config_value FROM settings WHERE config_key = 'theme_config' LIMIT 1`
    );

    if (result.rows.length > 0) {
      const config = JSON.parse(result.rows[0].config_value);
      res.json(config);
    } else {
      res.json({});
    }
  } catch (error) {
    logger.error('Error fetching theme config', error as Error);
    res.status(500).json({ error: 'Failed to fetch theme configuration' });
  }
});

// POST /api/themes/save - Save theme configuration
router.post('/save', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target, config, css } = req.body;

    if (!target || !['admin', 'frontend', 'both'].includes(target)) {
      return res.status(400).json({ error: 'Invalid target. Must be admin, frontend, or both' });
    }

    // Save CSS files
    const cssPath = target === 'admin' ? ADMIN_THEME_PATH : FRONTEND_THEME_PATH;

    if (css) {
      await fs.mkdir(path.dirname(cssPath), { recursive: true });
      await fs.writeFile(cssPath, css, 'utf-8');
    }

    // Save configuration to database
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO settings (config_key, config_value, updated_at)
         VALUES ('theme_config', $1, NOW())
         ON CONFLICT (config_key)
         DO UPDATE SET config_value = $1, updated_at = NOW()`,
        [JSON.stringify(config || {})]
      );

      await client.query(
        `INSERT INTO settings (config_key, config_value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (config_key)
         DO UPDATE SET config_value = $2, updated_at = NOW()`,
        [`theme_css_path_${target}`, `/${target}-theme-overrides.css`]
      );
    });

    logger.info('Theme saved successfully', { userId: req.user?.id, target });
    res.json({
      message: 'Theme saved successfully',
      cssPath: `/${target}-theme-overrides.css`
    });
  } catch (error) {
    logger.error('Error saving theme', error as Error);
    res.status(500).json({ error: 'Failed to save theme' });
  }
});

// POST /api/themes/reset - Reset theme to default
router.post('/reset', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target } = req.body;

    if (!target || !['admin', 'frontend', 'both'].includes(target)) {
      return res.status(400).json({ error: 'Invalid target' });
    }

    // Delete CSS files
    const paths = target === 'both'
      ? [ADMIN_THEME_PATH, FRONTEND_THEME_PATH]
      : [target === 'admin' ? ADMIN_THEME_PATH : FRONTEND_THEME_PATH];

    for (const cssPath of paths) {
      try {
        await fs.unlink(cssPath);
      } catch {
        // Ignore if file doesn't exist
      }
    }

    // Delete from database
    await query(
      `DELETE FROM settings WHERE config_key IN ('theme_config', 'theme_css_path_admin', 'theme_css_path_frontend')`
    );

    logger.info('Theme reset to default', { userId: req.user?.id, target });
    res.json({ message: 'Theme reset successfully' });
  } catch (error) {
    logger.error('Error resetting theme', error as Error);
    res.status(500).json({ error: 'Failed to reset theme' });
  }
});

export default router;
