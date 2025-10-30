#!/bin/bash
# PostgreSQL Monitoring Script
# Usage: ./scripts/monitor-postgres.sh [--json]
#
# Exit codes:
#   0 = ready/healthy
#   1 = general error or warning threshold exceeded
#   2 = not ready (container not running or readiness timed out)
#   3 = dependency error (e.g., jq missing for --json)

set -euo pipefail
IFS=$'\n\t'

CONTAINER_NAME="kevinalthaus-postgres-1"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"
FORMAT="${1}"

# Helper function to run psql commands with timeout
# Usage: run_docker_psql <query> [timeout_seconds]
run_docker_psql() {
    local query="$1"
    local timeout_seconds="${2:-5}"
    timeout "$timeout_seconds" docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "$query" 2>/dev/null
}

# Check if container is running using exact name match
RUNNING_CONTAINERS=$(docker ps --filter "name=^${CONTAINER_NAME}$" --format "{{.Names}}" 2>/dev/null)
if [ -z "$RUNNING_CONTAINERS" ]; then
    echo "ERROR: PostgreSQL container '$CONTAINER_NAME' is not running" >&2
    exit 2
fi

# Wait for PostgreSQL to be ready (retry loop with timeout)
MAX_RETRIES=10
RETRY_DELAY=1
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Check if PostgreSQL is ready to accept connections
    if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        sleep $RETRY_DELAY
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: PostgreSQL is not ready after $MAX_RETRIES attempts" >&2
    exit 2
fi

# Get metrics with error handling and timeout
CONNECTIONS=$(run_docker_psql "SELECT count(*) FROM pg_stat_activity;")
CONNECTIONS_EXIT=$?
if [ $CONNECTIONS_EXIT -ne 0 ] || [ -z "$CONNECTIONS" ]; then
    echo "ERROR: Failed to get connection count" >&2
    CONNECTIONS=0
fi

MAX_CONNECTIONS=$(run_docker_psql "SHOW max_connections;")
MAX_CONNECTIONS_EXIT=$?
if [ $MAX_CONNECTIONS_EXIT -ne 0 ] || [ -z "$MAX_CONNECTIONS" ]; then
    echo "ERROR: Failed to get max connections" >&2
    MAX_CONNECTIONS=100
fi

DB_SIZE=$(timeout 5 docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v dbname="$POSTGRES_DB" -t -c "SELECT pg_size_pretty(pg_database_size(:'dbname'));" 2>/dev/null)
DB_SIZE_EXIT=$?
if [ $DB_SIZE_EXIT -ne 0 ] || [ -z "$DB_SIZE" ]; then
    echo "ERROR: Failed to get database size" >&2
    DB_SIZE="unknown"
fi

CACHE_HIT_RATIO=$(timeout 5 docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v dbname="$POSTGRES_DB" -t -c "SELECT ROUND(100.0 * blks_hit / (blks_hit + blks_read), 2) FROM pg_stat_database WHERE datname = :'dbname';" 2>/dev/null)
CACHE_HIT_RATIO_EXIT=$?
if [ $CACHE_HIT_RATIO_EXIT -ne 0 ] || [ -z "$CACHE_HIT_RATIO" ]; then
    echo "ERROR: Failed to get cache hit ratio" >&2
    CACHE_HIT_RATIO=0
fi

# Trim whitespace
CONNECTIONS=$(echo "$CONNECTIONS" | xargs)
MAX_CONNECTIONS=$(echo "$MAX_CONNECTIONS" | xargs)
DB_SIZE=$(echo "$DB_SIZE" | xargs)
CACHE_HIT_RATIO=$(echo "$CACHE_HIT_RATIO" | xargs)

# Check if bc is available for calculations
if ! command -v bc >/dev/null 2>&1; then
    echo "WARNING: bc not available for calculations" >&2
    USAGE_PERCENT=0
    CONNECTION_PERCENT=0
else
    # Validate MAX_CONNECTIONS is numeric and non-zero
    if [[ "$MAX_CONNECTIONS" =~ ^[0-9]+$ ]] && [ "$MAX_CONNECTIONS" -ne 0 ]; then
        USAGE_PERCENT=$(echo "scale=2; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
        CONNECTION_PERCENT=$(echo "scale=0; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
    else
        echo "WARNING: Invalid MAX_CONNECTIONS value: $MAX_CONNECTIONS" >&2
        USAGE_PERCENT=0
        CONNECTION_PERCENT=0
    fi
fi

# Determine status based on thresholds (before output)
# Exit codes: 0 = healthy, 1 = warning, 2 = container not running
STATUS="healthy"
EXIT_CODE=0

if [ "$CONNECTION_PERCENT" -gt 90 ]; then
    STATUS="warning"
    EXIT_CODE=1
fi

if [ "$FORMAT" == "--json" ]; then
    # Check if jq is available for JSON escaping
    if ! command -v jq >/dev/null 2>&1; then
        echo "ERROR: jq is required for JSON output but is not installed" >&2
        echo "Install jq with: apt-get install jq (Debian/Ubuntu) or brew install jq (macOS)" >&2
        exit 3
    fi

    # JSON output with dynamic status
    # Escape string fields for JSON safety
    STATUS_JSON=$(printf '%s' "$STATUS" | jq -R -s -c '.')
    DB_SIZE_JSON=$(printf '%s' "$DB_SIZE" | jq -R -s -c '.')

    cat <<EOF
{
  "status": $STATUS_JSON,
  "connections": {
    "current": $CONNECTIONS,
    "max": $MAX_CONNECTIONS,
    "usage_percent": $USAGE_PERCENT
  },
  "database_size": $DB_SIZE_JSON,
  "cache_hit_ratio": $CACHE_HIT_RATIO
}
EOF
else
    # Human-readable output with dynamic status
    echo "PostgreSQL Health Check - $(date)"
    echo "=================================="
    echo "Status: ${STATUS^}"
    echo "Connections: $CONNECTIONS / $MAX_CONNECTIONS"
    echo "Database Size: $DB_SIZE"
    echo "Cache Hit Ratio: ${CACHE_HIT_RATIO}%"
    echo "=================================="
fi

# Output warning message if status is warning
if [ "$EXIT_CODE" -eq 1 ]; then
    echo "WARNING: Connection pool usage above 90%" >&2
fi

exit $EXIT_CODE
