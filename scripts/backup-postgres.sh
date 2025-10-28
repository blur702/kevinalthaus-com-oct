#!/bin/bash
# PostgreSQL Backup Script
# Usage: ./scripts/backup-postgres.sh [backup-directory]
#
# Environment variables:
#   CONTAINER_NAME  - Docker container name for Postgres (default: kevinalthaus-postgres-1)

set -e
set -o pipefail

BACKUP_DIR="${1:-./backups/postgres}"

# Validate BACKUP_DIR for safety
if [ -z "$BACKUP_DIR" ]; then
  echo "[$(date)] ERROR: BACKUP_DIR is empty" >&2
  exit 1
fi

# Resolve path early to handle symlinks and normalize
if ! RESOLVED_BACKUP_DIR="$(realpath -m "$BACKUP_DIR" 2>/dev/null)"; then
  echo "[$(date)] ERROR: Failed to resolve BACKUP_DIR path: $BACKUP_DIR" >&2
  exit 1
fi

# Validate realpath succeeded and returned non-empty result
if [ -z "$RESOLVED_BACKUP_DIR" ]; then
  echo "[$(date)] ERROR: realpath returned empty path for: $BACKUP_DIR" >&2
  exit 1
fi

# Prevent dangerous paths (exact match and prefix match)
DANGEROUS_PATHS=("/" "/root" "/home" "/etc" "/usr" "/bin" "/sbin" "/var" "/sys" "/proc" "/dev")
for dangerous in "${DANGEROUS_PATHS[@]}"; do
  # Check exact match
  if [ "$RESOLVED_BACKUP_DIR" = "$dangerous" ]; then
    echo "[$(date)] ERROR: BACKUP_DIR cannot be set to system path: $RESOLVED_BACKUP_DIR" >&2
    exit 1
  fi
  # Check prefix match (subpath of dangerous directory)
  if [[ "$RESOLVED_BACKUP_DIR" == "$dangerous"/* ]]; then
    echo "[$(date)] ERROR: BACKUP_DIR cannot be under system path $dangerous: $RESOLVED_BACKUP_DIR" >&2
    exit 1
  fi
done

# Additional check: ensure not root directory
if [ "$RESOLVED_BACKUP_DIR" = "/" ]; then
  echo "[$(date)] ERROR: BACKUP_DIR resolves to root directory" >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="${CONTAINER_NAME:-kevinalthaus-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$RESOLVED_BACKUP_DIR"

# Backup filename
BACKUP_FILE="$RESOLVED_BACKUP_DIR/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting PostgreSQL backup..."

# Check if container is running
if ! docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" >/dev/null 2>&1 || \
   [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" != "true" ]; then
    echo "[$(date)] ERROR: Container $CONTAINER_NAME is not running"
    exit 1
fi

# Create backup using temporary file to avoid empty backups on failure
# Note: -t flag removed to prevent TTY control characters from corrupting the binary dump
TEMP_FILE="${BACKUP_FILE}.tmp"
docker exec "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$TEMP_FILE"

# Capture pipeline status for both pg_dump and gzip
PGDUMP_STATUS="${PIPESTATUS[0]}"
GZIP_STATUS="${PIPESTATUS[1]}"

# Verify both pg_dump and gzip succeeded
if [ "$PGDUMP_STATUS" -ne 0 ]; then
    echo "[$(date)] ERROR: pg_dump command failed with exit code $PGDUMP_STATUS"
    rm -f "$TEMP_FILE"
    exit 1
fi

if [ "$GZIP_STATUS" -ne 0 ]; then
    echo "[$(date)] ERROR: gzip command failed with exit code $GZIP_STATUS"
    rm -f "$TEMP_FILE"
    exit 1
fi

if [ ! -s "$TEMP_FILE" ]; then
    echo "[$(date)] ERROR: Backup file is empty or does not exist"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Move to final location only on success
mv "$TEMP_FILE" "$BACKUP_FILE"

# Check backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: $BACKUP_FILE ($BACKUP_SIZE)"

# Verify backup integrity
if [ -s "$BACKUP_FILE" ] && gzip -t "$BACKUP_FILE"; then
    echo "[$(date)] Backup verification: SUCCESS"

    # Validate RESOLVED_BACKUP_DIR before dangerous find -delete operation
    if [ -z "$RESOLVED_BACKUP_DIR" ]; then
        echo "[$(date)] ERROR: RESOLVED_BACKUP_DIR is empty, skipping cleanup" >&2
        exit 1
    fi

    if [ ! -d "$RESOLVED_BACKUP_DIR" ]; then
        echo "[$(date)] ERROR: RESOLVED_BACKUP_DIR is not a directory, skipping cleanup" >&2
        exit 1
    fi

    # Additional safety check: ensure it's not a root or top-level path
    if [ "$RESOLVED_BACKUP_DIR" = "/" ]; then
        echo "[$(date)] ERROR: RESOLVED_BACKUP_DIR is root directory, skipping cleanup" >&2
        exit 1
    fi

    # Remove old backups only after successful verification and validation
    find "$RESOLVED_BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"

    exit 0
else
    echo "[$(date)] Backup verification: FAILED (file is empty or corrupted)"
    rm -f "$BACKUP_FILE"  # Clean up failed backup
    exit 1
fi
