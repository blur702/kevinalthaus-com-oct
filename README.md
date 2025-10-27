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
- Security: `docs/security.md`
- Implementation Status: `docs/status.md`
- Scripts: `docs/scripts.md`

## Quick Start

**Prerequisites:** Node.js 20+, Docker, Docker Compose, OpenSSL (for production SSL)

```bash
# Clone and setup
# Replace with your actual repository URL (HTTPS or SSH)
git clone https://github.com/blur702/kevinalthaus-com-oct.git
# Or using SSH:
git clone git@github.com:blur702/kevinalthaus-com-oct.git
cd kevinalthaus-com-oct
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# For production: Generate SSL certificates for PostgreSQL
# Create secrets directory and generate self-signed certs
mkdir -p secrets
./scripts/generate-ssl-certs.sh

# Start services
docker-compose up -d postgres redis
npm run dev:all
```

### Breaking Change: PostgreSQL 16 Upgrade

This repo now uses `postgres:16-alpine`. If you previously ran with Postgres 15, existing volumes are NOT compatible. Migrate data before switching images.

Quick migration steps from Postgres 15:

1) Backup all databases from the running Postgres 15 container:

```
docker exec kevinalthaus-postgres pg_dumpall -U postgres -f /backups/pre-upgrade.sql
docker cp kevinalthaus-postgres:/backups/pre-upgrade.sql ./pre-upgrade.sql
```

2) Stop stack and remove old Postgres volume:

```
docker compose down
docker volume rm kevinalthaus-com-oct_postgres_data
```

3) Start fresh Postgres 16 and services:

```
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
- **API Gateway** (Express.js) - Central routing, auth, rate limiting
- **Main App** (Node.js) - Core business logic, user management
- **Python Service** (FastAPI) - Specialized Python ecosystem services
- **Frontend** (React + Material-UI) - Public interface
- **Admin Panel** (React + Material-UI) - Management interface
- **Plugin Engine** (Node.js) - Isolated plugin execution
- **Database** (PostgreSQL) - Primary data store
- **Cache** (Redis) - Sessions and caching

## Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/name`
3. Make changes and add tests
4. Run checks: `npm test && npm run lint`
5. Submit pull request

## License

MIT License - see LICENSE file for details.
