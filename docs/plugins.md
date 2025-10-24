# Plugin Development

## Architecture

- Plugin Registry manages lifecycle and metadata
- Each plugin has an isolated PostgreSQL schema: `plugin_<name>`
- Capability-based permissions for data and APIs
- Optional frontend and backend entrypoints

## Manifest (plugin.yaml)

```yaml
name: my-plugin
version: 1.0.0
displayName: My Plugin
description: Example plugin
author:
  name: Jane Doe
  email: jane@example.com
capabilities:
  - database:read
  - database:write
entrypoint: dist/index.js
```

Optional sections:
- frontend: `{ entrypoint, assets: [...] }`
- backend: custom routes and required capabilities
- database: migrations and schema assets
- settings: schema and defaults

## Execution Context (backend)

```ts
import type { PluginExecutionContext } from '@monorepo/shared';

export async function handler(ctx: PluginExecutionContext) {
  const res = await ctx.db?.query('SELECT 1');
  ctx.logger.info('Plugin running', { rows: res?.rowCount });
}
```

## Lifecycle Hooks

- onInstall — run DB migrations, setup
- onActivate — register routes, start tasks
- onDeactivate — cleanup
- onUninstall — remove data (optional)
- onUpdate — version migrations

## Best Practices

- Minimize required capabilities
- Validate all inputs; sanitize output
- Keep migrations idempotent
- Use `@monorepo/shared` logger and types

