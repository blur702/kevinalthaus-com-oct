# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a microservices-based web platform built with Node.js 20+, TypeScript, React, and PostgreSQL 16. The architecture emphasizes security (RBAC, JWT auth, CSRF protection), extensibility (plugin system), and scalability (independent service scaling).

**Key characteristics:**
- Lerna monorepo with workspace packages in `packages/*` and `plugins/*`
- JWT-based authentication with httpOnly cookies and refresh token rotation
- Defense-in-depth security: helmet, CORS allowlists, CSRF tokens, timing-safe comparisons
- Plugin system with isolated PostgreSQL schemas (`plugin_<name>`) and capability-based permissions
- All internal services communicate through the API Gateway in production

## Essential Commands

### Development
```bash
# Install and build
npm install                    # Install all workspace dependencies
npm run build                  # Build all packages (TypeScript compilation)

# Development servers
npm run dev                    # Start all services in parallel (via Lerna)
cd packages/main-app && npm run dev    # Start single service
./scripts/web -on              # Start full stack including Docker services

# Code quality
npm run lint                   # ESLint across all packages
npm run format                 # Prettier formatting

# Testing
cd packages/main-app && npm test       # Run tests for specific package
cd packages/main-app && npm run test:watch  # Watch mode
```

### Docker Operations
```bash
# Development
docker compose up -d postgres redis    # Start infrastructure only
docker compose up -d                   # Start all services

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Helpers
./scripts/web -off             # Stop all services
./scripts/backup-postgres.sh   # Backup database
./scripts/restore-postgres.sh  # Restore database
```

### Database Migrations
Migrations run automatically on application startup in `packages/main-app/src/db/migrations.ts`. They use PostgreSQL advisory locks to prevent concurrent execution and are tracked in the `migrations` table.

## Architecture

### Service Communication Flow
```
Client → API Gateway (:3000 dev / :4000 prod)
           ↓
           ├─→ Main App (:3001, internal) → PostgreSQL, Redis
           ├─→ Python Service (:8000, internal)
           └─→ Plugin Engine (:3004, internal)

Frontend (:3002) / Admin (:3003) → API Gateway
```

**Critical:** In production, only API Gateway, Frontend, and Admin are exposed to the host. All backend services (Main App, Python Service, Plugin Engine, PostgreSQL, Redis) are accessible only within the Docker network `app_network`.

### Authentication & Authorization

1. **JWT Flow:**
   - Access tokens: 15 min expiry, stored in `accessToken` httpOnly cookie
   - Refresh tokens: 30 days expiry, stored in `refreshToken` httpOnly cookie, hashed in DB
   - Token validation in API Gateway → forwards user context to internal services

2. **RBAC Implementation:**
   - Roles: `admin`, `editor`, `viewer` (defined in `packages/shared/src/types/roles.ts`)
   - Capabilities: fine-grained permissions (e.g., `USER_VIEW`, `USER_EDIT`)
   - Middleware: `requireRole()`, `requireCapability()` in `packages/main-app/src/auth/rbac-middleware.ts`

3. **CSRF Protection:**
   - Admin routes require CSRF token (double-submit cookie pattern)
   - Validated in `packages/main-app/src/routes/adminPlugins.ts`
   - Secret stored separately from session secret (`CSRF_SECRET` vs `SESSION_SECRET`)

### Shared Package (`packages/shared`)

This is the **core shared library** imported by all services. Key exports:

- **Types:** `Role`, `Capability`, `PluginManifest`, Express type augmentations
- **Security:** `hashPassword()`, `verifyPassword()`, `hashSHA256()`, `sanitizeFilename()`, `stripHTML()`
- **Database:** `QueryIsolationEnforcer` (SQL complexity analysis, row limits)
- **Plugin:** `validatePluginManifest()`, `parsePluginYAML()`
- **Middleware:** `generateRequestId()`, logging utilities

When adding utilities that multiple services need, add them to `packages/shared/src/` and export via `index.ts`.

### Database Schema

**Core tables (managed by main-app migrations):**
- `users` - User accounts with RBAC roles
- `refresh_tokens` - JWT refresh tokens (hashed)
- `migrations` - Migration tracking
- `audit_log` - Security/audit trail (optional)

**Plugin isolation:**
- Each plugin gets a dedicated schema: `plugin_<name>`
- Plugins cannot access other plugins' schemas or core tables without explicit capability grants
- Enforced via `QueryIsolationEnforcer` in `packages/shared/src/database/isolation.ts`

### Environment Variables

**Critical secrets (MUST be set):**
- `JWT_SECRET` - JWT signing key (generate with `./scripts/ensure-jwt-secret.sh`)
- `POSTGRES_PASSWORD` - Database password
- `CSRF_SECRET` - CSRF token signing key (auto-generated in dev)

**Service URLs (for local dev):**
```
MAIN_APP_URL=http://localhost:3001
PYTHON_SERVICE_URL=http://localhost:8000
PLUGIN_ENGINE_URL=http://localhost:3004
```

**In production Docker:** Services use container names (e.g., `http://main-app:3001`)

## Plugin System

Plugins are defined in `plugins/*/plugin.yaml` manifests and loaded by the Plugin Engine.

**Structure:**
```
plugins/my-plugin/
  plugin.yaml          # Manifest (name, version, capabilities, entrypoints)
  src/index.ts         # Backend handler
  frontend/            # Optional React components
  migrations/          # Database migrations for plugin schema
```

**Manifest example:**
```yaml
name: my-plugin
version: 1.0.0
capabilities:
  - database:read     # Request specific capabilities
  - database:write
entrypoint: dist/index.js
```

**Execution context:**
```typescript
import type { PluginExecutionContext } from '@monorepo/shared';

export async function handler(ctx: PluginExecutionContext) {
  // ctx.db - isolated database connection to plugin_my-plugin schema
  // ctx.logger - structured logger
  // ctx.config - plugin settings from DB
}
```

**Lifecycle hooks:** `onInstall`, `onActivate`, `onDeactivate`, `onUninstall`, `onUpdate`

## Security Considerations

### Input Validation
- **Always sanitize user input:** Use `stripHTML()`, `sanitizeFilename()` from `@monorepo/shared`
- **Email validation:** Use `validateEmail()` from shared package
- **SQL injection:** All queries use parameterized queries (`query($1, $2)` syntax)
- **File uploads:** Validated in `packages/main-app/src/middleware/upload.ts` (type, size, magic bytes)

### Timing Attack Prevention
- Password comparison: `verifyPassword()` uses bcrypt (constant-time)
- Login flow: Always call `verifyPassword()` even for non-existent users (dummy hash)
- Implementation in `packages/main-app/src/auth/index.ts` around line 161-262

### CORS Configuration
- Allowlist managed via `CORS_ALLOWED_ORIGINS` environment variable
- Parsed in `packages/main-app/src/middleware/cors.ts`
- Default in development: `http://localhost:3002,http://localhost:3003`

### Secrets Management
- **Never commit secrets** - Use `.env` (gitignored)
- **JWT_SECRET:** Persisted by `./scripts/ensure-jwt-secret.sh`
- **Production SSL:** Certificates in `./secrets/` (gitignored), mounted into Postgres container

## Code Quality Standards

### TypeScript Configuration
- Strict mode enabled across all packages
- No implicit `any` - all types must be explicit
- `@typescript-eslint` with security plugin enabled

### Common Linting Fixes
When adding new code:
1. **Async handlers in Express:** Use `async (req, res): Promise<void> =>` and add `// eslint-disable-next-line @typescript-eslint/no-misused-promises` above route definitions
2. **Console statements:** Add `// eslint-disable-next-line no-console` for intentional logging
3. **Type assertions:** Minimize `as` casts; prefer type guards
4. **Query parameter handling:** Express `req.query` types are `ParsedQs`, convert to string with `String(value)`

### Testing
Tests use Jest. Example structure:
```typescript
// packages/main-app/src/__tests__/app.test.ts
describe('Health endpoint', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
```

## Common Patterns

### Adding a New API Endpoint
1. Create route handler in `packages/main-app/src/routes/`
2. Add authentication: `router.use(authMiddleware)`
3. Add authorization: `requireRole(Role.ADMIN)` or `requireCapability(Capability.X)`
4. Register in `packages/main-app/src/server.ts`
5. Update API Gateway proxy in `packages/api-gateway/src/index.ts` if needed

### Database Queries
```typescript
import { query, transaction } from '../db';

// Simple query
const result = await query<{ id: string; email: string }>(
  'SELECT id, email FROM users WHERE id = $1',
  [userId]
);

// Transaction
await transaction(async (client) => {
  await client.query('INSERT INTO users ...', [...]);
  await client.query('INSERT INTO audit_log ...', [...]);
});
```

Query logging is automatically handled with sampling (every 10th query in production, all in debug mode).

### Adding Shared Utilities
1. Add to appropriate file in `packages/shared/src/`
2. Export from `packages/shared/src/index.ts`
3. Import in consuming package: `import { myUtil } from '@monorepo/shared'`
4. Run `npm run build` to rebuild shared package

## Troubleshooting

### "JWT_SECRET is required"
Run `./scripts/ensure-jwt-secret.sh` to generate and persist a secret.

### PostgreSQL connection refused
Ensure Postgres is running: `docker compose up -d postgres`
Check logs: `docker compose logs postgres`

### Port already in use
Use `./scripts/web -off` to stop all services, or manually:
```bash
docker compose down
# Kill any lingering Node processes
pkill -f "node.*3000|3001|3002|3003"
```

### Linting errors after git pull
```bash
npm install          # Update dependencies
npm run build        # Rebuild TypeScript
npm run lint         # Check for errors
```

### Plugin not loading
1. Verify `plugin.yaml` is valid YAML and matches schema
2. Check Plugin Engine logs: `docker compose logs plugin-engine`
3. Ensure capabilities are granted in admin UI

## Documentation Links

For comprehensive details, see:
- `docs/getting-started.md` - Setup and installation
- `docs/architecture.md` - System design and services
- `docs/security.md` - Security model and best practices
- `docs/plugins.md` - Plugin development guide
- `docs/deployment.md` - Production deployment
- `docs/api.md` - API reference

## CodeRabbit CLI Integration

This repository supports CodeRabbit CLI for local AI-powered code reviews in WSL, complementing the existing web-based CodeRabbit integration (tracked in `CODERABBIT_FIXES.md`).

**Key capabilities:**
- **Local-first workflow:** Review code before pushing to GitHub
- **AI-friendly output:** `--prompt-only` flag produces token-efficient, structured feedback optimized for Claude Code
- **Uncommitted changes:** Review work-in-progress code that hasn't been committed
- **Automated fixes:** Claude can parse CodeRabbit output and apply fixes automatically

**Quick setup:**
```bash
# Install in WSL
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
source ~/.bashrc

# Authenticate (do this both standalone and within Claude Code sessions)
coderabbit auth login

# Test review
coderabbit --prompt-only --type uncommitted
```

**Example Claude Code workflow:**
```
"Please implement <task>, then run coderabbit --prompt-only --type uncommitted
in the background, let it take as long as it needs, and fix the issues it finds."
```

When Claude runs CodeRabbit with `--prompt-only`, the output is structured for machine parsing with file paths, line numbers, severity levels, and suggested fixes. Reviews typically take 7-30+ minutes and can run in background while continuing work.

**Common flags:**
- `--prompt-only` - AI-friendly output format (essential for Claude integration)
- `--type uncommitted` - Review only uncommitted changes (faster, focused)
- `--type staged` - Review only staged changes
- `--base main` - Review changes against specific branch

**Important notes:**
- Authentication must be done separately for standalone WSL and Claude Code sessions
- Reviews can take 7-30+ minutes; use background execution for long reviews
- Track fixes in `CODERABBIT_FIXES.md` to maintain consistency with existing process
- Configure Git line-ending settings (`git config --global core.autocrlf input` in WSL) to avoid CRLF/LF issues
- For best performance, work in WSL Linux filesystem (`~/projects/`) rather than `/mnt/c/` Windows drives

**Comprehensive setup guide:** See `docs/coderabbit-cli.md` for:
- Prerequisites verification (WSL, curl, unzip, git)
- Git configuration for line endings
- Installation and authentication (standalone + Claude Code)
- Testing integration and troubleshooting
- Best practices and operational workflows
