import { Router, Response } from 'express';
import { query, transaction } from '../db';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role } from '@monorepo/shared';
import {
  createLogger,
  LogLevel,
  validateEmail,
  validateURL,
  hashPassword, // Use bcrypt for passwords
  stripAllHTML    // Sanitize HTML content
} from '@monorepo/shared';
import { randomBytes } from 'crypto';
import { csrfProtection, attachCSRFToken } from '../middleware/csrf';
import {
  settingsRateLimit,
  apiKeyCreationRateLimit,
  emailRateLimit
} from '../middleware/rateLimit';
import { emailService } from '../services/emailService';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app-settings',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'json',
});

const router = Router();

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

// Valid timezone list (subset for validation)
const VALID_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'
  // Add more as needed or use a library like moment-timezone
];

// Valid language codes (ISO 639-1)
const VALID_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ru'];

// Valid scopes for API keys
const VALID_API_SCOPES = ['read', 'write', 'delete', 'admin', 'user:read', 'user:write', 'settings:read', 'settings:write'];

// Interfaces for settings
interface SiteSettings {
  site_name?: string;
  site_description?: string;
  site_url?: string;
  timezone?: string;
  language?: string;
}

interface SecuritySettings {
  password_min_length?: number;
  password_require_uppercase?: boolean;
  password_require_lowercase?: boolean;
  password_require_numbers?: boolean;
  password_require_special?: boolean;
  session_timeout_minutes?: number;
  max_login_attempts?: number;
  lockout_duration_minutes?: number;
  require_2fa?: boolean;
}

interface EmailSettings {
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
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

// Helper function to get multiple settings securely
async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  // Validate keys to prevent injection
  const validKeyPattern = /^[a-z_]+$/;
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
      // Parse JSON value safely
      settings[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

// Audit logging helper
async function logAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any
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
        null, // IP address should be extracted from request
        null  // User agent should be extracted from request
      ]
    );
  } catch (error) {
    logger.error('Failed to log audit event', error as Error, { action, resourceType });
  }
}

// GET /api/settings/site - Get site configuration settings
router.get(
  '/site',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const keys = ['site_name', 'site_description', 'site_url', 'timezone', 'language'];
      const settings = await getSettings(keys);

      const response: SiteSettings = {
        site_name: stripAllHTML(String(settings.site_name || 'My Site')),
        site_description: stripAllHTML(String(settings.site_description || '')),
        site_url: String(settings.site_url || ''),
        timezone: String(settings.timezone || 'UTC'),
        language: String(settings.language || 'en'),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching site settings', error as Error, {});
      res.status(500).json({ error: 'Failed to fetch site settings' });
    }
  }
);

// PUT /api/settings/site - Update site configuration settings
router.put(
  '/site',
  csrfProtection, // CSRF protection for state-changing operation
  settingsRateLimit, // Rate limiting
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { site_name, site_description, site_url, timezone, language } = req.body as SiteSettings;

      // Enhanced validation
      const errors: string[] = [];

      if (site_name !== undefined) {
        const sanitized = stripAllHTML(site_name);
        if (!sanitized || sanitized.length < 1 || sanitized.length > 100) {
          errors.push('Site name must be between 1 and 100 characters');
        }
      }

      if (site_description !== undefined) {
        const sanitized = stripAllHTML(site_description);
        if (sanitized.length > 500) {
          errors.push('Site description must not exceed 500 characters');
        }
      }

      if (site_url !== undefined && site_url !== '') {
        if (!validateURL(site_url)) {
          errors.push('Site URL must be a valid URL');
        }
        // Additional check for allowed protocols
        try {
          const url = new URL(site_url);
          if (!['http:', 'https:'].includes(url.protocol)) {
            errors.push('Site URL must use HTTP or HTTPS protocol');
          }
        } catch {
          errors.push('Site URL is invalid');
        }
      }

      if (timezone !== undefined && !VALID_TIMEZONES.includes(timezone)) {
        errors.push(`Invalid timezone. Valid options: ${VALID_TIMEZONES.join(', ')}`);
      }

      if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
        errors.push(`Invalid language code. Valid options: ${VALID_LANGUAGES.join(', ')}`);
      }

      if (errors.length > 0) {
        res.status(400).json({ error: 'Validation failed', details: errors });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Store old values for audit
      const oldSettings = await getSettings(['site_name', 'site_description', 'site_url', 'timezone', 'language']);

      await transaction(async (client) => {
        const updates = [
          { key: 'site_name', value: site_name ? stripAllHTML(site_name) : undefined },
          { key: 'site_description', value: site_description ? stripAllHTML(site_description) : undefined },
          { key: 'site_url', value: site_url },
          { key: 'timezone', value: timezone },
          { key: 'language', value: language },
        ];

        for (const update of updates) {
          if (update.value !== undefined) {
            await client.query(
              `INSERT INTO system_settings (key, value, updated_by, updated_at)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [update.key, JSON.stringify(update.value), userId]
            );
          }
        }
      });

      // Fetch updated settings
      const newSettings = await getSettings(['site_name', 'site_description', 'site_url', 'timezone', 'language']);

      // Log audit event
      await logAudit(userId, 'settings_updated', 'site_settings', 'site', {
        old: oldSettings,
        new: newSettings
      });

      const response: SiteSettings = {
        site_name: stripAllHTML(String(newSettings.site_name || 'My Site')),
        site_description: stripAllHTML(String(newSettings.site_description || '')),
        site_url: String(newSettings.site_url || ''),
        timezone: String(newSettings.timezone || 'UTC'),
        language: String(newSettings.language || 'en'),
      };

      logger.info('Site settings updated', { userId });
      res.json(response);
    } catch (error) {
      logger.error('Error updating site settings', error as Error, {});
      res.status(500).json({ error: 'Failed to update site settings' });
    }
  }
);

// GET /api/settings/security - Get security settings
router.get(
  '/security',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const keys = [
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_numbers',
        'password_require_special',
        'session_timeout_minutes',
        'max_login_attempts',
        'lockout_duration_minutes',
        'require_2fa',
      ];
      const settings = await getSettings(keys);

      const response: SecuritySettings = {
        password_min_length: Number(settings.password_min_length) || 12, // Increased default
        password_require_uppercase: Boolean(settings.password_require_uppercase ?? true),
        password_require_lowercase: Boolean(settings.password_require_lowercase ?? true),
        password_require_numbers: Boolean(settings.password_require_numbers ?? true),
        password_require_special: Boolean(settings.password_require_special ?? true), // Changed default
        session_timeout_minutes: Number(settings.session_timeout_minutes) || 30, // Reduced default
        max_login_attempts: Number(settings.max_login_attempts) || 5,
        lockout_duration_minutes: Number(settings.lockout_duration_minutes) || 30, // Increased default
        require_2fa: Boolean(settings.require_2fa ?? false),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching security settings', error as Error, {});
      res.status(500).json({ error: 'Failed to fetch security settings' });
    }
  }
);

// PUT /api/settings/security - Update security settings
router.put(
  '/security',
  csrfProtection,
  settingsRateLimit,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        password_min_length,
        password_require_uppercase,
        password_require_lowercase,
        password_require_numbers,
        password_require_special,
        session_timeout_minutes,
        max_login_attempts,
        lockout_duration_minutes,
        require_2fa,
      } = req.body as SecuritySettings;

      // Enhanced validation
      const errors: string[] = [];

      if (password_min_length !== undefined) {
        if (!Number.isInteger(password_min_length) || password_min_length < 8 || password_min_length > 128) {
          errors.push('Password minimum length must be an integer between 8 and 128');
        }
      }

      if (session_timeout_minutes !== undefined) {
        if (!Number.isInteger(session_timeout_minutes) || session_timeout_minutes < 5 || session_timeout_minutes > 1440) {
          errors.push('Session timeout must be an integer between 5 and 1440 minutes');
        }
      }

      if (max_login_attempts !== undefined) {
        if (!Number.isInteger(max_login_attempts) || max_login_attempts < 3 || max_login_attempts > 10) {
          errors.push('Max login attempts must be an integer between 3 and 10');
        }
      }

      if (lockout_duration_minutes !== undefined) {
        if (!Number.isInteger(lockout_duration_minutes) || lockout_duration_minutes < 5 || lockout_duration_minutes > 1440) {
          errors.push('Lockout duration must be an integer between 5 and 1440 minutes');
        }
      }

      if (errors.length > 0) {
        res.status(400).json({ error: 'Validation failed', details: errors });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Store old values for audit
      const oldSettings = await getSettings([
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_numbers',
        'password_require_special',
        'session_timeout_minutes',
        'max_login_attempts',
        'lockout_duration_minutes',
        'require_2fa'
      ]);

      await transaction(async (client) => {
        const updates = [
          { key: 'password_min_length', value: password_min_length },
          { key: 'password_require_uppercase', value: password_require_uppercase },
          { key: 'password_require_lowercase', value: password_require_lowercase },
          { key: 'password_require_numbers', value: password_require_numbers },
          { key: 'password_require_special', value: password_require_special },
          { key: 'session_timeout_minutes', value: session_timeout_minutes },
          { key: 'max_login_attempts', value: max_login_attempts },
          { key: 'lockout_duration_minutes', value: lockout_duration_minutes },
          { key: 'require_2fa', value: require_2fa },
        ];

        for (const update of updates) {
          if (update.value !== undefined) {
            await client.query(
              `INSERT INTO system_settings (key, value, updated_by, updated_at)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [update.key, JSON.stringify(update.value), userId]
            );
          }
        }
      });

      // Fetch updated settings
      const newSettings = await getSettings([
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_numbers',
        'password_require_special',
        'session_timeout_minutes',
        'max_login_attempts',
        'lockout_duration_minutes',
        'require_2fa'
      ]);

      // Log audit event
      await logAudit(userId, 'settings_updated', 'security_settings', 'security', {
        old: oldSettings,
        new: newSettings
      });

      const response: SecuritySettings = {
        password_min_length: Number(newSettings.password_min_length) || 12,
        password_require_uppercase: Boolean(newSettings.password_require_uppercase ?? true),
        password_require_lowercase: Boolean(newSettings.password_require_lowercase ?? true),
        password_require_numbers: Boolean(newSettings.password_require_numbers ?? true),
        password_require_special: Boolean(newSettings.password_require_special ?? true),
        session_timeout_minutes: Number(newSettings.session_timeout_minutes) || 30,
        max_login_attempts: Number(newSettings.max_login_attempts) || 5,
        lockout_duration_minutes: Number(newSettings.lockout_duration_minutes) || 30,
        require_2fa: Boolean(newSettings.require_2fa ?? false),
      };

      logger.info('Security settings updated', { userId });
      res.json(response);
    } catch (error) {
      logger.error('Error updating security settings', error as Error, {});
      res.status(500).json({ error: 'Failed to update security settings' });
    }
  }
);

// GET /api/settings/email - Get email settings
router.get(
  '/email',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const keys = [
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'smtp_user',
        'smtp_from_email',
        'smtp_from_name',
      ];
      const settings = await getSettings(keys);

      // Never send password back to client
      const response: Omit<EmailSettings, 'smtp_password'> = {
        smtp_host: String(settings.smtp_host || ''),
        smtp_port: Number(settings.smtp_port) || 587,
        smtp_secure: Boolean(settings.smtp_secure ?? false),
        smtp_user: String(settings.smtp_user || ''),
        smtp_from_email: String(settings.smtp_from_email || ''),
        smtp_from_name: stripAllHTML(String(settings.smtp_from_name || '')),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching email settings', error as Error, {});
      res.status(500).json({ error: 'Failed to fetch email settings' });
    }
  }
);

// PUT /api/settings/email - Update email settings
router.put(
  '/email',
  csrfProtection,
  settingsRateLimit,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_password,
        smtp_from_email,
        smtp_from_name,
      } = req.body as EmailSettings;

      // Enhanced validation
      const errors: string[] = [];

      if (smtp_host !== undefined) {
        const sanitized = stripAllHTML(smtp_host);
        if (!sanitized || sanitized.length > 255) {
          errors.push('SMTP host must be between 1 and 255 characters');
        }
      }

      if (smtp_port !== undefined) {
        if (!Number.isInteger(smtp_port) || smtp_port < 1 || smtp_port > 65535) {
          errors.push('SMTP port must be an integer between 1 and 65535');
        }
      }

      if (smtp_user !== undefined && smtp_user.length > 255) {
        errors.push('SMTP user must not exceed 255 characters');
      }

      if (smtp_password !== undefined && smtp_password !== '') {
        // Validate password strength for SMTP
        if (smtp_password.length < 12) {
          errors.push('SMTP password must be at least 12 characters');
        }
        if (smtp_password.length > 255) {
          errors.push('SMTP password must not exceed 255 characters');
        }
      }

      if (smtp_from_email !== undefined && smtp_from_email !== '') {
        if (!validateEmail(smtp_from_email)) {
          errors.push('SMTP from email must be a valid email address');
        }
      }

      if (smtp_from_name !== undefined) {
        const sanitized = stripAllHTML(smtp_from_name);
        if (sanitized.length > 100) {
          errors.push('SMTP from name must not exceed 100 characters');
        }
      }

      if (errors.length > 0) {
        res.status(400).json({ error: 'Validation failed', details: errors });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await transaction(async (client) => {
        const updates = [
          { key: 'smtp_host', value: smtp_host ? stripAllHTML(smtp_host) : undefined },
          { key: 'smtp_port', value: smtp_port },
          { key: 'smtp_secure', value: smtp_secure },
          { key: 'smtp_user', value: smtp_user },
          { key: 'smtp_from_email', value: smtp_from_email },
          { key: 'smtp_from_name', value: smtp_from_name ? stripAllHTML(smtp_from_name) : undefined },
        ];

        // Use bcrypt for password hashing (not SHA256)
        if (smtp_password !== undefined && smtp_password !== '') {
          const hashedPassword = await hashPassword(smtp_password);
          updates.push({ key: 'smtp_password_hash', value: hashedPassword });
        }

        for (const update of updates) {
          if (update.value !== undefined) {
            await client.query(
              `INSERT INTO system_settings (key, value, updated_by, updated_at)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [update.key, JSON.stringify(update.value), userId]
            );
          }
        }
      });

      // Log audit event (never log passwords)
      await logAudit(userId, 'settings_updated', 'email_settings', 'email', {
        updated_fields: Object.keys(req.body).filter(k => k !== 'smtp_password')
      });

      // Fetch and return updated settings (excluding password)
      const settings = await getSettings([
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'smtp_user',
        'smtp_from_email',
        'smtp_from_name',
      ]);

      const response: Omit<EmailSettings, 'smtp_password'> = {
        smtp_host: String(settings.smtp_host || ''),
        smtp_port: Number(settings.smtp_port) || 587,
        smtp_secure: Boolean(settings.smtp_secure ?? false),
        smtp_user: String(settings.smtp_user || ''),
        smtp_from_email: String(settings.smtp_from_email || ''),
        smtp_from_name: stripAllHTML(String(settings.smtp_from_name || '')),
      };

      logger.info('Email settings updated', { userId });
      res.json(response);
    } catch (error) {
      logger.error('Error updating email settings', error as Error, {});
      res.status(500).json({ error: 'Failed to update email settings' });
    }
  }
);

// POST /api/settings/email/test - Test email settings
router.post(
  '/email/test',
  csrfProtection,
  emailRateLimit, // Strict rate limiting for email operations
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const settings = await getSettings([
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'smtp_user',
        'smtp_password_hash',
        'smtp_from_email',
        'smtp_from_name',
      ]);

      const smtp_host = settings.smtp_host as string;
      const smtp_from_email = settings.smtp_from_email as string;

      if (!smtp_host || !smtp_from_email) {
        res.status(400).json({
          success: false,
          message: 'Email settings are not configured'
        });
        return;
      }

      // Get user email to send test to
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (!userResult.rows.length) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      const userEmail = userResult.rows[0].email;

      // Log audit event
      await logAudit(userId, 'email_test', 'email_settings', undefined, {
        smtp_host,
        smtp_from_email,
        test_recipient: userEmail
      });

      // Send test email
      logger.info('Sending test email', {
        smtp_host,
        smtp_from_email,
        to: userEmail,
        userId
      });

      try {
        const result = await emailService.sendTestEmail(userEmail);

        if (result.success) {
          res.json({
            success: true,
            message: `Test email sent successfully to ${userEmail}`,
            messageId: result.messageId
          });
        } else {
          res.status(500).json({
            success: false,
            message: `Failed to send test email: ${result.error || 'Unknown error'}`
          });
        }
      } catch (emailError) {
        logger.error('Failed to send test email', emailError as Error);
        res.status(500).json({
          success: false,
          message: `Email service error: ${(emailError as Error).message}`
        });
      }
    } catch (error) {
      logger.error('Error testing email settings', error as Error, {});
      res.status(500).json({
        success: false,
        message: 'Failed to test email settings'
      });
    }
  }
);

// GET /api/settings/api-keys - Get API keys
router.get(
  '/api-keys',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      if (!userId || !userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Parameterized query to prevent SQL injection
      const whereClause = userRole === Role.ADMIN
        ? 'WHERE revoked_at IS NULL'
        : 'WHERE user_id = $1 AND revoked_at IS NULL';
      const params = userRole === Role.ADMIN ? [] : [userId];

      const result = await query<ApiKey>(
        `SELECT id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at
         FROM api_keys
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT 100`, // Add pagination limit
        params
      );

      // Sanitize output
      const sanitizedKeys = result.rows.map(key => ({
        ...key,
        name: stripAllHTML(key.name),
        scopes: key.scopes.filter(scope => VALID_API_SCOPES.includes(scope))
      }));

      res.json(sanitizedKeys);
    } catch (error) {
      logger.error('Error fetching API keys', error as Error, {});
      res.status(500).json({ error: 'Failed to fetch API keys' });
    }
  }
);

// POST /api/settings/api-keys - Create a new API key
router.post(
  '/api-keys',
  csrfProtection,
  apiKeyCreationRateLimit, // Strict rate limiting
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { name, scopes = [], expires_at } = req.body as {
        name: string;
        scopes?: string[];
        expires_at?: string;
      };

      // Enhanced validation
      const errors: string[] = [];

      if (!name || typeof name !== 'string') {
        errors.push('API key name is required');
      } else {
        const sanitizedName = stripAllHTML(name);
        if (sanitizedName.length < 3 || sanitizedName.length > 100) {
          errors.push('API key name must be between 3 and 100 characters');
        }
      }

      if (!Array.isArray(scopes)) {
        errors.push('Scopes must be an array');
      } else {
        // Validate scopes against allowed list
        for (const scope of scopes) {
          if (!VALID_API_SCOPES.includes(scope)) {
            errors.push(`Invalid scope: ${scope}. Valid scopes: ${VALID_API_SCOPES.join(', ')}`);
          }
        }
      }

      if (expires_at) {
        const expiryDate = new Date(expires_at);
        if (isNaN(expiryDate.getTime())) {
          errors.push('Expires at must be a valid ISO date');
        } else if (expiryDate <= new Date()) {
          errors.push('Expiry date must be in the future');
        } else if (expiryDate > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) {
          errors.push('Expiry date cannot be more than 1 year in the future');
        }
      }

      if (errors.length > 0) {
        res.status(400).json({ error: 'Validation failed', details: errors });
        return;
      }

      // Generate cryptographically secure API key
      const keyBytes = randomBytes(32);
      const apiKey = `sk_${keyBytes.toString('base64url')}`;
      const key_prefix = apiKey.substring(0, 11); // 'sk_' + first 8 chars

      // Use bcrypt for key hashing (more secure than SHA256)
      const key_hash = await hashPassword(apiKey);

      // Insert API key into database
      const result = await query<ApiKey>(
        `INSERT INTO api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at`,
        [
          userId,
          stripAllHTML(name),
          key_prefix,
          key_hash,
          JSON.stringify(scopes.filter(s => VALID_API_SCOPES.includes(s))),
          expires_at || null
        ]
      );

      const keyData = result.rows[0];

      // Log audit event
      await logAudit(userId, 'api_key_created', 'api_key', keyData.id, {
        name: stripAllHTML(name),
        scopes,
        expires_at
      });

      logger.info('API key created', {
        userId,
        keyId: keyData.id,
        name: stripAllHTML(name)
      });

      // Return the key ONCE - never log it
      res.json({
        key: apiKey, // Only time the full key is shown
        ...keyData,
        name: stripAllHTML(keyData.name)
      });
    } catch (error) {
      logger.error('Error creating API key', error as Error, {});
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
);

// DELETE /api/settings/api-keys/:id - Revoke an API key
router.delete(
  '/api-keys/:id',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      if (!userId || !userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Validate ID format (prevent injection)
      if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        res.status(400).json({ error: 'Invalid API key ID format' });
        return;
      }

      // Check ownership with parameterized query
      const keyResult = await query<{ user_id: string; name: string }>(
        'SELECT user_id, name FROM api_keys WHERE id = $1 AND revoked_at IS NULL',
        [id]
      );

      if (keyResult.rows.length === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      const keyData = keyResult.rows[0];

      // Authorization check
      if (keyData.user_id !== userId && userRole !== Role.ADMIN) {
        res.status(403).json({ error: 'Not authorized to revoke this API key' });
        return;
      }

      // Revoke the key (soft delete)
      await query(
        'UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      // Log audit event
      await logAudit(userId, 'api_key_revoked', 'api_key', id, {
        name: keyData.name,
        owner_id: keyData.user_id
      });

      logger.info('API key revoked', {
        userId,
        keyId: id,
        name: keyData.name
      });

      res.json({ success: true, message: 'API key revoked successfully' });
    } catch (error) {
      logger.error('Error revoking API key', error as Error, {});
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  }
);

// GET /api/settings/csrf-token - Get CSRF token
router.get(
  '/csrf-token',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    // CSRF token is automatically attached by attachCSRFToken middleware
    res.json({
      csrfToken: res.getHeader('X-CSRF-Token'),
      message: 'Include this token in X-CSRF-Token header for state-changing requests'
    });
  }
);

export default router;