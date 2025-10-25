#!/bin/bash
# ========================================
# WAL Archive Wrapper Script
# ========================================
# PostgreSQL archive_command wrapper with error handling,
# logging, and atomic operations.
#
# Called by PostgreSQL with arguments:
#   $1 = %p (full path to WAL file)
#   $2 = %f (WAL filename only)
#
# Returns:
#   0 = success (PostgreSQL marks WAL as archived)
#   non-zero = failure (PostgreSQL will retry)
# ========================================

set -euo pipefail

# Configuration
BACKUP_DIR="${WAL_ARCHIVE_DIR:-/backups/wal}"
LOG_FILE="${WAL_ARCHIVE_LOG:-/var/log/postgresql/wal-archive.log}"
MAX_RETRIES=3
RETRY_DELAY=1

# Arguments
WAL_PATH="${1:?WAL path required}"
WAL_FILE="${2:?WAL filename required}"

# Logging function
log() {
    local level="$1"
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" >> "$LOG_FILE" 2>&1 || true
}

# Ensure backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR" 2>&1 | tee -a "$LOG_FILE" || {
        log "ERROR" "Failed to create backup directory: $BACKUP_DIR"
        exit 1
    }
    log "INFO" "Created backup directory: $BACKUP_DIR"
fi

# Validate inputs
if [ ! -f "$WAL_PATH" ]; then
    log "ERROR" "WAL file does not exist: $WAL_PATH"
    exit 1
fi

# Atomic copy with retries
TEMP_FILE="$BACKUP_DIR/${WAL_FILE}.tmp.$$"
DEST_FILE="$BACKUP_DIR/$WAL_FILE"

attempt=0
while [ $attempt -lt $MAX_RETRIES ]; do
    attempt=$((attempt + 1))

    # Copy to temporary file
    if cp "$WAL_PATH" "$TEMP_FILE" 2>&1 | tee -a "$LOG_FILE"; then
        # Verify file was copied correctly
        if [ -f "$TEMP_FILE" ]; then
            # Atomic rename
            if mv "$TEMP_FILE" "$DEST_FILE" 2>&1 | tee -a "$LOG_FILE"; then
                log "INFO" "Archived WAL file: $WAL_FILE (attempt $attempt)"
                exit 0
            else
                log "ERROR" "Failed to rename $TEMP_FILE to $DEST_FILE (attempt $attempt)"
            fi
        else
            log "ERROR" "Temporary file not found after copy: $TEMP_FILE (attempt $attempt)"
        fi
    else
        log "ERROR" "Failed to copy $WAL_PATH to $TEMP_FILE (attempt $attempt)"
    fi

    # Cleanup temp file on failure
    rm -f "$TEMP_FILE" 2>/dev/null || true

    # Wait before retry (except on last attempt)
    if [ $attempt -lt $MAX_RETRIES ]; then
        sleep $RETRY_DELAY
    fi
done

log "ERROR" "Failed to archive WAL file after $MAX_RETRIES attempts: $WAL_FILE"
exit 1
