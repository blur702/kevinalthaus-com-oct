# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kevin Althaus Platform is a Lerna-managed monorepo featuring a microservices architecture with a powerful plugin system. The platform consists of multiple Node.js/TypeScript services (API Gateway, Main App, Frontend, Admin Panel), a Python FastAPI service, and a shared utilities package.

## Repository Structure

This is a **Lerna monorepo** with the following packages:

- `packages/shared` - Common utilities, types, security functions, and plugin system interfaces
- `packages/api-gateway` - Central routing, authentication, rate limiting
- `packages/main-app` - Core business logic and plugin coordination
- `packages/frontend` - Public-facing React application (Vite + Material UI)
- `packages/admin` - Administrative dashboard (React + Material UI)
- `python/` - FastAPI service for Python-specific features

**Key architectural files to review:**
- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) - Detailed service architecture and integration patterns
- [PLUGIN_DEVELOPMENT_GUIDE.md](PLUGIN_DEVELOPMENT_GUIDE.md) - Plugin system implementation guide
- [API_REFERENCE.md](API_REFERENCE.md) - Complete API documentation

## Common Commands

### Development

```bash
# Install all dependencies (uses Lerna)
npm install

# Start all services in development mode
npm run dev

# Start individual services
cd packages/api-gateway && npm run dev
cd packages/main-app && npm run dev
cd packages/frontend && npm run dev
cd packages/admin && npm run dev
cd python && uvicorn main:app --reload

# Start required infrastructure
docker-compose up -d postgres redis
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

### Testing

```bash
# Run all tests
npm test

# Run tests for specific package
cd packages/main-app && npm test

# Run tests in watch mode
cd packages/main-app && npm run test:watch

# Run with coverage
cd packages/main-app && npm run test:coverage
```

**Test configuration:** Uses Jest with ts-jest preset. Test files are located in `src/__tests__/**/*.test.ts` within each package.

### Code Quality

```bash
# Lint all code
npm run lint

# Format code with Prettier
npm run format

# Type-check frontend packages
cd packages/frontend && npm run type-check
```

## Architecture Patterns

### Monorepo Dependencies

All packages reference the shared package using TypeScript project references:
- Use `@monorepo/shared` to import common utilities
- The shared package exports: types, security, plugin interfaces, database utilities, theme system
- When modifying shared package, run `npm run build` in the shared directory to update references

### Plugin System Architecture

**Critical pattern:** The plugin system uses database schema isolation. Each plugin gets its own PostgreSQL schema (`plugin_<plugin_name>`).

Key shared modules for plugins:
- `packages/shared/src/plugin/` - Plugin lifecycle, manifest parsing, registry
- `packages/shared/src/database/plugin-database.ts` - Plugin database isolation
- `packages/shared/src/security/` - Security, hashing, RBAC, sanitization

**Plugin lifecycle hooks:**
```typescript
interface PluginLifecycleHooks {
  onInstall?(context: PluginExecutionContext): Promise<void>;
  onActivate?(context: PluginExecutionContext): Promise<void>;
  onDeactivate?(context: PluginExecutionContext): Promise<void>;
  onUninstall?(context: PluginExecutionContext): Promise<void>;
}
```

### Service Communication

- **API Gateway** (port 3000) proxies requests to backend services
- **Main App** (port 3001) handles core business logic
- **Python Service** (port 8000) provides Python-specific functionality
- **Frontend** (port 3002) and **Admin** (port 3003) are client applications

Services communicate through the API Gateway. Direct service-to-service communication should go through the gateway for authentication/rate limiting.

### Error Handling Pattern

All services implement consistent error handling:
- Global error handlers log with error IDs for traceability
- Health check endpoints at `/health` on all services
- Graceful shutdown with cleanup handlers (see `packages/main-app/src/server.ts`)

### Database Patterns

- **PostgreSQL** is the primary database
- **Schema isolation** for plugins (see `packages/shared/src/database/isolation.ts`)
- **Connection pooling** with configured limits (min: 2, max: 10)
- Row-level security policies for multi-tenant data

## Environment Configuration

Copy `.env.example` to `.env` and configure:

**Critical environment variables:**
- `POSTGRES_*` - Database connection details
- `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY` - Security keys (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `API_GATEWAY_PORT`, `MAIN_APP_PORT` - Service ports
- `ENABLE_PLUGIN_SYSTEM`, `ENABLE_THEME_SYSTEM` - Feature flags

## TypeScript Configuration

- Root `tsconfig.json` uses **TypeScript project references** for composite builds
- All packages use strict mode with comprehensive compiler options
- Target: ES2020, Module: CommonJS for backend, ESM for frontend
- Frontend packages use Vite with special tsconfig configuration

## Important Patterns & Conventions

### Shared Package Usage

Always import from `@monorepo/shared` for:
- Security functions (hashing, validation, sanitization)
- Plugin system interfaces and types
- Database utilities and isolation helpers
- Common constants and type definitions
- Theme system types

### Security Best Practices

This codebase prioritizes security:
- All user inputs validated and sanitized (using `ajv`, `sanitize-html`, `validator`)
- Password hashing with bcrypt
- SQL injection prevention through parameterized queries
- Plugin sandboxing with resource quotas
- RBAC implementation in `packages/shared/src/security/rbac.ts`

### Plugin Development Workflow

1. Create plugin directory with `plugin.yaml` manifest
2. Implement lifecycle hooks from `PluginLifecycleHooks`
3. Plugin receives isolated database schema on activation
4. Access shared utilities via `PluginExecutionContext`
5. Follow resource quotas and security policies

### React Application Patterns

Both Frontend and Admin use:
- React 18 with TypeScript
- Material UI 5 for components
- Vite for build tooling
- React Router for navigation
- Axios for API calls

## Development Workflow

1. **Start infrastructure:** `docker-compose up -d postgres redis`
2. **Install dependencies:** `npm install`
3. **Build shared package:** `cd packages/shared && npm run build`
4. **Start services:** Run individual service dev scripts or use `npm run dev`
5. **Make changes:** Edit TypeScript files, hot reload is enabled
6. **Run tests:** Test changes before committing
7. **Lint/format:** Use `npm run lint` and `npm run format`

## Service Ports

- API Gateway: 3000
- Main App: 3001
- Frontend: 3002
- Admin: 3003
- Plugin Engine: 3004 (if applicable)
- Python Service: 8000
- PostgreSQL: 5432
- Redis: 6379

## Docker Support

Full Docker Compose setup available:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Additional Resources

- Health checks available at `/health` on all services
- API documentation at `/docs` on Python service (dev mode only)
- Plugin marketplace features planned in roadmap
- See SYSTEM_ARCHITECTURE.md for database schema details and deployment strategy
