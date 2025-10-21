#!/bin/bash
# PostgreSQL Backup Script
# Usage: ./scripts/backup-postgres.sh [backup-directory]

set -e
set -o pipefail

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

# Check if container is running
if ! docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" >/dev/null 2>&1 || \
   [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" != "true" ]; then
    echo "[$(date)] ERROR: Container $CONTAINER_NAME is not running"
    exit 1
fi

# Create backup using temporary file to avoid empty backups on failure
TEMP_FILE="${BACKUP_FILE}.tmp"
docker exec -t "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$TEMP_FILE"

# Move to final location only on success
mv "$TEMP_FILE" "$BACKUP_FILE"

# Check backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: $BACKUP_FILE ($BACKUP_SIZE)"

# Verify backup integrity
if [ -s "$BACKUP_FILE" ] && gzip -t "$BACKUP_FILE"; then
    echo "[$(date)] Backup verification: SUCCESS"
    
    # Remove old backups only after successful verification
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"
    
    exit 0
else
    echo "[$(date)] Backup verification: FAILED (file is empty or corrupted)"
    rm -f "$BACKUP_FILE"  # Clean up failed backup
    exit 1
fi
