#!/bin/bash
# PostgreSQL Backup Script
# Usage: ./scripts/backup-postgres.sh [backup-directory]

set -e

BACKUP_DIR="${1:-./backups/postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="kevinalthaus-postgres-1"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/wal"

# Backup filename
BACKUP_FILE="$BACKUP_DIR/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting PostgreSQL backup..."

# Create backup
docker exec -t "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

# Check backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: $BACKUP_FILE ($BACKUP_SIZE)"

# Remove old backups (keep last RETENTION_DAYS days)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"

# Verify backup integrity
if [ -s "$BACKUP_FILE" ]; then
    echo "[$(date)] Backup verification: SUCCESS"
    exit 0
else
    echo "[$(date)] Backup verification: FAILED (file is empty)"
    exit 1
fi
