#!/bin/bash
# PostgreSQL Restore Script
# Usage: ./scripts/restore-postgres.sh <backup-file>

set -euo pipefail

BACKUP_FILE="$1"
CONTAINER_NAME="${CONTAINER_NAME:-kevinalthaus-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Validate backup file integrity
echo "[$(date)] Validating backup file integrity..."
if ! gzip -t "$BACKUP_FILE"; then
    echo "ERROR: Backup file is corrupt or not a valid gzip archive: $BACKUP_FILE"
    exit 1
fi
echo "[$(date)] Backup file validation: SUCCESS"

echo "WARNING: This will REPLACE the current database with the backup!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo "[$(date)] Starting PostgreSQL restore from $BACKUP_FILE..."

# Stop application services
echo "[$(date)] Stopping application services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop api-gateway main-app

# Drop and recreate database (using psql variable substitution for safe identifier quoting)
echo "[$(date)] Recreating database..."
docker exec -t "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -v dbname="$POSTGRES_DB" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'dbname' AND pid <> pg_backend_pid();"
docker exec -t "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
docker exec -t "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -c "CREATE DATABASE \"$POSTGRES_DB\";"

# Restore from backup
echo "[$(date)] Restoring from backup..."
gunzip < "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

# Restart application services
echo "[$(date)] Restarting application services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml start api-gateway main-app

echo "[$(date)] Restore completed successfully"
