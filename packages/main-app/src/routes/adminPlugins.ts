import express from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import React from 'react';
import { pluginManager } from '../plugins/manager';
import type { AuthenticatedRequest } from '../auth';
import { renderReactSSR } from '../utils/ssr-renderer';
import PluginManagement, { Plugin } from '../components/PluginManagement';
import { createLogger, LogLevel } from '@monorepo/shared';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

export const adminPluginsRouter = express.Router();

// Plugin ID validation pattern
const VALID_PLUGIN_ID_PATTERN = /^[a-z0-9-_]+$/i;

/**
 * Validate plugin ID format and send error response if invalid
 * @returns true if valid, false if invalid (response already sent)
 */
function validatePluginId(pluginId: string, routeName: string, res: express.Response): boolean {
  if (!VALID_PLUGIN_ID_PATTERN.test(pluginId)) {
    logger.warn('Invalid plugin ID format', { pluginId, route: routeName });
    res
      .status(400)
      .send(
        layout(
          'Invalid Plugin ID',
          `<p>Invalid plugin ID format. Only alphanumeric characters, hyphens, and underscores are allowed.</p><p><a href='/admin/plugins'>Back</a></p>`
        )
      );
    return false;
  }
  return true;
}

// CSRF protection using HMAC-signed, expiring double-submit cookie tokens.
// Note: For multi-instance deployments, prefer a shared store (e.g., Redis) for nonce tracking
// to prevent replay across instances. This implementation rotates the token after successful POST.

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Require CSRF_SECRET in production. In development, generate a strong random secret if missing.
if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
  throw new Error('CSRF_SECRET environment variable is required in production');
}
const CSRF_SECRET: string = (() => {
  if (process.env.CSRF_SECRET) {
    return process.env.CSRF_SECRET;
  }
  // Development fallback: generate at startup and warn prominently
  const generated = randomBytes(32).toString('hex');
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(
      'CSRF_SECRET not set. Generated ephemeral development secret. DO NOT use in persistent environments. Set CSRF_SECRET to a stable value.'
    );
  }
  return generated;
})();

function signCsrf(userId: string, nonce: string, ts: number): string {
  const payload = `${userId}:${nonce}:${ts}`;
  const mac = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex');
  return `${payload}:${mac}`;
}

function verifyCsrf(token: string, userId: string): boolean {
  const parts = token.split(':');
  if (parts.length !== 4) {
    return false;
  }
  const [uid, nonce, tsStr, mac] = parts;
  if (uid !== userId) {
    return false;
  }
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || ts <= 0) {
    return false;
  }
  if (Date.now() - ts > CSRF_MAX_AGE_MS) {
    return false;
  }
  const expected = createHmac('sha256', CSRF_SECRET).update(`${uid}:${nonce}:${ts}`).digest('hex');

  // Use timing-safe comparison to prevent timing attacks on MAC verification
  try {
    const macBuffer = Buffer.from(mac, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return macBuffer.length === expectedBuffer.length && timingSafeEqual(macBuffer, expectedBuffer);
  } catch (error) {
    // Invalid hex encoding
    return false;
  }
}

function getCookie(req: express.Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    // Split only on first '=' to handle values containing '='
    const eqIndex = c.indexOf('=');
    if (eqIndex === -1) {
      // No '=' found, treat as key with empty value
      continue;
    }
    const k = c.substring(0, eqIndex);
    const v = c.substring(eqIndex + 1);
    if (k === name) {
      return decodeURIComponent(v || '');
    }
  }
  return undefined;
}

function setCsrfCookie(res: express.Response, value: string): void {
  res.cookie(CSRF_COOKIE_NAME, value, {
    httpOnly: false, // double-submit requires JS visibility
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CSRF_MAX_AGE_MS,
    path: '/',
  });
}

function clearCsrfCookie(res: express.Response): void {
  res.cookie(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

function csrfProtection(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user || !authReq.user.userId) {
    res
      .status(401)
      .type('html')
      .send(
        layout(
          'Authentication Required',
          '<p>You must be authenticated to access this page.</p><p><a href="/admin/plugins">Back to Plugins</a></p>'
        )
      );
    return;
  }
  const userId = authReq.user.userId;

  if (req.method === 'GET') {
    const nonce = randomBytes(16).toString('hex');
    const ts = Date.now();
    const token = signCsrf(userId, nonce, ts);
    setCsrfCookie(res, token);
    (req as unknown as { csrfToken?: () => string }).csrfToken = () => token;
    next();
    return;
  }

  if (req.method === 'POST') {
    const headerToken =
      typeof req.headers[CSRF_HEADER_NAME] === 'string' ? req.headers[CSRF_HEADER_NAME] : undefined;
    const bodyToken =
      typeof (req.body as Record<string, unknown>)?._csrf === 'string'
        ? ((req.body as Record<string, unknown>)?._csrf as string)
        : undefined;
    const cookieToken = getCookie(req, CSRF_COOKIE_NAME);
    const submitted = headerToken || bodyToken;

    if (!submitted || !cookieToken || submitted !== cookieToken || !verifyCsrf(submitted, userId)) {
      res
        .status(403)
        .type('html')
        .send(
          layout('Forbidden', "<p>Invalid CSRF token</p><p><a href='/admin/plugins'>Back</a></p>")
        );
      return;
    }

    // Rotate token after successful validation
    clearCsrfCookie(res);
    const newNonce = randomBytes(16).toString('hex');
    const newToken = signCsrf(userId, newNonce, Date.now());
    setCsrfCookie(res, newToken);
    next();
    return;
  }

  next();
}

// HTML escape function to prevent XSS
function escapeHtml(str: string | undefined): string {
  if (str === undefined) {
    return '';
  }
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function layout(title: string, body: string, csrfToken?: string): string {
  const escapedTitle = escapeHtml(title);
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px; }
      th { background: #f6f8fa; text-align: left; }
      .actions form { display: inline-block; margin: 0 4px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; background: #eee; }
      .status-active { background: #d1fae5; }
      .status-installed { background: #e0e7ff; }
      .status-inactive { background: #fef3c7; }
      .status-error { background: #fee2e2; }
    </style>
    <script>
      // Add CSRF token to all forms
      document.addEventListener('DOMContentLoaded', function() {
        const token = document.body.dataset.csrfToken;
        if (token) {
          const forms = document.querySelectorAll('form[method="post"]');
          forms.forEach(form => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = '_csrf';
            input.value = token;
            form.appendChild(input);
          });
        }
      });
    </script>
  </head>
  <body${csrfToken ? ` data-csrf-token="${escapeHtml(csrfToken)}"` : ''}>
    <h1>${escapedTitle}</h1>
    ${body}
  </body>
  </html>`;
}

adminPluginsRouter.get('/', csrfProtection, (req, res): void => {
  try {
    const discovered = pluginManager.listDiscovered();
    const registry = pluginManager.listRegistry();
    const regMap = new Map(registry.map((r) => [r.id, r]));

    const plugins: Plugin[] = discovered.map((d) => {
      const manifest = d.manifest;
      const id = manifest?.name ?? d.name;
      const reg = id ? regMap.get(id) : undefined;
      const status = reg?.status ?? 'inactive';

      return {
        id: id,
        name: manifest?.displayName ?? id,
        version: manifest?.version,
        description: manifest?.description,
        author: (manifest as unknown as { author?: { name?: string } })?.author?.name,
        status:
          String(status) === 'not installed'
            ? 'inactive'
            : (String(status) as 'active' | 'installed' | 'inactive' | 'error'),
      };
    });

    const requestWithCSRF = req as unknown as { csrfToken?: () => string };
    const csrfToken = requestWithCSRF.csrfToken ? requestWithCSRF.csrfToken() : undefined;

    const component = React.createElement(PluginManagement, {
      plugins,
      csrfToken,
    });

    const html = renderReactSSR(component, {
      title: 'Plugin Management',
      csrfToken,
    });

    res.type('html').send(html);
  } catch (e) {
    logger.error('Failed to render plugin management', e as Error);
    res
      .status(500)
      .type('html')
      .send(
        layout(
          'Server Error',
          "<p>Failed to load plugins. Please try again later.</p><p><a href='/admin/plugins'>Back</a></p>"
        )
      );
  }
});

async function handlePluginAction(
  req: express.Request,
  res: express.Response,
  action: 'install' | 'activate' | 'deactivate' | 'uninstall'
): Promise<void> {
  const pluginId = req.params.id;
  if (!validatePluginId(pluginId, action, res)) {
    return;
  }
  try {
    switch (action) {
      case 'install':
        await pluginManager.install(pluginId);
        break;
      case 'activate':
        await pluginManager.activate(pluginId);
        break;
      case 'deactivate':
        await pluginManager.deactivate(pluginId);
        break;
      case 'uninstall':
        await pluginManager.uninstall(pluginId);
        break;
    }
    res.redirect('/admin/plugins');
  } catch (e) {
    logger.error(`Plugin ${action} failed`, e as Error, { pluginId });
    const title = `${action.charAt(0).toUpperCase() + action.slice(1)} Error`;
    res
      .status(400)
      .send(
        layout(
          title,
          `<p>Plugin ${action} failed. Please try again.</p><p><a href='/admin/plugins'>Back</a></p>`
        )
      );
  }
}

adminPluginsRouter.post('/:id/install', csrfProtection, async (req, res): Promise<void> => {
  await handlePluginAction(req, res, 'install');
});

adminPluginsRouter.post('/:id/activate', csrfProtection, async (req, res): Promise<void> => {
  await handlePluginAction(req, res, 'activate');
});

adminPluginsRouter.post('/:id/deactivate', csrfProtection, async (req, res): Promise<void> => {
  await handlePluginAction(req, res, 'deactivate');
});

adminPluginsRouter.post('/:id/uninstall', csrfProtection, async (req, res): Promise<void> => {
  await handlePluginAction(req, res, 'uninstall');
});
