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

# Get metrics
CONNECTIONS=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT count(*) FROM pg_stat_activity;")
MAX_CONNECTIONS=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SHOW max_connections;")
DB_SIZE=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT pg_size_pretty(pg_database_size('$POSTGRES_DB'));")
CACHE_HIT_RATIO=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT ROUND(100.0 * blks_hit / (blks_hit + blks_read), 2) FROM pg_stat_database WHERE datname = '$POSTGRES_DB';")

# Trim whitespace
CONNECTIONS=$(echo $CONNECTIONS | xargs)
MAX_CONNECTIONS=$(echo $MAX_CONNECTIONS | xargs)
DB_SIZE=$(echo $DB_SIZE | xargs)
CACHE_HIT_RATIO=$(echo $CACHE_HIT_RATIO | xargs)

if [ "$FORMAT" == "--json" ]; then
    # JSON output
    cat <<EOF
{
  "status": "healthy",
  "connections": {
    "current": $CONNECTIONS,
    "max": $MAX_CONNECTIONS,
    "usage_percent": $(echo "scale=2; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
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
CONNECTION_PERCENT=$(echo "scale=0; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
if [ "$CONNECTION_PERCENT" -gt 90 ]; then
    echo "WARNING: Connection pool usage above 90%"
    exit 1
fi

exit 0
