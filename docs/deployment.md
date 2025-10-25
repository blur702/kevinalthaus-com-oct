# Deployment

## Server Requirements

- Ubuntu 20.04/22.04/24.04 LTS
- Docker Engine 20.10+, Docker Compose v2
- 4GB RAM (8GB recommended), 50GB+ disk

## Quick Start (Ubuntu)

```bash
git clone <repository-url>
cd kevinalthaus-com-oct
sudo ./scripts/deploy-ubuntu.sh

# Configure environment
sudo nano /opt/kevinalthaus/.env

# Restart services
cd /opt/kevinalthaus
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

# Setup automated backups
sudo ./scripts/setup-cron.sh
```

## PostgreSQL

**Version**: PostgreSQL 16 (Alpine)

**⚠️ Important**: This project uses PostgreSQL 16, which is a major version upgrade from PostgreSQL 15. Before deploying or upgrading an existing installation, follow the upgrade checklist below.

### PostgreSQL 16 Upgrade Checklist

If upgrading from PostgreSQL 15 or earlier:

1. **Pre-Upgrade Steps**:
   - Take a full backup of your existing database: `./scripts/backup-postgres.sh`
   - Review [PostgreSQL 16 release notes](https://www.postgresql.org/docs/16/release-16.html) for breaking changes
   - Verify that all extensions used in this project are compatible with PostgreSQL 16

2. **Staging Environment Testing**:
   - Deploy PostgreSQL 16 to a staging environment first
   - Restore your production backup to staging
   - Run all database migrations against the staging database
   - Test all application features thoroughly
   - Verify query performance and check for any deprecated features in use

3. **Production Upgrade Path**:
   ```bash
   # 1. Stop all services
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down

   # 2. Backup existing data
   ./scripts/backup-postgres.sh

   # 3. If upgrading in-place, use pg_upgrade (recommended to test in staging first):
   #    See: https://www.postgresql.org/docs/16/pgupgrade.html

   # 4. Or, for a clean upgrade, restore backup to PostgreSQL 16:
   #    - Start new PostgreSQL 16 container with fresh volume
   #    - Restore backup using ./scripts/restore-postgres.sh

   # 5. Start services with PostgreSQL 16
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

   # 6. Run post-upgrade checks
   ./scripts/monitor-postgres.sh
   docker exec -it <postgres-container> psql -U postgres -d kevinalthaus -c "SELECT version();"
   ```

4. **Rollback Plan** (if issues occur):
   ```bash
   # 1. Stop services
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down

   # 2. Change docker-compose.yml image back to postgres:15-alpine

   # 3. Restore from backup taken before upgrade
   ./scripts/restore-postgres.sh <backup-file>

   # 4. Restart services
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

5. **Expected Downtime**:
   - Small databases (< 1GB): 5-15 minutes
   - Medium databases (1-10GB): 15-60 minutes
   - Large databases (> 10GB): Plan for several hours

### PostgreSQL Configuration

- SSL optional via `POSTGRES_USE_SSL`
- In dev, self-signed certs can be generated automatically when enabled
- Access: `docker exec -it <postgres-container> psql -U postgres -d kevinalthaus`

Connection string example:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres:5432/kevinalthaus
```

## Critical Secrets (set in .env)

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `PLUGIN_SIGNATURE_SECRET`, `ADMIN_PASSWORD`
- `COOKIE_SAMESITE` (lax/strict/none) — use `lax` unless you require cross-site cookies with HTTPS

## Backups

- Automated backups via `postgres-backup` service
- Manual backup: `./scripts/backup-postgres.sh`
- Restore: `./scripts/restore-postgres.sh <backup-file>` (destructive)

## Monitoring

- Health: `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps`
- Logs: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f`
- DB health: `./scripts/monitor-postgres.sh [--json]`

## Production Notes

- Only API Gateway is publicly exposed
- Internal services (main-app, python) should not publish host ports
- Use strong secrets and configure firewall (UFW)

