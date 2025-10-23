#!/bin/bash
# Setup Cron Jobs for Automated Maintenance
# Usage: sudo ./scripts/setup-cron.sh

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
0 3 * * 0 /usr/bin/docker exec "$CONTAINER_NAME" /usr/bin/psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "VACUUM ANALYZE;" >> "$FULL_LOG_DIR"/vacuum.log 2>&1

# Clean up old logs weekly (keep last 30 days)
# Guard against unsafe or empty FULL_LOG_DIR before running destructive find
0 4 * * 0 [ -n "$FULL_LOG_DIR" ] && [ "$FULL_LOG_DIR" != "/" ] && [ "$FULL_LOG_DIR" != "." ] && /usr/bin/find "$FULL_LOG_DIR" -name "*.log" -type f -mtime +30 -delete || { mkdir -p /var/log/cron_cleanup; echo "[ERROR] Unsafe FULL_LOG_DIR=\"$FULL_LOG_DIR\" - skipping log cleanup" >> /var/log/cron_cleanup/cleanup.error.log 2>&1; }
EOF

# Install crontab
crontab "$CRON_FILE"
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

