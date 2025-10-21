import express from 'express';
import { randomBytes } from 'crypto';
import { pluginManager } from '../plugins/manager';
import { AuthenticatedRequest } from '../auth';

export const adminPluginsRouter = express.Router();

// Extend Request interface for CSRF token
interface RequestWithCSRF extends AuthenticatedRequest {
  csrfToken?: () => string;
}

interface RequestBodyWithCSRF {
  _csrf?: string;
  [key: string]: unknown;
}

// User session-based CSRF storage (keyed by userId from auth)
const csrfTokens = new Map<string, { token: string; expires: number }>();

function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

function csrfProtection(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user || !authReq.user.userId) {
    res.status(401).json({ error: 'Authentication required for CSRF protection' });
    return;
  }

  const userId = authReq.user.userId;

  if (req.method === 'GET') {
    // Lazy cleanup: remove any existing expired token before generating new one
    const existingToken = csrfTokens.get(userId);
    if (existingToken && existingToken.expires < Date.now()) {
      csrfTokens.delete(userId);
    }
    
    // Generate token for GET requests
    const token = generateCSRFToken();
    csrfTokens.set(userId, { token, expires: Date.now() + 3600000 }); // 1 hour
    (req as RequestWithCSRF).csrfToken = () => token;
    next();
  } else if (req.method === 'POST') {
    // Verify token for POST requests
    const body = req.body as RequestBodyWithCSRF;
    const submittedToken = (typeof body._csrf === 'string' ? body._csrf : undefined) || 
                          (typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : undefined);
    const stored = csrfTokens.get(userId);
    
    // Lazy cleanup: remove expired token immediately when detected
    if (stored && stored.expires < Date.now()) {
      csrfTokens.delete(userId);
    }
    
    // Validate token (after potential cleanup)
    const validStored = csrfTokens.get(userId);
    if (!validStored || !submittedToken || validStored.token !== submittedToken) {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }
    
    next();
  } else {
    next();
  }
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

  const requestWithCSRF = req as RequestWithCSRF;
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

