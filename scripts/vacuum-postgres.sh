#!/bin/bash
# PostgreSQL VACUUM ANALYZE Script
# Optimizes database performance by reclaiming space and updating statistics
#
# Usage: ./scripts/vacuum-postgres.sh <container-name> <postgres-user> <postgres-db> <log-file>

set -euo pipefail

# Arguments
CONTAINER_NAME="${1:?Container name required}"
POSTGRES_USER="${2:?Postgres user required}"
POSTGRES_DB="${3:?Postgres database required}"
LOG_FILE="${4:?Log file path required}"

# Timestamp for logging
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Ensure log directory exists
LOG_DIR="$(dirname "$LOG_FILE")"
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Check if container is running using exact name match
# Use docker ps with --format to get Names column, then grep for exact match
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[$(timestamp)] Running VACUUM ANALYZE on database: $POSTGRES_DB" >> "$LOG_FILE" 2>&1

    # Run VACUUM ANALYZE and append output to log
    if docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'VACUUM ANALYZE;' >> "$LOG_FILE" 2>&1; then
        echo "[$(timestamp)] VACUUM ANALYZE completed successfully" >> "$LOG_FILE" 2>&1
    else
        echo "[$(timestamp)] ERROR: VACUUM ANALYZE failed with exit code $?" >> "$LOG_FILE" 2>&1
        exit 1
    fi
else
    echo "[$(timestamp)] Container $CONTAINER_NAME not running, skipping VACUUM ANALYZE" >> "$LOG_FILE" 2>&1
fi
