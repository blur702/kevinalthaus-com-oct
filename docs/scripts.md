# Scripts Reference

This summarizes deployment and maintenance scripts in `scripts/`.

## web

Start/stop all Docker Compose services and resolve port conflicts.

```bash
./scripts/web -on   # start
./scripts/web -off  # stop
```

Ports used: 3000, 3001, 3002, 3003, 5432, 6379, 8000, 8080

## deploy-ubuntu.sh

Automates first-time deployment on Ubuntu (installs Docker/Compose, sets up UFW, builds and starts containers).

```bash
sudo ./scripts/deploy-ubuntu.sh
```

## backup-postgres.sh

Create compressed PostgreSQL backups.

```bash
./scripts/backup-postgres.sh [backup-dir]
```

## restore-postgres.sh

Restore database from a backup file. Destructive.

```bash
./scripts/restore-postgres.sh ./backups/postgres/<backup>.sql.gz
```

## monitor-postgres.sh

Monitor PostgreSQL container health/performance. Human-readable or JSON.

```bash
./scripts/monitor-postgres.sh [--json]
```

## setup-cron.sh

Configure scheduled maintenance (e.g., log cleanup, backups).

```bash
sudo ./scripts/setup-cron.sh
```

