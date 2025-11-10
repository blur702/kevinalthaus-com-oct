/**
 * Unified Settings Routes
 *
 * Merged implementation combining security features from settings-secure.ts
 * with new integrations (Vault, Brevo, Redis rate limiting, settings cache).
 *
 * Security Features:
 * - CSRF protection on all state-changing operations
 * - Redis-based rate limiting with fallback
 * - Input validation and sanitization
 * - Audit logging for all changes
 * - Vault integration for sensitive credentials
 * - Settings cache invalidation on updates
 *
 * Issues Fixed:
 * #1: Security settings now enforced via settings cache
 * #2: Brevo API keys stored in Vault (encrypted)
 * #3: CSRF protection implemented
 * #4: Redis-based rate limiting implemented
 */

import { Router, Response } from 'express';
import { query } from '../db';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role } from '@monorepo/shared';
import {
  createLogger,
  LogLevel,
  validateEmail,
  validateURL,
  stripAllHTML
} from '@monorepo/shared';
import { randomBytes } from 'crypto';
import { csrfProtection, attachCSRFToken } from '../middleware/csrf';
import {
  settingsRateLimit,
  apiKeyCreationRateLimit,
  emailRateLimit,
  initializeRedisRateLimiter
} from '../middleware/rateLimitRedis';
import { secretsService } from '../services/secretsService';
import { emailService } from '../services/emailService';
import { settingsCacheService } from '../services/settingsCacheService';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'settings-service',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'json',
});

const router = Router();

// Initialize Redis rate limiter on module load
initializeRedisRateLimiter();

// Security headers middleware
router.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  next();
});

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));
router.use(attachCSRFToken); // Attach CSRF token to responses

// Validation constants
const VALID_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'
];

const VALID_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ru'];
const VALID_API_SCOPES = ['read', 'write', 'delete', 'admin', 'user:read', 'user:write', 'settings:read', 'settings:write'];

// Interfaces
interface SiteSettings {
  site_name?: string;
  site_description?: string;
  site_url?: string;
  timezone?: string;
  language?: string;
}

interface EmailSettings {
  brevo_api_key?: string; // Stored in Vault
  smtp_from_email?: string;
  smtp_from_name?: string;
}

interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

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

// Helper: Update setting and invalidate cache
async function updateSetting(
  key: string,
  value: unknown,
  userId: string
): Promise<void> {
  await query(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key)
     DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, JSON.stringify(value), userId]
  );

  // Invalidate cache for this setting
  settingsCacheService.invalidateCache(key);

  logger.info('Setting updated', { key, userId });
}

// Helper: Audit logging
async function logAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any,
  req?: AuthenticatedRequest
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        userId,
        action,
        resourceType,
        resourceId || null,
        JSON.stringify(details || {}),
        req?.ip || null,
        req?.get('User-Agent') || null
      ]
    );
  } catch (error) {
    logger.error('Failed to log audit', error as Error);
  }
}

// ============================================================================
// SITE SETTINGS
// ============================================================================

router.get('/site', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await getSettings([
      'site_name',
      'site_description',
      'site_url',
      'timezone',
      'language'
    ]);

    res.json({
      site_name: settings.site_name || '',
      site_description: settings.site_description || '',
      site_url: settings.site_url || '',
      timezone: settings.timezone || 'UTC',
      language: settings.language || 'en'
    });
  } catch (error) {
    logger.error('Failed to get site settings', error as Error);
    res.status(500).json({
      error: 'Failed to retrieve site settings',
      message: (error as Error).message
    });
  }
});

router.put('/site', csrfProtection, settingsRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { site_name, site_description, site_url, timezone, language } = req.body as SiteSettings;
    const userId = req.user!.userId!;

    // Validation
    if (site_name && (typeof site_name !== 'string' || site_name.length > 100)) {
      res.status(400).json({ error: 'Invalid site_name' });
      return;
    }

    if (site_description && (typeof site_description !== 'string' || site_description.length > 500)) {
      res.status(400).json({ error: 'Invalid site_description' });
      return;
    }

    if (site_url && !validateURL(site_url)) {
      res.status(400).json({ error: 'Invalid site_url' });
      return;
    }

    if (timezone && !VALID_TIMEZONES.includes(timezone)) {
      res.status(400).json({ error: 'Invalid timezone' });
      return;
    }

    if (language && !VALID_LANGUAGES.includes(language)) {
      res.status(400).json({ error: 'Invalid language' });
      return;
    }

    // Update settings
    if (site_name !== undefined) {await updateSetting('site_name', stripAllHTML(site_name), userId);}
    if (site_description !== undefined) {await updateSetting('site_description', stripAllHTML(site_description), userId);}
    if (site_url !== undefined) {await updateSetting('site_url', site_url, userId);}
    if (timezone !== undefined) {await updateSetting('timezone', timezone, userId);}
    if (language !== undefined) {await updateSetting('language', language, userId);}

    await logAudit(userId, 'UPDATE', 'settings', 'site', { site_name, site_description, site_url, timezone, language }, req);

    res.json({ message: 'Site settings updated successfully' });
  } catch (error) {
    logger.error('Failed to update site settings', error as Error);
    res.status(500).json({
      error: 'Failed to update site settings',
      message: (error as Error).message
    });
  }
});

// ============================================================================
// SECURITY SETTINGS
// ============================================================================

router.get('/security', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await getSettings([
      'security.password_policy',
      'security.jwt_config',
      'security.session_config',
      'security.login_security'
    ]);

    res.json({
      password_policy: settings['security.password_policy'] || {},
      jwt_config: settings['security.jwt_config'] || {},
      session_config: settings['security.session_config'] || {},
      login_security: settings['security.login_security'] || {}
    });
  } catch (error) {
    logger.error('Failed to get security settings', error as Error);
    res.status(500).json({
      error: 'Failed to retrieve security settings',
      message: (error as Error).message
    });
  }
});

router.put('/security', csrfProtection, settingsRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { password_policy, jwt_config, session_config, login_security } = req.body;
    const userId = req.user!.userId!;

    // Validation for password policy
    if (password_policy) {
      if (password_policy.minLength && (password_policy.minLength < 8 || password_policy.minLength > 128)) {
        res.status(400).json({ error: 'Password min length must be between 8 and 128' });
        return;
      }
    }

    // Update settings
    if (password_policy) {await updateSetting('security.password_policy', password_policy, userId);}
    if (jwt_config) {await updateSetting('security.jwt_config', jwt_config, userId);}
    if (session_config) {await updateSetting('security.session_config', session_config, userId);}
    if (login_security) {await updateSetting('security.login_security', login_security, userId);}

    // Refresh the entire settings cache to ensure auth system picks up changes
    await settingsCacheService.refreshCache();

    await logAudit(userId, 'UPDATE', 'settings', 'security', { password_policy, jwt_config, session_config, login_security }, req);

    res.json({ message: 'Security settings updated successfully' });
  } catch (error) {
    logger.error('Failed to update security settings', error as Error);
    res.status(500).json({
      error: 'Failed to update security settings',
      message: (error as Error).message
    });
  }
});

// ============================================================================
// EMAIL SETTINGS (Brevo Integration)
// ============================================================================

router.get('/email', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await getSettings([
      'email.brevo_api_key_vault_path',
      'email.smtp_from_email',
      'email.smtp_from_name'
    ]);

    // Don't return the API key, just indicate if it's configured
    res.json({
      brevo_configured: !!settings['email.brevo_api_key_vault_path'],
      smtp_from_email: settings['email.smtp_from_email'] || '',
      smtp_from_name: settings['email.smtp_from_name'] || ''
    });
  } catch (error) {
    logger.error('Failed to get email settings', error as Error);
    res.status(500).json({
      error: 'Failed to retrieve email settings',
      message: (error as Error).message
    });
  }
});

router.put('/email', csrfProtection, settingsRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { brevo_api_key, smtp_from_email, smtp_from_name } = req.body as EmailSettings;
    const userId = req.user!.userId!;

    // Validation
    if (smtp_from_email && !validateEmail(smtp_from_email)) {
      res.status(400).json({ error: 'Invalid smtp_from_email' });
      return;
    }

    // Store Brevo API key in Vault if provided
    if (brevo_api_key) {
      const vaultPath = process.env.BREVO_API_KEY_VAULT_PATH || 'secret/email/brevo';

      try {
        await secretsService.storeSecret(vaultPath, brevo_api_key, { type: 'brevo_api_key' }, userId);
        await updateSetting('email.brevo_api_key_vault_path', vaultPath, userId);

        logger.info('Brevo API key stored in Vault', { userId, vaultPath });
      } catch (error) {
        logger.error('Failed to store Brevo API key in Vault', error as Error);
        res.status(500).json({
          error: 'Failed to store Brevo API key',
          message: (error as Error).message
        });
        return;
      }
    }

    // Update other email settings
    if (smtp_from_email !== undefined) {await updateSetting('email.smtp_from_email', smtp_from_email, userId);}
    if (smtp_from_name !== undefined) {await updateSetting('email.smtp_from_name', stripAllHTML(smtp_from_name), userId);}

    await logAudit(userId, 'UPDATE', 'settings', 'email', { brevo_configured: !!brevo_api_key, smtp_from_email, smtp_from_name }, req);

    res.json({ message: 'Email settings updated successfully' });
  } catch (error) {
    logger.error('Failed to update email settings', error as Error);
    res.status(500).json({
      error: 'Failed to update email settings',
      message: (error as Error).message
    });
  }
});

// Test email endpoint
router.post('/email/test', csrfProtection, emailRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { recipient_email } = req.body;
    const userId = req.user!.userId!;

    if (!recipient_email || !validateEmail(recipient_email)) {
      res.status(400).json({ error: 'Valid recipient_email is required' });
      return;
    }

    // Initialize email service and send test email
    await emailService.initialize();
    const result = await emailService.sendTestEmail(recipient_email);

    if (result.success) {
      await logAudit(userId, 'SEND_TEST_EMAIL', 'email', recipient_email, { messageId: result.messageId }, req);

      res.json({
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        error: 'Failed to send test email',
        message: result.error || 'Unknown error'
      });
    }
  } catch (error) {
    logger.error('Failed to send test email', error as Error);
    res.status(500).json({
      error: 'Failed to send test email',
      message: (error as Error).message
    });
  }
});

// ============================================================================
// API KEYS
// ============================================================================

router.get('/api-keys', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId!;

    const result = await query<ApiKey>(
      `SELECT id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ api_keys: result.rows });
  } catch (error) {
    logger.error('Failed to get API keys', error as Error);
    res.status(500).json({
      error: 'Failed to retrieve API keys',
      message: (error as Error).message
    });
  }
});

router.post('/api-keys', csrfProtection, apiKeyCreationRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, scopes, expires_in_days } = req.body;
    const userId = req.user!.userId!;

    // Validation
    if (!name || typeof name !== 'string' || name.length > 100) {
      res.status(400).json({ error: 'Valid name is required' });
      return;
    }

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      res.status(400).json({ error: 'At least one scope is required' });
      return;
    }

    // Validate scopes
    for (const scope of scopes) {
      if (!VALID_API_SCOPES.includes(scope)) {
        res.status(400).json({ error: `Invalid scope: ${scope}` });
        return;
      }
    }

    // Generate API key
    const apiKey = `ka_${randomBytes(32).toString('hex')}`;
    const keyPrefix = apiKey.substring(0, 10);

    // Calculate expiry
    let expiresAt: Date | null = null;
    if (expires_in_days && typeof expires_in_days === 'number' && expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    // Store API key in Vault
    const vaultPath = `secret/api-keys/${userId}/${keyPrefix}`;
    await secretsService.storeSecret(vaultPath, apiKey, { name, scopes, user_id: userId }, userId);

    // Store metadata in database
    await query(
      `INSERT INTO api_keys (user_id, name, key_prefix, scopes, expires_at, vault_path, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, name, keyPrefix, JSON.stringify(scopes), expiresAt, vaultPath]
    );

    await logAudit(userId, 'CREATE', 'api_key', keyPrefix, { name, scopes, expires_at: expiresAt }, req);

    res.status(201).json({
      message: 'API key created successfully',
      api_key: apiKey, // Only returned once
      key_prefix: keyPrefix,
      scopes,
      expires_at: expiresAt
    });
  } catch (error) {
    logger.error('Failed to create API key', error as Error);
    res.status(500).json({
      error: 'Failed to create API key',
      message: (error as Error).message
    });
  }
});

router.delete('/api-keys/:id', csrfProtection, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId!;

    await query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    await logAudit(userId, 'DELETE', 'api_key', id, {}, req);

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete API key', error as Error);
    res.status(500).json({
      error: 'Failed to delete API key',
      message: (error as Error).message
    });
  }
});

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

router.post('/cache/reload', csrfProtection, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId!;

    await settingsCacheService.refreshCache();

    await logAudit(userId, 'RELOAD_CACHE', 'settings', 'cache', {}, req);

    res.json({
      message: 'Settings cache reloaded successfully',
      stats: settingsCacheService.getCacheStats()
    });
  } catch (error) {
    logger.error('Failed to reload cache', error as Error);
    res.status(500).json({
      error: 'Failed to reload cache',
      message: (error as Error).message
    });
  }
});

export default router;
