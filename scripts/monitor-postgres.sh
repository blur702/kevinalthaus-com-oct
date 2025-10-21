#!/bin/bash
# PostgreSQL Monitoring Script
# Usage: ./scripts/monitor-postgres.sh [--json]

CONTAINER_NAME="kevinalthaus-postgres-1"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"
FORMAT="${1}"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "ERROR: PostgreSQL container is not running"
    exit 2
fi

# Get metrics with error handling
CONNECTIONS=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null)
CONNECTIONS_EXIT=$?
if [ $CONNECTIONS_EXIT -ne 0 ] || [ -z "$CONNECTIONS" ]; then
    echo "ERROR: Failed to get connection count"
    CONNECTIONS=0
fi

MAX_CONNECTIONS=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SHOW max_connections;" 2>/dev/null)
MAX_CONNECTIONS_EXIT=$?
if [ $MAX_CONNECTIONS_EXIT -ne 0 ] || [ -z "$MAX_CONNECTIONS" ]; then
    echo "ERROR: Failed to get max connections"
    MAX_CONNECTIONS=100
fi

DB_SIZE=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v dbname="$POSTGRES_DB" -t -c "SELECT pg_size_pretty(pg_database_size(:'dbname'));" 2>/dev/null)
DB_SIZE_EXIT=$?
if [ $DB_SIZE_EXIT -ne 0 ] || [ -z "$DB_SIZE" ]; then
    echo "ERROR: Failed to get database size"
    DB_SIZE="unknown"
fi

CACHE_HIT_RATIO=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v dbname="$POSTGRES_DB" -t -c "SELECT ROUND(100.0 * blks_hit / (blks_hit + blks_read), 2) FROM pg_stat_database WHERE datname = :'dbname';" 2>/dev/null)
CACHE_HIT_RATIO_EXIT=$?
if [ $CACHE_HIT_RATIO_EXIT -ne 0 ] || [ -z "$CACHE_HIT_RATIO" ]; then
    echo "ERROR: Failed to get cache hit ratio"
    CACHE_HIT_RATIO=0
fi

# Trim whitespace
CONNECTIONS=$(echo "$CONNECTIONS" | xargs)
MAX_CONNECTIONS=$(echo "$MAX_CONNECTIONS" | xargs)
DB_SIZE=$(echo "$DB_SIZE" | xargs)
CACHE_HIT_RATIO=$(echo "$CACHE_HIT_RATIO" | xargs)

# Check if bc is available for calculations
if ! command -v bc >/dev/null 2>&1; then
    echo "WARNING: bc not available for calculations"
    USAGE_PERCENT=0
    CONNECTION_PERCENT=0
else
    # Validate MAX_CONNECTIONS is numeric and non-zero
    if [[ "$MAX_CONNECTIONS" =~ ^[0-9]+$ ]] && [ "$MAX_CONNECTIONS" -ne 0 ]; then
        USAGE_PERCENT=$(echo "scale=2; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
        CONNECTION_PERCENT=$(echo "scale=0; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
    else
        echo "WARNING: Invalid MAX_CONNECTIONS value: $MAX_CONNECTIONS"
        USAGE_PERCENT=0
        CONNECTION_PERCENT=0
    fi
fi

if [ "$FORMAT" == "--json" ]; then
    # JSON output
    cat <<EOF
{
  "status": "healthy",
  "connections": {
    "current": $CONNECTIONS,
    "max": $MAX_CONNECTIONS,
    "usage_percent": $USAGE_PERCENT
  },
  "database_size": "$DB_SIZE",
  "cache_hit_ratio": $CACHE_HIT_RATIO
}
EOF
else
    # Human-readable output
    echo "PostgreSQL Health Check - $(date)"
    echo "=================================="
    echo "Status: Healthy"
    echo "Connections: $CONNECTIONS / $MAX_CONNECTIONS"
    echo "Database Size: $DB_SIZE"
    echo "Cache Hit Ratio: ${CACHE_HIT_RATIO}%"
    echo "=================================="
fi

# Exit codes: 0 = healthy, 1 = warning, 2 = critical
if [ "$CONNECTION_PERCENT" -gt 90 ]; then
    echo "WARNING: Connection pool usage above 90%"
    exit 1
fi

exit 0
