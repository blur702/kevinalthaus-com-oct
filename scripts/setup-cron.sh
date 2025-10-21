#!/bin/bash
# Setup Cron Jobs for Automated Maintenance
# Usage: sudo ./scripts/setup-cron.sh

set -e

APP_DIR="${APP_DIR:-/opt/kevinalthaus}"
LOG_DIR="$APP_DIR/logs/cron"

# Create log directory
mkdir -p "$LOG_DIR"

echo "Setting up cron jobs..."

# Create crontab entries
CRON_FILE="/tmp/kevinalthaus-cron"

cat > "$CRON_FILE" <<EOF
# Kevin Althaus Platform - Automated Maintenance Tasks

# Daily PostgreSQL backup at 2 AM
0 2 * * * cd $APP_DIR && ./scripts/backup-postgres.sh >> $LOG_DIR/backup.log 2>&1

# PostgreSQL monitoring every 5 minutes
*/5 * * * * cd $APP_DIR && ./scripts/monitor-postgres.sh >> $LOG_DIR/monitor.log 2>&1

# Weekly database optimization (VACUUM ANALYZE) on Sundays at 3 AM
0 3 * * 0 docker exec kevinalthaus-postgres-1 psql -U postgres -d kevinalthaus -c "VACUUM ANALYZE;" >> $LOG_DIR/vacuum.log 2>&1

# Clean up old logs weekly (keep last 30 days)
0 4 * * 0 find $LOG_DIR -name "*.log" -type f -mtime +30 -delete
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
