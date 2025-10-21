# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Quick Start
```bash
# Start all services (automatic port conflict resolution)
./scripts/web -on

# Stop all services
./scripts/web -off

# Development mode (no Docker, requires PostgreSQL running)
npm install
npm run build
npm run dev  # Starts all packages in parallel
```

### Building
```bash
# Build all packages
npm run build

# Build specific package
cd packages/main-app && npm run build

# Clean build artifacts
npm run clean
```

### Linting and Formatting
```bash
# Lint all TypeScript files
npm run lint

# Format all files
npm run format
```

### Testing
```bash
# Run all tests (when available)
npm test

# Run tests for specific package
cd packages/main-app && npm test

# Run single test file
cd packages/main-app && npx jest src/__tests__/app.test.ts
```

### Docker Services
```bash
# Start with production configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Monorepo Structure
This is a **Lerna monorepo** with two workspace types:
- `packages/*` - Core application packages (5 packages)
- `plugins/*` - Extensible plugin system

**Key principle**: Shared types and utilities live in `packages/shared`, which all other packages depend on.

### Service Architecture
**6 Docker services** orchestrated by docker-compose:

1. **API Gateway** (`:3000`) - Single entry point, proxies to all backend services
2. **Main App** (`:3001`) - Core Node.js/Express backend with database access
3. **Python Service** (`:8000`) - FastAPI service for Python-specific functionality
4. **Frontend** (`:3002`) - React 18 public-facing application
5. **Admin** (`:3003`) - React 18 admin dashboard with Material-UI
6. **PostgreSQL** (`:5432`) - Primary database with plugin schema isolation

**Request Flow**:
```
Client → API Gateway (:3000) → [Main App (:3001) | Python Service (:8000)]
                                         ↓
                                   PostgreSQL (:5432)
```

### Plugin System Architecture

**Critical concept**: Plugins are isolated, lifecycle-managed modules with their own database schemas.

**Plugin Lifecycle Hooks** (defined in `packages/shared/src/plugin/lifecycle.ts`):
- `onInstall(context)` - Run database migrations, create schemas
- `onActivate(context)` - Register routes, start services
- `onDeactivate(context)` - Cleanup, stop background processes
- `onUninstall(context)` - Remove data (optional), revoke tokens
- `onUpdate(context, oldVersion)` - Handle version migrations

**PluginExecutionContext** provides:
- `logger` - Structured logging with metadata
- `api` - HTTP client for external requests
- `storage` - Key-value storage scoped to plugin
- `db` - PostgreSQL connection pool
- `app` - Express app instance for route registration

**Example Plugin Structure**:
```typescript
export default class MyPlugin implements PluginLifecycleHooks {
  async onActivate(context: PluginExecutionContext): Promise<void> {
    context.logger.info('Activating plugin');
    if (context.app) {
      context.app.use('/api/myplugin', myRouter);
    }
  }
}
```

**Plugin Discovery**: Plugins in `plugins/` directory must have:
- `plugin.yaml` manifest with name, version, capabilities
- `package.json` with `@monorepo/shared` dependency
- Entry point implementing `PluginLifecycleHooks`

### Database Patterns

**Schema Isolation**: Each plugin gets its own PostgreSQL schema created during `onInstall`.

**Main App Database** (`packages/main-app/src/db/`):
- `index.ts` - Connection pool and query functions
- `migrations.ts` - Sequential migration runner
- Migrations run automatically on server start

**Query Pattern**:
```typescript
import { query } from '../db';

const result = await query<UserRow>(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

**Transactions**:
```typescript
import { transaction } from '../db';

await transaction(async (client) => {
  await client.query('INSERT INTO users ...');
  await client.query('INSERT INTO audit_log ...');
});
```

### Authentication Flow

**JWT-based authentication** with access + refresh tokens:

1. `POST /api/auth/register` - Create user with hashed password
2. `POST /api/auth/login` - Returns `{ accessToken, refreshToken }`
3. Protected routes use `authenticateToken` middleware
4. `POST /api/auth/refresh` - Get new access token
5. `POST /api/auth/logout` - Revoke refresh token

**Token Storage**:
- Access tokens: Short-lived (15m), verified via JWT
- Refresh tokens: Long-lived (7d), stored in `refresh_tokens` table with expiry

**RBAC**: Users have roles (`admin`, `editor`, `viewer`), middleware `requireRole(...roles)` enforces permissions.

### TypeScript Configuration

**Strict mode enabled** across all packages with these key rules:
- `@typescript-eslint/no-explicit-any: error` - Avoid `any`, use `unknown` or proper types
- `@typescript-eslint/no-floating-promises: error` - Always await or handle promises
- `@typescript-eslint/no-misused-promises: error` - Don't use async functions where sync expected
- Explicit return types required for functions (can disable for arrow functions)

**ESLint Pattern for Async Route Handlers**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/endpoint', async (req: Request, res: Response): Promise<void> => {
  // Handler code
});
```

### File References in IDE

When referencing files or code locations in responses, use **markdown link syntax** for clickability:
- Files: `[filename.ts](packages/main-app/src/filename.ts)`
- Lines: `[filename.ts:42](packages/main-app/src/filename.ts#L42)`
- Ranges: `[filename.ts:42-51](packages/main-app/src/filename.ts#L42-L51)`

**Never use backticks** for file paths unless explicitly asked.

## Production Deployment

**Ubuntu deployment script**: `sudo ./scripts/deploy-ubuntu.sh`
- Installs Docker, configures firewall, sets up environment
- Uses `docker-compose.prod.yml` overlay for production settings

**PostgreSQL Production**:
- Configuration: `docker/postgres/postgresql.conf` (tuned for 2GB RAM)
- Authentication: `docker/postgres/pg_hba.conf` (scram-sha-256)
- Initialization: Scripts in `docker/postgres/init/` run on first start

**Backup & Monitoring**:
```bash
./scripts/backup-postgres.sh        # Manual backup
./scripts/restore-postgres.sh <file> # Restore from backup
./scripts/monitor-postgres.sh       # Health check
./scripts/setup-cron.sh             # Schedule automated tasks
```

## Important Patterns

### Error Handling in Async Routes
Always return from error responses to prevent further execution:
```typescript
if (!user) {
  res.status(404).json({ error: 'Not found' });
  return;  // CRITICAL: prevents "headers already sent" errors
}
```

### Shared Package Updates
When modifying `packages/shared/src/types/`, rebuild before using:
```bash
cd packages/shared && npm run build
cd ../main-app && npm run build  # Will pick up new types
```

### Port Conflicts
The `./scripts/web` tool automatically kills processes on required ports (3000-3003, 5432, 6379, 8000, 8080).

Manual check: `lsof -i :PORT` or `netstat -ano | findstr :PORT` (Windows)

### Database Migrations
- Place in `packages/main-app/src/db/migrations/`
- Naming: `YYYYMMDD_description.sql`
- Execute in order via `runMigrations()` in `migrations.ts`
- Idempotent: Use `IF NOT EXISTS`, `IF EXISTS` clauses

### Environment Variables
Development uses `.env`, production uses `.env.production`.

**Critical production settings**:
```bash
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)          # Generate secure secrets
SESSION_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql://user:pass@postgres:5432/kevinalthaus
```

## Key Files

- `SYSTEM_ARCHITECTURE.md` - Detailed service documentation
- `DEPLOYMENT.md` - Production deployment guide
- `packages/shared/src/plugin/lifecycle.ts` - Plugin system types
- `docker-compose.yml` - Development service definitions
- `docker-compose.prod.yml` - Production overrides
- `.eslintrc.json` - TypeScript linting rules
