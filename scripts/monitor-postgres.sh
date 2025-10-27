#!/bin/bash
# PostgreSQL Monitoring Script
# Usage: ./scripts/monitor-postgres.sh [--json]

CONTAINER_NAME="kevinalthaus-postgres-1"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"
FORMAT="${1}"

# Check if container is running using exact name match
RUNNING_CONTAINERS=$(docker ps --filter "name=^${CONTAINER_NAME}$" --format "{{.Names}}" 2>/dev/null)
if [ -z "$RUNNING_CONTAINERS" ]; then
    echo "ERROR: PostgreSQL container '$CONTAINER_NAME' is not running" >&2
    exit 2
fi

# Get metrics with error handling
CONNECTIONS=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null)
CONNECTIONS_EXIT=$?
if [ $CONNECTIONS_EXIT -ne 0 ] || [ -z "$CONNECTIONS" ]; then
    echo "ERROR: Failed to get connection count" >&2
    CONNECTIONS=0
fi

MAX_CONNECTIONS=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SHOW max_connections;" 2>/dev/null)
MAX_CONNECTIONS_EXIT=$?
if [ $MAX_CONNECTIONS_EXIT -ne 0 ] || [ -z "$MAX_CONNECTIONS" ]; then
    echo "ERROR: Failed to get max connections" >&2
    MAX_CONNECTIONS=100
fi

DB_SIZE=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v dbname="$POSTGRES_DB" -t -c "SELECT pg_size_pretty(pg_database_size(:'dbname'));" 2>/dev/null)
DB_SIZE_EXIT=$?
if [ $DB_SIZE_EXIT -ne 0 ] || [ -z "$DB_SIZE" ]; then
    echo "ERROR: Failed to get database size" >&2
    DB_SIZE="unknown"
fi

CACHE_HIT_RATIO=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v dbname="$POSTGRES_DB" -t -c "SELECT ROUND(100.0 * blks_hit / (blks_hit + blks_read), 2) FROM pg_stat_database WHERE datname = :'dbname';" 2>/dev/null)
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
