import express from 'express';
import { createHmac, randomBytes } from 'crypto';
import { pluginManager } from '../plugins/manager';
import { AuthenticatedRequest } from '../auth';

export const adminPluginsRouter = express.Router();

// CSRF protection using HMAC-signed, expiring double-submit cookie tokens.
// Note: For multi-instance deployments, prefer a shared store (e.g., Redis) for nonce tracking
// to prevent replay across instances. This implementation rotates the token after successful POST.

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const CSRF_SECRET = process.env.SESSION_SECRET || 'development_only_insecure_csrf_secret';

function signCsrf(userId: string, nonce: string, ts: number): string {
  const payload = `${userId}:${nonce}:${ts}`;
  const mac = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex');
  return `${payload}:${mac}`;
}

function verifyCsrf(token: string, userId: string): boolean {
  const parts = token.split(':');
  if (parts.length !== 4) return false;
  const [uid, nonce, tsStr, mac] = parts;
  if (uid !== userId) return false;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  if (Date.now() - ts > CSRF_MAX_AGE_MS) return false;
  const expected = createHmac('sha256', CSRF_SECRET).update(`${uid}:${nonce}:${ts}`).digest('hex');
  return mac === expected;
}

function getCookie(req: express.Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    const [k, v] = c.split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return undefined;
}

function setCsrfCookie(res: express.Response, value: string): void {
  res.cookie(CSRF_COOKIE_NAME, value, {
    httpOnly: false, // double-submit requires JS visibility
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CSRF_MAX_AGE_MS,
    path: '/'
  });
}

function clearCsrfCookie(res: express.Response): void {
  res.cookie(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/'
  });
}

function csrfProtection(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user || !authReq.user.userId) {
    res.status(401).json({ error: 'Authentication required for CSRF protection' });
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
    const headerToken = typeof req.headers[CSRF_HEADER_NAME] === 'string' ? (req.headers[CSRF_HEADER_NAME] as string) : undefined;
    const bodyToken = typeof (req.body as Record<string, unknown>)?._csrf === 'string' ? ((req.body as Record<string, unknown>)?._csrf as string) : undefined;
    const cookieToken = getCookie(req, CSRF_COOKIE_NAME);
    const submitted = headerToken || bodyToken;

    if (!submitted || !cookieToken || submitted !== cookieToken || !verifyCsrf(submitted, userId)) {
      res.status(403).json({ error: 'Invalid CSRF token' });
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
  const discovered = pluginManager.listDiscovered();
  const registry = pluginManager.listRegistry();
  const regMap = new Map(registry.map((r) => [r.id, r]));

  const rows = discovered.map((d) => {
    const manifest = d.manifest;
    const id = manifest?.name ?? d.name;
    const reg = id ? regMap.get(id) : undefined;
    const status = reg?.status ?? 'not installed';
    const statusClass =
      String(status) === 'active' ? 'status-active' :
      String(status) === 'installed' ? 'status-installed' :
      String(status) === 'inactive' ? 'status-inactive' : '';

    const actions = [] as string[];
    if (!reg && manifest && manifest.name) {
      actions.push(`<form method="post" action="/admin/plugins/${escapeHtml(manifest.name)}/install"><button>Install</button></form>`);
    }
    if (reg && String(reg.status) !== 'active') {
      actions.push(`<form method="post" action="/admin/plugins/${escapeHtml(reg.id)}/activate"><button>Activate</button></form>`);
    }
    if (reg && String(reg.status) === 'active') {
      actions.push(`<form method="post" action="/admin/plugins/${escapeHtml(reg.id)}/deactivate"><button>Deactivate</button></form>`);
    }
    if (reg) {
      actions.push(`<form method="post" action="/admin/plugins/${escapeHtml(reg.id)}/uninstall" onsubmit="return confirm('Uninstall plugin?');"><button>Uninstall</button></form>`);
    }

    return `<tr>
      <td>${escapeHtml(manifest?.displayName ?? id)}</td>
      <td>${escapeHtml(manifest?.version ?? '-')}</td>
      <td>${escapeHtml(manifest?.description ?? '')}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(String(status))}</span></td>
      <td class="actions">${actions.join('')}</td>
    </tr>`;
  });

  const body = `
    <p>Manage discovered plugins in the <code>plugins/</code> directory. Use the actions to install, activate, deactivate and uninstall.</p>
    <table>
      <thead>
        <tr><th>Name</th><th>Version</th><th>Description</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${rows.join('\n')}
      </tbody>
    </table>
  `;

  const requestWithCSRF = req as unknown as { csrfToken?: () => string };
  const csrfToken = requestWithCSRF.csrfToken ? requestWithCSRF.csrfToken() : undefined;
  res.type('html').send(layout('Plugin Management', body, csrfToken));
});

adminPluginsRouter.post('/:id/install', csrfProtection, (req, res): void => {
  pluginManager.install(req.params.id)
    .then(() => {
      res.redirect('/admin/plugins');
    })
    .catch((e) => {
      console.error('Plugin install failed:', e);
      res.status(400).send(layout('Install Error', `<p>Plugin installation failed. Please try again.</p><p><a href='/admin/plugins'>Back</a></p>`));
    });
});

adminPluginsRouter.post('/:id/activate', csrfProtection, (req, res): void => {
  pluginManager.activate(req.params.id)
    .then(() => {
      res.redirect('/admin/plugins');
    })
    .catch((e) => {
      console.error('Plugin activate failed:', e);
      res.status(400).send(layout('Activate Error', `<p>Plugin activation failed. Please try again.</p><p><a href='/admin/plugins'>Back</a></p>`));
    });
});

adminPluginsRouter.post('/:id/deactivate', csrfProtection, (req, res): void => {
  pluginManager.deactivate(req.params.id)
    .then(() => {
      res.redirect('/admin/plugins');
    })
    .catch((e) => {
      console.error('Plugin deactivate failed:', e);
      res.status(400).send(layout('Deactivate Error', `<p>Plugin deactivation failed. Please try again.</p><p><a href='/admin/plugins'>Back</a></p>`));
    });
});

adminPluginsRouter.post('/:id/uninstall', csrfProtection, (req, res): void => {
  pluginManager.uninstall(req.params.id)
    .then(() => {
      res.redirect('/admin/plugins');
    })
    .catch((e) => {
      console.error('Plugin uninstall failed:', e);
      res.status(400).send(layout('Uninstall Error', `<p>Plugin uninstall failed. Please try again.</p><p><a href='/admin/plugins'>Back</a></p>`));
    });
});
