# AI Coding Agent Instructions

## Architecture Overview

**Microservices Platform** with API Gateway routing, plugin system, and defense-in-depth security.

### Service Communication Flow
```
Client → API Gateway (:3000 dev / :4000 prod)
           ↓
           ├─→ Main App (:3001) → PostgreSQL, Redis
           ├─→ Python Service (:8000)
           └─→ Plugin Engine (:3004)

Frontend (:3002) / Admin (:3003) → API Gateway
```

**Critical**: In production, only API Gateway, Frontend, and Admin expose host ports. All backend services communicate via Docker network.

### Plugin System
- **Isolated schemas**: Each plugin gets `plugin_<name>` PostgreSQL schema
- **Capability-based permissions**: `database:read`, `database:write`, `api:call`
- **YAML manifests**: Define routes, capabilities, lifecycle hooks
- **Shared package**: Import `@monorepo/shared` for types, security, utilities

## Essential Development Commands

### Full Stack Development
```bash
# Start all services with port cleanup (RECOMMENDED)
npm run dev:clean

# Alternative: Manual port cleanup then start
npm run ports:cleanup && npm run dev

# Quick Docker orchestration
./scripts/web -on              # Start all services
./scripts/web -off             # Stop all services
```

### Code Quality
```bash
npm run build                  # TypeScript compilation across monorepo
npm run lint                   # ESLint with security rules
npm run format                 # Prettier formatting
```

### Database & Security
```bash
./scripts/ensure-jwt-secret.sh  # Generate persistent JWT_SECRET (REQUIRED)
./scripts/backup-postgres.sh    # Database backup
./scripts/restore-postgres.sh   # Database restore
```

## Security Patterns

### Authentication & Authorization
- **JWT tokens**: Access (15min) + refresh (30 days) with httpOnly cookies
- **RBAC**: `admin`, `editor`, `viewer` roles with fine-grained capabilities
- **CSRF protection**: Double-submit cookie pattern on admin routes
- **Timing-safe operations**: Password verification prevents timing attacks

### Input Validation & Sanitization
```typescript
import { stripHTML, sanitizeFilename, validateEmail } from '@monorepo/shared';

// Always sanitize user input
const cleanInput = stripHTML(userInput);
const safeFilename = sanitizeFilename(uploadedFile.name);
```

### Database Security
- **Parameterized queries only**: `query('SELECT * FROM users WHERE id = $1', [userId])`
- **Query isolation enforcer**: Prevents complex queries, enforces row limits
- **Transactions**: Use `transaction()` for multi-statement operations

## Code Patterns

### Express Route Handlers
```typescript
// Async handlers with proper error handling
router.post('/api/endpoint', authMiddleware, requireCapability(Capability.USER_EDIT),
  async (req: Request, res: Response): Promise<void> => {
    // Handler logic
  }
);
```

### Plugin Development
```typescript
// plugin.yaml
name: my-plugin
capabilities:
  - database:read
  - database:write
entrypoint: dist/index.js

// Handler with execution context
export async function handler(ctx: PluginExecutionContext) {
  const result = await ctx.db?.query('SELECT * FROM plugin_my-plugin.table');
  ctx.logger.info('Plugin executed', { resultCount: result?.rowCount });
}
```

### Shared Package Usage
```typescript
import {
  hashPassword, verifyPassword,  // Security
  generateRequestId,             // Middleware
  Role, Capability,              // Types
  QueryIsolationEnforcer        // Database
} from '@monorepo/shared';
```

## Database Patterns

### Migrations
- **Automatic execution**: Run on app startup with advisory locks
- **Tracking**: Stored in `migrations` table
- **Location**: `packages/main-app/src/db/migrations.ts`

### Schema Isolation
- **Core tables**: `users`, `refresh_tokens`, `migrations`, `audit_log`
- **Plugin schemas**: `plugin_<name>` with dedicated connections
- **No cross-plugin access**: Enforced by capability system

## Testing & Quality

### E2E Testing
```bash
npm run test:e2e              # Run all Playwright tests
npm run test:e2e:ui           # Interactive test runner
npm run test:e2e:headed       # Headed browser mode
```

### Unit Tests
```bash
cd packages/main-app && npm test        # Jest tests for specific package
cd packages/main-app && npm run test:watch  # Watch mode
```

## Environment Configuration

### Critical Variables
- `JWT_SECRET`: Required for all deployments (use `./scripts/ensure-jwt-secret.sh`)
- `POSTGRES_PASSWORD`: Database password
- `CSRF_SECRET`: CSRF token signing

### Service URLs (Development)
```
MAIN_APP_URL=http://localhost:3001
PYTHON_SERVICE_URL=http://localhost:8000
PLUGIN_ENGINE_URL=http://localhost:3004
```

### Service URLs (Production Docker)
```
MAIN_APP_URL=http://main-app:3001
PYTHON_SERVICE_URL=http://python-service:8000
PLUGIN_ENGINE_URL=http://plugin-engine:3004
```

## Common Pitfalls

### Port Conflicts
**Solution**: Always use `npm run dev:clean` or `./scripts/web -on` (auto-cleanup)

### JWT_SECRET Missing
**Solution**: Run `./scripts/ensure-jwt-secret.sh` once, persist across restarts

### Plugin Not Loading
**Check**: Valid YAML manifest, granted capabilities, Plugin Engine logs

### Database Connection Issues
**Check**: Postgres healthy, correct connection string, SSL mode settings

## File Structure Reference

- `packages/shared/src/` - Common utilities, types, security functions
- `packages/main-app/src/routes/` - API endpoints with auth middleware
- `packages/main-app/src/db/` - Database connections, migrations, isolation
- `plugins/*/plugin.yaml` - Plugin manifests with capabilities and routes
- `plugins/*/src/` - Plugin backend handlers
- `plugins/*/frontend/` - Plugin React components
- `docs/` - Comprehensive documentation for all systems</content>
<parameter name="filePath">e:\dev\kevinalthaus-com-oct\.github\copilot-instructions.md