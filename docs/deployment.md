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

- SSL optional via `POSTGRES_USE_SSL`
- In dev, self-signed certs can be generated automatically when enabled
- Access: `docker exec -it <postgres-container> psql -U postgres -d kevinalthaus`

Connection string example:
```
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

