import { Router, Response } from 'express';
import { query, transaction } from '../db';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role } from '@monorepo/shared';
import { createLogger, LogLevel, validateEmail, validateURL, hashSHA256 } from '@monorepo/shared';
import { randomBytes } from 'crypto';
import { emailService } from '../services/emailService';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));

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
  brevo_api_key?: string;
  brevo_from_email?: string;
  brevo_from_name?: string;
  email_provider?: 'smtp' | 'brevo';
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

// Helper function to get multiple settings
async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const result = await query<{ key: string; value: unknown }>(
    'SELECT key, value FROM system_settings WHERE key = ANY($1)',
    [keys]
  );

  const settings: Record<string, unknown> = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  return settings;
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
        site_name: (settings.site_name as string) || 'My Site',
        site_description: (settings.site_description as string) || '',
        site_url: (settings.site_url as string) || '',
        timezone: (settings.timezone as string) || 'UTC',
        language: (settings.language as string) || 'en',
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
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { site_name, site_description, site_url, timezone, language } = req.body as SiteSettings;

      // Validation
      if (site_name !== undefined) {
        if (typeof site_name !== 'string' || site_name.length < 1 || site_name.length > 100) {
          res.status(400).json({ error: 'Site name must be between 1 and 100 characters' });
          return;
        }
      }

      if (site_description !== undefined) {
        if (typeof site_description !== 'string' || site_description.length > 500) {
          res.status(400).json({ error: 'Site description must not exceed 500 characters' });
          return;
        }
      }

      if (site_url !== undefined) {
        if (typeof site_url !== 'string' || (site_url && !validateURL(site_url))) {
          res.status(400).json({ error: 'Site URL must be a valid URL' });
          return;
        }
      }

      if (timezone !== undefined && typeof timezone !== 'string') {
        res.status(400).json({ error: 'Timezone must be a string' });
        return;
      }

      if (language !== undefined && typeof language !== 'string') {
        res.status(400).json({ error: 'Language must be a string' });
        return;
      }

      // Update settings
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await transaction(async (client) => {
        const updates = [
          { key: 'site_name', value: site_name },
          { key: 'site_description', value: site_description },
          { key: 'site_url', value: site_url },
          { key: 'timezone', value: timezone },
          { key: 'language', value: language },
        ];

        for (const update of updates) {
          if (update.value !== undefined) {
            await client.query(
              `INSERT INTO system_settings (key, value, updated_by, updated_at)
               VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [update.key, JSON.stringify(update.value), userId]
            );
          }
        }
      });

      // Fetch and return updated settings
      const keys = ['site_name', 'site_description', 'site_url', 'timezone', 'language'];
      const settings = await getSettings(keys);

      const response: SiteSettings = {
        site_name: (settings.site_name as string) || 'My Site',
        site_description: (settings.site_description as string) || '',
        site_url: (settings.site_url as string) || '',
        timezone: (settings.timezone as string) || 'UTC',
        language: (settings.language as string) || 'en',
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
        password_min_length: (settings.password_min_length as number) || 8,
        password_require_uppercase: (settings.password_require_uppercase as boolean) ?? true,
        password_require_lowercase: (settings.password_require_lowercase as boolean) ?? true,
        password_require_numbers: (settings.password_require_numbers as boolean) ?? true,
        password_require_special: (settings.password_require_special as boolean) ?? false,
        session_timeout_minutes: (settings.session_timeout_minutes as number) || 60,
        max_login_attempts: (settings.max_login_attempts as number) || 5,
        lockout_duration_minutes: (settings.lockout_duration_minutes as number) || 15,
        require_2fa: (settings.require_2fa as boolean) ?? false,
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

      // Validation
      if (password_min_length !== undefined) {
        if (typeof password_min_length !== 'number' || password_min_length < 8 || password_min_length > 128) {
          res.status(400).json({ error: 'Password minimum length must be between 8 and 128' });
          return;
        }
      }

      if (password_require_uppercase !== undefined && typeof password_require_uppercase !== 'boolean') {
        res.status(400).json({ error: 'Password require uppercase must be a boolean' });
        return;
      }

      if (password_require_lowercase !== undefined && typeof password_require_lowercase !== 'boolean') {
        res.status(400).json({ error: 'Password require lowercase must be a boolean' });
        return;
      }

      if (password_require_numbers !== undefined && typeof password_require_numbers !== 'boolean') {
        res.status(400).json({ error: 'Password require numbers must be a boolean' });
        return;
      }

      if (password_require_special !== undefined && typeof password_require_special !== 'boolean') {
        res.status(400).json({ error: 'Password require special characters must be a boolean' });
        return;
      }

      if (session_timeout_minutes !== undefined) {
        if (typeof session_timeout_minutes !== 'number' || session_timeout_minutes < 15 || session_timeout_minutes > 1440) {
          res.status(400).json({ error: 'Session timeout must be between 15 and 1440 minutes' });
          return;
        }
      }

      if (max_login_attempts !== undefined) {
        if (typeof max_login_attempts !== 'number' || max_login_attempts < 3 || max_login_attempts > 10) {
          res.status(400).json({ error: 'Max login attempts must be between 3 and 10' });
          return;
        }
      }

      if (lockout_duration_minutes !== undefined) {
        if (typeof lockout_duration_minutes !== 'number' || lockout_duration_minutes < 5 || lockout_duration_minutes > 60) {
          res.status(400).json({ error: 'Lockout duration must be between 5 and 60 minutes' });
          return;
        }
      }

      if (require_2fa !== undefined && typeof require_2fa !== 'boolean') {
        res.status(400).json({ error: 'Require 2FA must be a boolean' });
        return;
      }

      // Update settings
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

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
               VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [update.key, JSON.stringify(update.value), userId]
            );
          }
        }
      });

      // Fetch and return updated settings
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
        password_min_length: (settings.password_min_length as number) || 8,
        password_require_uppercase: (settings.password_require_uppercase as boolean) ?? true,
        password_require_lowercase: (settings.password_require_lowercase as boolean) ?? true,
        password_require_numbers: (settings.password_require_numbers as boolean) ?? true,
        password_require_special: (settings.password_require_special as boolean) ?? false,
        session_timeout_minutes: (settings.session_timeout_minutes as number) || 60,
        max_login_attempts: (settings.max_login_attempts as number) || 5,
        lockout_duration_minutes: (settings.lockout_duration_minutes as number) || 15,
        require_2fa: (settings.require_2fa as boolean) ?? false,
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
        'email_provider',
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'smtp_user',
        'smtp_from_email',
        'smtp_from_name',
        'brevo_from_email',
        'brevo_from_name',
      ];
      const settings = await getSettings(keys);

      const response: Omit<EmailSettings, 'smtp_password' | 'brevo_api_key'> = {
        email_provider: (settings.email_provider as 'smtp' | 'brevo') || 'brevo',
        smtp_host: (settings.smtp_host as string) || '',
        smtp_port: (settings.smtp_port as number) || 587,
        smtp_secure: (settings.smtp_secure as boolean) ?? false,
        smtp_user: (settings.smtp_user as string) || '',
        smtp_from_email: (settings.smtp_from_email as string) || '',
        smtp_from_name: (settings.smtp_from_name as string) || '',
        brevo_from_email: (settings.brevo_from_email as string) || '',
        brevo_from_name: (settings.brevo_from_name as string) || '',
      };

      // Note: smtp_password and brevo_api_key are intentionally excluded for security
      // Check if Brevo API key is configured (without exposing it)
      const brevoKeyResult = await query<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = $1',
        ['brevo_api_key']
      );
      (response as { brevo_api_key_configured?: boolean }).brevo_api_key_configured = brevoKeyResult.rows.length > 0;

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
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        email_provider,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_password,
        smtp_from_email,
        smtp_from_name,
        brevo_api_key,
        brevo_from_email,
        brevo_from_name,
      } = req.body as EmailSettings;

      // Validation
      if (smtp_host !== undefined && typeof smtp_host !== 'string') {
        res.status(400).json({ error: 'SMTP host must be a string' });
        return;
      }

      if (smtp_port !== undefined) {
        if (typeof smtp_port !== 'number' || smtp_port < 1 || smtp_port > 65535) {
          res.status(400).json({ error: 'SMTP port must be between 1 and 65535' });
          return;
        }
      }

      if (smtp_secure !== undefined && typeof smtp_secure !== 'boolean') {
        res.status(400).json({ error: 'SMTP secure must be a boolean' });
        return;
      }

      if (smtp_user !== undefined && typeof smtp_user !== 'string') {
        res.status(400).json({ error: 'SMTP user must be a string' });
        return;
      }

      if (smtp_password !== undefined && typeof smtp_password !== 'string') {
        res.status(400).json({ error: 'SMTP password must be a string' });
        return;
      }

      if (smtp_from_email !== undefined) {
        if (typeof smtp_from_email !== 'string' || (smtp_from_email && !validateEmail(smtp_from_email))) {
          res.status(400).json({ error: 'SMTP from email must be a valid email address' });
          return;
        }
      }

      if (smtp_from_name !== undefined && typeof smtp_from_name !== 'string') {
        res.status(400).json({ error: 'SMTP from name must be a string' });
        return;
      }

      // Brevo validation
      if (email_provider !== undefined && email_provider !== 'smtp' && email_provider !== 'brevo') {
        res.status(400).json({ error: 'Email provider must be either "smtp" or "brevo"' });
        return;
      }

      if (brevo_api_key !== undefined && typeof brevo_api_key !== 'string') {
        res.status(400).json({ error: 'Brevo API key must be a string' });
        return;
      }

      if (brevo_from_email !== undefined) {
        if (typeof brevo_from_email !== 'string' || (brevo_from_email && !validateEmail(brevo_from_email))) {
          res.status(400).json({ error: 'Brevo from email must be a valid email address' });
          return;
        }
      }

      if (brevo_from_name !== undefined && typeof brevo_from_name !== 'string') {
        res.status(400).json({ error: 'Brevo from name must be a string' });
        return;
      }

      // Update settings
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await transaction(async (client) => {
        const updates = [
          { key: 'email_provider', value: email_provider },
          { key: 'smtp_host', value: smtp_host },
          { key: 'smtp_port', value: smtp_port },
          { key: 'smtp_secure', value: smtp_secure },
          { key: 'smtp_user', value: smtp_user },
          { key: 'smtp_from_email', value: smtp_from_email },
          { key: 'smtp_from_name', value: smtp_from_name },
          { key: 'brevo_from_email', value: brevo_from_email },
          { key: 'brevo_from_name', value: brevo_from_name },
        ];

        // Hash password if provided
        if (smtp_password !== undefined && smtp_password !== '') {
          updates.push({ key: 'smtp_password', value: hashSHA256(smtp_password) });
        }

        // Store Brevo API key if provided
        // Note: Unlike passwords, API keys must be stored retrievably since they're needed for API calls
        // Security is enforced through admin-only access and database encryption at rest
        if (brevo_api_key !== undefined && brevo_api_key !== '') {
          updates.push({ key: 'brevo_api_key', value: brevo_api_key });
        }

        for (const update of updates) {
          if (update.value !== undefined) {
            await client.query(
              `INSERT INTO system_settings (key, value, updated_by, updated_at)
               VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [update.key, JSON.stringify(update.value), userId]
            );
          }
        }
      });

      // Fetch and return updated settings (excluding password and API key)
      const keys = [
        'email_provider',
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'smtp_user',
        'smtp_from_email',
        'smtp_from_name',
        'brevo_from_email',
        'brevo_from_name',
      ];
      const settings = await getSettings(keys);

      const response: Omit<EmailSettings, 'smtp_password' | 'brevo_api_key'> = {
        email_provider: (settings.email_provider as 'smtp' | 'brevo') || 'brevo',
        smtp_host: (settings.smtp_host as string) || '',
        smtp_port: (settings.smtp_port as number) || 587,
        smtp_secure: (settings.smtp_secure as boolean) ?? false,
        smtp_user: (settings.smtp_user as string) || '',
        smtp_from_email: (settings.smtp_from_email as string) || '',
        smtp_from_name: (settings.smtp_from_name as string) || '',
        brevo_from_email: (settings.brevo_from_email as string) || '',
        brevo_from_name: (settings.brevo_from_name as string) || '',
      };

      // Check if Brevo API key is configured (without exposing it)
      const brevoKeyResult = await query<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = $1',
        ['brevo_api_key']
      );
      (response as { brevo_api_key_configured?: boolean }).brevo_api_key_configured = brevoKeyResult.rows.length > 0;

      // Reload email service if API key was updated
      if (brevo_api_key !== undefined && brevo_api_key !== '') {
        try {
          await emailService.reloadConfiguration();
          logger.info('Email service reloaded with new API key', { userId });
        } catch (reloadError) {
          logger.error('Failed to reload email service after API key update', reloadError as Error, { userId });
          // Don't fail the whole request, just warn
        }
      }

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
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user email for sending test
      const userResult = await query<{ email: string }>(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userEmail = userResult.rows[0].email;

      // Get email provider and settings
      const settings = await getSettings(['email_provider', 'brevo_from_email', 'brevo_from_name']);
      const emailProvider = (settings.email_provider as string) || 'brevo';

      if (emailProvider !== 'brevo') {
        res.status(400).json({
          success: false,
          message: 'Only Brevo email provider is currently supported for testing.'
        });
        return;
      }

      // Check if Brevo is configured
      const brevoKeyResult = await query<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = $1',
        ['brevo_api_key']
      );

      if (brevoKeyResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Brevo API key is not configured. Please configure it first.'
        });
        return;
      }

      // Send test email using EmailService
      try {
        const fromEmail = (settings.brevo_from_email as string) || 'noreply@kevinalthaus.com';
        const fromName = (settings.brevo_from_name as string) || 'Kevin Althaus';

        await emailService.sendEmail({
          to: { email: userEmail },
          from: { email: fromEmail, name: fromName },
          subject: 'Test Email from Kevin Althaus',
          htmlContent: `
            <h1>Test Email</h1>
            <p>This is a test email sent from your Kevin Althaus application.</p>
            <p>If you're receiving this, your email configuration is working correctly!</p>
            <p><strong>Email Provider:</strong> Brevo</p>
            <p><strong>Sent to:</strong> ${userEmail}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          `,
          textContent: `Test Email\n\nThis is a test email sent from your Kevin Althaus application.\nIf you're receiving this, your email configuration is working correctly!\n\nEmail Provider: Brevo\nSent to: ${userEmail}\nTimestamp: ${new Date().toISOString()}`,
          tags: ['test-email']
        });

        logger.info('Test email sent successfully', {
          userId,
          recipient: userEmail,
          provider: 'brevo'
        });

        res.json({
          success: true,
          message: `Test email sent successfully to ${userEmail}. Please check your inbox.`
        });
      } catch (emailError) {
        logger.error('Failed to send test email', emailError as Error, { userId });
        res.status(500).json({
          success: false,
          message: `Failed to send test email: ${(emailError as Error).message}`
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

// GET /api/settings/api-keys - Get API keys for current user
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

      // Admins can see all keys, others only see their own
      let queryText: string;
      let params: string[];

      if (userRole === Role.ADMIN) {
        queryText = `
          SELECT id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at
          FROM api_keys
          WHERE revoked_at IS NULL
          ORDER BY created_at DESC
        `;
        params = [];
      } else {
        queryText = `
          SELECT id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at
          FROM api_keys
          WHERE user_id = $1 AND revoked_at IS NULL
          ORDER BY created_at DESC
        `;
        params = [userId];
      }

      const result = await query<ApiKey>(queryText, params);

      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching API keys', error as Error, {});
      res.status(500).json({ error: 'Failed to fetch API keys' });
    }
  }
);

// POST /api/settings/api-keys - Create a new API key
router.post(
  '/api-keys',
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

      // Validation
      if (!name || typeof name !== 'string' || name.length < 3 || name.length > 100) {
        res.status(400).json({ error: 'API key name must be between 3 and 100 characters' });
        return;
      }

      if (!Array.isArray(scopes)) {
        res.status(400).json({ error: 'Scopes must be an array' });
        return;
      }

      if (expires_at && isNaN(Date.parse(expires_at))) {
        res.status(400).json({ error: 'Expires at must be a valid ISO date' });
        return;
      }

      // Generate API key
      const apiKey = `sk_${randomBytes(32).toString('hex')}`;
      const key_prefix = apiKey.substring(0, 11); // 'sk_' + first 8 hex chars
      const key_hash = hashSHA256(apiKey);

      // Insert API key into database
      const result = await query<ApiKey>(
        `INSERT INTO api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at`,
        [userId, name, key_prefix, key_hash, JSON.stringify(scopes), expires_at || null]
      );

      const keyData = result.rows[0];

      // Log API key creation in audit log
      await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          userId,
          'api_key_created',
          'api_key',
          keyData.id,
          JSON.stringify({ name, scopes }),
        ]
      );

      logger.info('API key created', {
        userId,
        keyId: keyData.id,
        name
      });

      // Return the full key ONCE (this is the only time it's shown)
      res.json({
        key: apiKey,
        ...keyData,
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

      if (!id) {
        res.status(400).json({ error: 'API key ID is required' });
        return;
      }

      // Check if user owns the key or is admin
      const keyResult = await query<{ user_id: string; name: string }>(
        'SELECT user_id, name FROM api_keys WHERE id = $1 AND revoked_at IS NULL',
        [id]
      );

      if (keyResult.rows.length === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      const keyData = keyResult.rows[0];

      if (keyData.user_id !== userId && userRole !== Role.ADMIN) {
        res.status(403).json({ error: 'Not authorized to revoke this API key' });
        return;
      }

      // Revoke the key (soft delete)
      await query(
        'UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      // Log API key revocation in audit log
      await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          userId,
          'api_key_revoked',
          'api_key',
          id,
          JSON.stringify({ name: keyData.name }),
        ]
      );

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

export default router;
