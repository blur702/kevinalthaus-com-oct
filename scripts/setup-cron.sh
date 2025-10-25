#!/bin/bash
# Setup Cron Jobs for Automated Maintenance
# Usage: ./scripts/setup-cron.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kevinalthaus}"
LOG_DIR="$APP_DIR/logs/cron"
CONTAINER_NAME="${CONTAINER_NAME:-kevinalthaus-postgres-1}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

# Create log directory
mkdir -p "$LOG_DIR"

echo "Setting up cron jobs..."

# Validate required scripts exist and are executable
if [ ! -f "$APP_DIR/scripts/backup-postgres.sh" ] || [ ! -x "$APP_DIR/scripts/backup-postgres.sh" ]; then
    echo "ERROR: $APP_DIR/scripts/backup-postgres.sh not found or not executable"
    exit 1
fi

if [ ! -f "$APP_DIR/scripts/monitor-postgres.sh" ] || [ ! -x "$APP_DIR/scripts/monitor-postgres.sh" ]; then
    echo "ERROR: $APP_DIR/scripts/monitor-postgres.sh not found or not executable"
    exit 1
fi

if [ ! -f "$APP_DIR/scripts/cleanup-logs.sh" ] || [ ! -x "$APP_DIR/scripts/cleanup-logs.sh" ]; then
    echo "ERROR: $APP_DIR/scripts/cleanup-logs.sh not found or not executable"
    exit 1
fi

# Get absolute paths for cron
FULL_APP_DIR=$(readlink -f "$APP_DIR")
FULL_LOG_DIR=$(readlink -f "$LOG_DIR")

# Create crontab entries
CRON_FILE="/tmp/kevinalthaus-cron"

cat > "$CRON_FILE" <<EOF
# Kevin Althaus Platform - Automated Maintenance Tasks

# Daily PostgreSQL backup at 2 AM
0 2 * * * cd $FULL_APP_DIR && $FULL_APP_DIR/scripts/backup-postgres.sh >> $FULL_LOG_DIR/backup.log 2>&1

# PostgreSQL monitoring every 5 minutes  
*/5 * * * * cd $FULL_APP_DIR && $FULL_APP_DIR/scripts/monitor-postgres.sh >> $FULL_LOG_DIR/monitor.log 2>&1

# Weekly database optimization (VACUUM ANALYZE) on Sundays at 3 AM
0 3 * * 0 docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "VACUUM ANALYZE;" >> "$FULL_LOG_DIR"/vacuum.log 2>&1

# Clean up old logs weekly (keep last 30 days)
0 4 * * 0 mkdir -p "$FULL_LOG_DIR/cron_cleanup" && $FULL_APP_DIR/scripts/cleanup-logs.sh "$FULL_LOG_DIR" 2>> "$FULL_LOG_DIR/cron_cleanup/cleanup.error.log"
EOF

# Install crontab - check for existing marker to prevent duplicates
# Read existing crontab (suppress error if none exists)
EXISTING_CRONTAB=$(crontab -l 2>/dev/null || echo "")
MARKER="# Kevin Althaus Platform - Automated Maintenance Tasks"

# Check if marker already exists in crontab
if echo "$EXISTING_CRONTAB" | grep -qF "$MARKER"; then
  echo "ERROR: Kevin Althaus Platform cron jobs already exist in crontab"
  echo "To re-install, first remove existing entries with: crontab -e"
  echo "Or remove lines containing '$MARKER'"
  rm "$CRON_FILE"
  exit 1
fi

# Combine existing and new entries
if [ -n "$EXISTING_CRONTAB" ]; then
  # Has existing entries - append new ones
  {
    echo "$EXISTING_CRONTAB"
    echo ""
    echo "$MARKER (added $(date))"
    cat "$CRON_FILE"
  } | crontab -
else
  # No existing entries - install new ones
  {
    echo "$MARKER (added $(date))"
    cat "$CRON_FILE"
  } | crontab -
fi

rm "$CRON_FILE"

echo "Cron jobs installed successfully!"
echo ""
echo "Installed tasks:"
echo "  - Daily backup at 2:00 AM"
echo "  - Monitoring every 5 minutes"
echo "  - Weekly vacuum on Sundays at 3:00 AM"
echo "  - Weekly log cleanup on Sundays at 4:00 AM"
echo ""
echo "View cron jobs: crontab -l"
echo "View logs: ls -la $LOG_DIR"
