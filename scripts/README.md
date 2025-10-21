# Deployment and Maintenance Scripts

This directory contains scripts for deploying and maintaining the Kevin Althaus platform on Ubuntu production servers.

## Scripts Overview

### web
**Purpose**: Quick service management script for starting and stopping all Docker Compose services

**Usage**:
```bash
# Start all services
./scripts/web -on

# Stop all services
./scripts/web -off

# Show help information
./scripts/web --help
```

**What it does**:

*For `-on` flag:*
- Checks if ports (3000, 3001, 3002, 3003, 5432, 6379, 8000, 8080) are in use
- Detects and kills processes using those ports
- Starts all Docker Compose services with `docker compose up -d --build`
- Waits for health checks to pass (up to 2 minutes)
- Displays service status and access URLs

*For `-off` flag:*
- Gracefully stops all services with `docker compose down`
- Verifies all containers are stopped
- Displays shutdown confirmation

**When to use**:
- Quick development environment startup/shutdown
- Resolving port conflicts before starting services
- Daily development workflow

**Adding to PATH**:

To use the `web` command from anywhere:

*Option 1 - Create symlink (requires sudo):*
```bash
sudo ln -s $(pwd)/scripts/web /usr/local/bin/web
```

*Option 2 - Add to PATH in shell config:*
```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/kevinalthaus-com-oct/scripts"

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc
```

After setup, you can run `web -on` from anywhere.

**Note**: Make script executable first:
```bash
chmod +x scripts/web
```

**Troubleshooting**:
- **Port already in use**: The script automatically kills conflicting processes, but if issues persist, manually check with `lsof -i :PORT`
- **Docker not running**: Start Docker daemon with `sudo systemctl start docker` (Linux) or start Docker Desktop (Windows/Mac)
- **Services not healthy**: Check logs with `docker compose logs -f [service-name]`
- **Permission denied**: Make script executable with `chmod +x scripts/web`

---

### deploy-ubuntu.sh
**Purpose**: Automated deployment script for Ubuntu servers

**Usage**:
```bash
sudo ./scripts/deploy-ubuntu.sh
```

**What it does**:
- Installs Docker and Docker Compose
- Sets up application directory structure
- Configures firewall (UFW)
- Copies and configures environment files
- Builds and starts Docker containers

**When to use**: First-time deployment on a fresh Ubuntu server

---

### backup-postgres.sh
**Purpose**: Creates compressed PostgreSQL database backups

**Usage**:
```bash
./scripts/backup-postgres.sh [backup-directory]

# Default backup directory: ./backups/postgres
./scripts/backup-postgres.sh

# Custom backup directory
./scripts/backup-postgres.sh /mnt/backups
```

**What it does**:
- Creates timestamped database dump
- Compresses backup with gzip
- Removes backups older than retention period (30 days)
- Verifies backup integrity

**When to use**: Manual backups or scheduled via cron

---

### restore-postgres.sh
**Purpose**: Restores PostgreSQL database from backup file

**Usage**:
```bash
./scripts/restore-postgres.sh <backup-file>

# Example
./scripts/restore-postgres.sh ./backups/postgres/backup_kevinalthaus_20240101_020000.sql.gz
```

**What it does**:
- Stops application services
- Drops and recreates database
- Restores from backup file
- Restarts application services

**When to use**: Disaster recovery, database migration, or testing

**WARNING**: This is a destructive operation. Always confirm before proceeding.

---

### monitor-postgres.sh
**Purpose**: Monitors PostgreSQL database health and performance

**Usage**:
```bash
# Human-readable output
./scripts/monitor-postgres.sh

# JSON output (for monitoring tools)
./scripts/monitor-postgres.sh --json
```

**What it does**:
- Checks container status
- Reports active connections vs max connections
- Shows database size
- Calculates cache hit ratio
- Alerts if connection pool usage > 90%

**When to use**: Manual health checks or scheduled monitoring (every 5 minutes)

**Exit codes**:
- `0`: Healthy
- `1`: Warning (connection pool > 90%)
- `2`: Critical (container not running)

---

### setup-cron.sh
**Purpose**: Configures automated maintenance tasks using cron

**Usage**:
```bash
sudo ./scripts/setup-cron.sh
```

**What it does**:
- Installs cron jobs for automated tasks:
  - Daily backup at 2:00 AM
  - PostgreSQL monitoring every 5 minutes
  - Weekly database vacuum on Sundays at 3:00 AM
  - Weekly log cleanup on Sundays at 4:00 AM

**When to use**: After initial deployment to automate maintenance

**View installed cron jobs**:
```bash
crontab -l
```

---

## Common Tasks

### Make Scripts Executable

```bash
chmod +x scripts/*.sh
```

### View Script Logs

```bash
# Cron job logs
ls -la /opt/kevinalthaus/logs/cron/

# Backup logs
tail -f /opt/kevinalthaus/logs/cron/backup.log

# Monitoring logs
tail -f /opt/kevinalthaus/logs/cron/monitor.log
```

### Test Scripts Locally

```bash
# Test backup (development environment)
./scripts/backup-postgres.sh ./test-backups

# Test monitoring
./scripts/monitor-postgres.sh

# Test restore (use test backup)
./scripts/restore-postgres.sh ./test-backups/backup_kevinalthaus_*.sql.gz
```

## Troubleshooting

### Permission Issues

```bash
# Scripts not executable
chmod +x scripts/*.sh

# Script requires root
sudo ./scripts/deploy-ubuntu.sh
```

### Docker Connection Problems

```bash
# Ensure Docker is running
sudo systemctl status docker

# Check if user is in docker group
groups

# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

### Script Execution Errors

```bash
# View detailed error output
bash -x ./scripts/script-name.sh

# Check Docker container names
docker ps -a

# Verify environment variables
cat /opt/kevinalthaus/.env
```

## Security Notes

- **Scripts should be run by authorized users only**
- **Backup files contain sensitive data** - secure them appropriately
- **Restrict script directory permissions**: `chmod 700 scripts/`
- **Never commit .env files** to version control
- **Use strong passwords** for all database credentials

## Customization

### Change Backup Retention

Edit `backup-postgres.sh`:
```bash
RETENTION_DAYS=30  # Change to desired days
```

### Modify Cron Schedule

Edit `setup-cron.sh` and adjust cron expressions:
```bash
# Daily at 2 AM
0 2 * * *

# Every 5 minutes
*/5 * * * *

# Weekly on Sundays at 3 AM
0 3 * * 0
```

### Custom Application Directory

Set `APP_DIR` environment variable:
```bash
export APP_DIR=/custom/path
sudo ./scripts/deploy-ubuntu.sh
```

## Integration with Monitoring Tools

### Nagios/Zabbix

```bash
# Use monitor script with exit codes
./scripts/monitor-postgres.sh
echo $?  # 0=OK, 1=WARNING, 2=CRITICAL
```

### Prometheus

```bash
# JSON output can be parsed by exporters
./scripts/monitor-postgres.sh --json
```

### Webhooks

Add webhook notifications to scripts:
```bash
# In backup-postgres.sh, add after successful backup:
curl -X POST https://your-webhook-url \
  -H "Content-Type: application/json" \
  -d '{"status":"success","backup":"'$BACKUP_FILE'"}'
```

## Additional Resources

- [Cron Documentation](https://man7.org/linux/man-pages/man5/crontab.5.html)
- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
