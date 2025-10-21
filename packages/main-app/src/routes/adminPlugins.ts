import express from 'express';
import { pluginManager } from '../plugins/manager';

export const adminPluginsRouter = express.Router();

function layout(title: string, body: string): string {
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
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
  </head>
  <body>
    <h1>${title}</h1>
    ${body}
  </body>
  </html>`;
}

adminPluginsRouter.get('/', (_req, res) => {
  const discovered = pluginManager.listDiscovered();
  const registry = pluginManager.listRegistry();
  const regMap = new Map(registry.map((r) => [r.id, r]));

  const rows = discovered.map((d) => {
    const manifest = d.manifest;
    const id = manifest?.name ?? d.name;
    const reg = id ? regMap.get(id) : undefined;
    const status = reg?.status ?? 'not installed';
    const statusClass =
      status === 'active' ? 'status-active' :
      status === 'installed' ? 'status-installed' :
      status === 'inactive' ? 'status-inactive' : '';

    const actions = [] as string[];
    if (!reg && manifest) {
      actions.push(`<form method="post" action="/admin/plugins/${manifest.name}/install"><button>Install</button></form>`);
    }
    if (reg && reg.status !== 'active') {
      actions.push(`<form method="post" action="/admin/plugins/${reg.id}/activate"><button>Activate</button></form>`);
    }
    if (reg && reg.status === 'active') {
      actions.push(`<form method="post" action="/admin/plugins/${reg.id}/deactivate"><button>Deactivate</button></form>`);
    }
    if (reg) {
      actions.push(`<form method="post" action="/admin/plugins/${reg.id}/uninstall" onsubmit="return confirm('Uninstall plugin?');"><button>Uninstall</button></form>`);
    }

    return `<tr>
      <td>${manifest?.displayName ?? id}</td>
      <td>${manifest?.version ?? '-'}</td>
      <td>${manifest?.description ?? ''}</td>
      <td><span class="badge ${statusClass}">${status}</span></td>
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

  res.type('html').send(layout('Plugin Management', body));
});

adminPluginsRouter.post('/:id/install', async (req, res) => {
  try {
    await pluginManager.install(req.params.id);
    res.redirect('/admin/plugins');
  } catch (e) {
    res.status(400).send(layout('Install Error', `<p>${(e as Error).message}</p><p><a href='/admin/plugins'>Back</a></p>`));
  }
});

adminPluginsRouter.post('/:id/activate', async (req, res) => {
  try {
    await pluginManager.activate(req.params.id);
    res.redirect('/admin/plugins');
  } catch (e) {
    res.status(400).send(layout('Activate Error', `<p>${(e as Error).message}</p><p><a href='/admin/plugins'>Back</a></p>`));
  }
});

adminPluginsRouter.post('/:id/deactivate', async (req, res) => {
  try {
    await pluginManager.deactivate(req.params.id);
    res.redirect('/admin/plugins');
  } catch (e) {
    res.status(400).send(layout('Deactivate Error', `<p>${(e as Error).message}</p><p><a href='/admin/plugins'>Back</a></p>`));
  }
});

adminPluginsRouter.post('/:id/uninstall', async (req, res) => {
  try {
    await pluginManager.uninstall(req.params.id);
    res.redirect('/admin/plugins');
  } catch (e) {
    res.status(400).send(layout('Uninstall Error', `<p>${(e as Error).message}</p><p><a href='/admin/plugins'>Back</a></p>`));
  }
});

