# Kevin Althaus Platform

Modern, extensible web platform with microservices architecture and plugin system.

## Key Features

- Plugin System - Extensible architecture with security sandboxing
- Theme System - Frontend/backend customization via plugins
- Security - RBAC, input validation, timing-safe operations
- Admin Dashboard - User management, plugin management, analytics
- Docker Ready - Full containerization with production configs
- Scalable - Microservices with independent scaling

## Documentation

Full docs are now consolidated under `/docs`:

- Setup & Development: `docs/getting-started.md`
- Architecture: `docs/architecture.md`
- Plugin Development: `docs/plugins.md`
- API Reference: `docs/api.md`
- Deployment: `docs/deployment.md`
- Server Infrastructure: `docs/server-infrastructure.md`
- Security: `docs/security.md`
- Implementation Status: `docs/status.md`
- Scripts: `docs/scripts.md`
- CodeRabbit CLI Integration: `docs/coderabbit-cli.md`

## Quick Start

**Prerequisites:** Node.js 20+, Docker, Docker Compose, OpenSSL (for production SSL)

```bash
# Clone and setup
# Replace <your-repo-url> with your repository URL (HTTPS or SSH)
git clone <your-repo-url>
# Example HTTPS: git clone https://github.com/<your-username>/<your-repo>.git
# Example SSH: git clone git@github.com:<your-username>/<your-repo>.git
cd <your-repo>
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings
# Update config/config.*.js as needed, then validate
npm run validate:config

# Generate JWT secret (required for authentication)
./scripts/ensure-jwt-secret.sh

# For production: Generate SSL certificates for PostgreSQL
# Create secrets directory and generate self-signed certs
mkdir -p secrets
./scripts/generate-ssl-certs.sh

# Start services
docker-compose up -d postgres redis
npm run dev:all
```

## Configuration

This repository uses a two-tier configuration system to keep non-secret settings tracked in Git while isolating sensitive values in `.env` files:

- **Config files**: `config/config.development.js` and `config/config.production.js` hold ports, service URLs, feature flags, logging levels, rate limits, and other non-secret knobs. Edit these files to customize behavior per environment. The loader in `config/index.ts` automatically picks the correct file according to `NODE_ENV`.
- **.env files**: store only secrets (JWT_SECRET, database passwords, API keys, Vault/AppRole credentials, etc.). Copy `.env.example` to `.env`, fill in secure values, and never commit the file.

`NODE_ENV` controls which config file is loaded. Update `config/config.production.js` for production overrides and keep `.env` for secrets on the server. Remember that the Vite-based frontend/admin apps read config at build time, so restart/rebuild after changing config files.

Whenever you edit a config file, run the validation script to ensure both environments define every required key before starting services or sending a pull request:

```bash
npm run validate:config
```

### Breaking Change: JWT_SECRET Required

**Action Required:** All deployments now require a `JWT_SECRET` environment variable for authentication.

Run the migration script to generate and persist a secure JWT secret:

```bash
./scripts/ensure-jwt-secret.sh
```

**Important:**
- This secret must remain identical across restarts
- Do NOT regenerate unless you want to invalidate all existing tokens
- Keep secure and do NOT commit to version control
- To generate manually: `openssl rand -base64 64`

### Breaking Change: PostgreSQL 16 Upgrade

This repo now uses `postgres:16-alpine`. If you previously ran with Postgres 15, existing volumes are NOT compatible. Migrate data before switching images.

Quick migration steps from Postgres 15:

1) Backup all databases from the running Postgres 15 container:

```bash
docker exec kevinalthaus-postgres pg_dumpall -U postgres -f /backups/pre-upgrade.sql
docker cp kevinalthaus-postgres:/backups/pre-upgrade.sql ./pre-upgrade.sql
```

2) Stop stack and remove old Postgres volume:

```bash
docker compose down
docker volume rm kevinalthaus-com-oct_postgres_data
```

3) Start fresh Postgres 16 and services:

```bash
docker compose up -d postgres
```

4) Restore backup into Postgres 16:

```bash
docker cp ./pre-upgrade.sql kevinalthaus-postgres:/backups/pre-upgrade.sql
# Set POSTGRES_PASSWORD: either source from .env (export POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2))
# or export it manually (export POSTGRES_PASSWORD='your-password-here') before running the command:
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" kevinalthaus-postgres bash -lc "psql -U postgres -f /backups/pre-upgrade.sql"
```

For more details and a staged upgrade path, see `docs/deployment.md`.

## Production Deployment

Production deployments follow a phased approach for reliability and security:

**Phase 1: Server Infrastructure Setup**
```bash
# Setup SSH keys (one-time)
./scripts/setup-ssh-keys.sh

# Deploy infrastructure (Docker, firewall, fail2ban)
./scripts/setup-server-infrastructure.sh
```

**Phase 2: Application Deployment**
```bash
# Deploy application code and containers
./scripts/deploy-to-prod.sh
```

**Phase 3: Production Hardening**
```bash
# Setup SSL, backups, and monitoring
# See docs/deployment.md for details
```

For detailed infrastructure documentation, see `docs/server-infrastructure.md`.
For complete deployment procedures, see `docs/deployment.md`.

**Important for Production:**
- SSL certificates required in `./secrets/`: `server.crt` and `server.key`
- Run `./scripts/generate-ssl-certs.sh` to generate self-signed certs
- For production, replace with CA-signed certificates
- Ensure `server.key` has permissions 600: `chmod 600 ./secrets/server.key`

**Access Points:**
- Frontend: <http://localhost:3002>
- Admin Panel: <http://localhost:3003>
- API Gateway: <http://localhost:3000>
- Main App: <http://localhost:3001>

## Architecture

**Microservices Stack:**
- **API Gateway** (Express.js) - Central routing, auth, rate-limiting
- **Main App** (Node.js) - Core business logic, user management
- **Python Service** (FastAPI) - Specialized Python ecosystem services
- **Frontend** (React + Material-UI) - Public interface
- **Admin Panel** (React + Material-UI) - Management interface
- **Plugin Engine** (Node.js) - Isolated plugin execution
- **Database** (PostgreSQL) - Primary data store
- **Cache** (Redis) - Sessions and caching

## Testing

### Authentication Testing Workflow

This project includes a comprehensive authentication testing system with console monitoring for iterative debugging. The workflow supports test-fix-deploy cycles to achieve bug-free authentication.

**Running Authentication Tests:**

```bash
# Quick smoke tests (recommended for rapid iteration)
npm run test:auth:smoke

# Comprehensive UI authentication tests
npm run test:auth:ui

# API endpoint authentication tests
npm run test:auth:api

# All authentication tests
npm run test:auth:all

# Watch mode (re-run on file changes)
npm run test:auth:watch
```

**Console Monitoring:**

Tests automatically capture and aggregate:
- **Browser console errors**: JavaScript errors, warnings, network failures
- **Server logs**: API Gateway (localhost:3000) and Main App (localhost:3003) error/warn logs
- **All errors**: Aggregated in `test-results/console-errors.log`

**Test-Fix-Deploy Cycle:**

1. Run tests locally: `npm run test:auth:smoke`
2. Review failures and console errors:
   - Test results in `test-results/`
   - Console errors in `test-results/console-errors.log`
   - Detailed cycle report in `AUTH_TEST_CYCLE_REPORT.md`
3. Fix issues locally and test fixes
4. Document fixes in `AUTH_TEST_CYCLE_REPORT.md`
5. Push changes to GitHub
6. SSH agent pulls changes to production server
7. Re-run tests on server
8. Repeat until all tests pass with zero console errors

**Documentation:**
- `AUTH_TEST_CYCLE_REPORT.md` - Detailed test cycle reports and debugging history
- `BUG_TRACKING.md` - High-level bug status and tracking
- `test-results/console-errors.log` - Real-time console error log

**Prerequisites:**
- Node.js 20+ (as specified in package.json engines)
- All services running (API Gateway, Main App, Admin)
- Test credentials configured in environment variables

**Goal:** Achieve all green tests with zero browser console errors, zero API Gateway errors, and zero Main App errors.

### Other Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run smoke tests
npm run test:smoke

# Run regression tests
npm run test:regression

# Run unit tests
npm run test:unit
```

## Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/name`
3. Make changes and add tests
4. Run checks: `npm test && npm run lint`
5. Submit pull request

## License

MIT License - see LICENSE file for details.
