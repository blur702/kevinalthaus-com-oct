# Production Deployment Guide

## Ubuntu Server Deployment with PostgreSQL 16

This guide covers deploying the Kevin Althaus platform on Ubuntu 20.04/22.04 LTS with production-ready PostgreSQL configuration.

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd kevinalthaus-com-oct

# 2. Run the deployment script
sudo ./scripts/deploy-ubuntu.sh

# 3. Configure environment variables
sudo nano /opt/kevinalthaus/.env

# 4. Generate secure secrets
openssl rand -hex 32

# 5. Restart services
cd /opt/kevinalthaus
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

# 6. Setup automated backups
sudo ./scripts/setup-cron.sh
```

## Server Requirements

- **OS**: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk**: Minimum 20GB (50GB+ recommended)
- **Ports**: 80, 443, 5432 (optional for external access)
- **Software**: Docker Engine 20.10+, Docker Compose V2

## PostgreSQL Configuration

### Simple Docker Command (Development)

The basic PostgreSQL setup:

```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kevinalthaus \
  -p 5432:5432 \
  -d postgres:16
```

### Production Docker Compose Setup

Our production setup improves upon the basic command with:

- **Health checks**: Automatic container restart on failure
- **Persistent volumes**: Data survives container restarts
- **Automated backups**: WAL archiving and daily backups
- **Performance tuning**: Optimized postgresql.conf
- **Security**: Authentication via pg_hba.conf, restricted network access
- **Resource limits**: CPU and memory constraints
- **Monitoring**: Built-in health check endpoints

Start production services:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Accessing PostgreSQL

```bash
# Connect to PostgreSQL CLI
docker exec -it kevinalthaus-postgres-1 psql -U postgres -d kevinalthaus

# View logs
docker logs kevinalthaus-postgres-1

# Check status
docker ps | grep postgres
```

## Environment Configuration

### Critical Security Settings

**MUST CHANGE before deploying:**

```bash
# Generate secure secrets (run multiple times for each secret)
openssl rand -hex 32

# Edit .env file
nano /opt/kevinalthaus/.env
```

Required changes:

- `POSTGRES_PASSWORD` - Strong database password
- `JWT_SECRET` - Random 32-byte hex string
- `SESSION_SECRET` - Random 32-byte hex string
- `ENCRYPTION_KEY` - Random 32-byte hex string
- `PLUGIN_SIGNATURE_SECRET` - Random 32-byte hex string
- `ADMIN_PASSWORD` - Change default admin password
- `COOKIE_SAMESITE` - Cookie SameSite policy (see Cookie Security below)

### Cookie Security

The `COOKIE_SAMESITE` setting controls the SameSite attribute for authentication cookies:

- **`lax` (default)**: Recommended for most deployments. Provides CSRF protection while allowing cookies on top-level navigation (e.g., clicking links from external sites). Best balance of security and usability.

- **`strict`**: Maximum CSRF protection. Cookies are never sent on cross-site requests. Use when your application never needs to be accessed via cross-site links.

- **`none`**: Required for cross-domain authentication (e.g., subdomain scenarios). **Important**: When set to `none`, the `secure` flag is automatically enabled, **requiring HTTPS**. Will not work over HTTP. Only use when you need cross-site cookie sending and have HTTPS properly configured.

**Production Recommendation**: Use `lax` for single-domain deployments behind HTTPS. Use `none` only for legitimate cross-domain scenarios with HTTPS enforced.

### Connection String

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres:5432/kevinalthaus
```

## Backup and Recovery

### Automated Backups

Backups run daily at 2:00 AM via cron:

```bash
# Setup automated backups
sudo ./scripts/setup-cron.sh

# View backup logs
tail -f /opt/kevinalthaus/logs/cron/backup.log
```

### Manual Backup

```bash
# Create backup
./scripts/backup-postgres.sh

# Backups stored in: ./backups/postgres/
```

### Restore from Backup

```bash
# List available backups
ls -lh ./backups/postgres/

# Restore (DESTRUCTIVE - replaces current database)
./scripts/restore-postgres.sh ./backups/postgres/backup_kevinalthaus_20240101_020000.sql.gz
```

## Monitoring

### Health Checks

```bash
# Check all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# PostgreSQL health check
./scripts/monitor-postgres.sh

# JSON output (for monitoring tools)
./scripts/monitor-postgres.sh --json

# Check specific service health
docker exec kevinalthaus-postgres-1 pg_isready -U postgres
```

### View Logs

```bash
# All services
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# PostgreSQL only
docker logs -f kevinalthaus-postgres-1

# Application logs
tail -f /opt/kevinalthaus/logs/app.log
```

### Database Performance

```sql
-- Connect to database
docker exec -it kevinalthaus-postgres-1 psql -U postgres -d kevinalthaus

-- View database health
SELECT * FROM v_database_health;

-- View connection stats
SELECT * FROM v_connection_stats;

-- View table sizes
SELECT * FROM v_table_sizes;

-- View slow queries
SELECT * FROM v_slow_queries;

-- Query performance statistics
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

## Security Best Practices

1. **Change all default passwords immediately**
2. **Use strong, unique secrets** (minimum 32 characters)
3. **Configure firewall** (UFW automatically configured by deploy script)
4. **Enable SSL/TLS** for external connections
5. **Regular security updates**: `apt update && apt upgrade`
6. **Restrict database access** via pg_hba.conf
7. **Encrypt backups** if storing remotely
8. **Monitor logs** for suspicious activity

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if container is running
docker ps | grep postgres

# Check logs for errors
docker logs kevinalthaus-postgres-1

# Test connection
docker exec kevinalthaus-postgres-1 pg_isready -U postgres

# Verify network
docker network inspect kevinalthaus-com-oct_app_network
```

### Container Won't Start

```bash
# View detailed logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs postgres

# Check disk space
df -h

# Verify configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

### Performance Issues

```bash
# Check resource usage
docker stats

# View slow queries
./scripts/monitor-postgres.sh

# Optimize database
docker exec kevinalthaus-postgres-1 psql -U postgres -d kevinalthaus -c "VACUUM ANALYZE;"
```

## Updating

### Application Updates

```bash
# Pull latest code
cd /opt/kevinalthaus
git pull

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Database Migrations

```bash
# Migrations run automatically on container start
# Check migration logs
docker logs kevinalthaus-main-app-1 | grep Migration
```

## Uninstallation

```bash
# Stop all services
cd /opt/kevinalthaus
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Remove volumes (DESTRUCTIVE - deletes all data)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v

# Remove application directory
sudo rm -rf /opt/kevinalthaus

# Remove cron jobs
crontab -l | grep -v kevinalthaus | crontab -
```

## Additional Resources

- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Ubuntu Server Guide](https://ubuntu.com/server/docs)

## Support

For issues or questions:

1. Check logs: `docker compose logs -f`
2. Review health checks: `./scripts/monitor-postgres.sh`
3. Consult troubleshooting section above
4. Check GitHub issues
### SSL Certificates for PostgreSQL

PostgreSQL is configured with `ssl = on` and expects the certificate and key at:

- `/etc/ssl/certs/server.crt`
- `/etc/ssl/private/server.key`

In production, `docker-compose.prod.yml` mounts these from `./secrets/server.crt` and `./secrets/server.key` (read-only).
Provide your certificate and key with the following requirements:

- `server.key` permissions must be `600` and owned by the `postgres` user.
- Use a certificate/key signed by a trusted CA, or a self-signed cert for staging.

Example (self-signed for staging):

```
mkdir -p secrets
openssl req -new -x509 -days 365 -nodes -text \
  -out secrets/server.crt -keyout secrets/server.key \
  -subj "/CN=postgres.local"
chmod 600 secrets/server.key
```

If certificates are not present, the Postgres service will fail to start while `ssl = on`.

### Statement Timeout Guidance

The default `statement_timeout` is set to 120 seconds to avoid prematurely terminating legitimate long‑running operations.
For clients with short‑lived queries, set a lower timeout per session or role:

```
SET statement_timeout = '15s';
-- or
ALTER ROLE app_user SET statement_timeout = '15s';
```
