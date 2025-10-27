#!/bin/bash
# Setup Cron Jobs for Automated Maintenance
# Usage: ./scripts/setup-cron.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kevinalthaus}"
LOG_DIR="$APP_DIR/logs/cron"
CONTAINER_NAME="${CONTAINER_NAME:-kevinalthaus-postgres-1}"
POSTGRES_DB="${POSTGRES_DB:-kevinalthaus}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

# Validate CONTAINER_NAME to prevent command injection
# Only allow alphanumeric, dots, underscores, and hyphens (max 255 chars)
if [[ ! "$CONTAINER_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || [ -z "$CONTAINER_NAME" ] || [ ${#CONTAINER_NAME} -gt 255 ]; then
    echo "ERROR: CONTAINER_NAME contains invalid characters, is empty, or exceeds 255 characters. Only alphanumeric, dots, underscores, and hyphens are allowed."
    echo "Container name: $CONTAINER_NAME"
    exit 1
fi

# Validate POSTGRES variables to prevent injection
# Only allow alphanumeric, underscores, and hyphens
if [[ ! "$POSTGRES_USER" =~ ^[a-zA-Z0-9_-]+$ ]] || [ -z "$POSTGRES_USER" ]; then
    echo "ERROR: POSTGRES_USER contains invalid characters or is empty. Only alphanumeric, underscores, and hyphens are allowed."
    exit 1
fi

if [[ ! "$POSTGRES_DB" =~ ^[a-zA-Z0-9_-]+$ ]] || [ -z "$POSTGRES_DB" ]; then
    echo "ERROR: POSTGRES_DB contains invalid characters or is empty. Only alphanumeric, underscores, and hyphens are allowed."
    exit 1
fi

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
# Use readlink -m (canonicalize) which works even if path doesn't exist
# Fall back to readlink -f if -m is not available
if [ -d "$APP_DIR" ]; then
    FULL_APP_DIR=$(readlink -f "$APP_DIR")
else
    FULL_APP_DIR=$(readlink -m "$APP_DIR" 2>/dev/null || echo "$APP_DIR")
fi

if [ -d "$LOG_DIR" ]; then
    FULL_LOG_DIR=$(readlink -f "$LOG_DIR")
else
    # Create log directory if it doesn't exist
    mkdir -p "$LOG_DIR"
    FULL_LOG_DIR=$(readlink -f "$LOG_DIR")
fi

# Shell-escape validated variables for safe embedding in crontab
# Variables are already validated above, now we escape them for literal inclusion
# Use printf %q for proper shell escaping (safe for both single and double quotes)
ESCAPED_CONTAINER_NAME=$(printf %q "$CONTAINER_NAME")
ESCAPED_POSTGRES_USER=$(printf %q "$POSTGRES_USER")
ESCAPED_POSTGRES_DB=$(printf %q "$POSTGRES_DB")
ESCAPED_FULL_APP_DIR=$(printf %q "$FULL_APP_DIR")
ESCAPED_FULL_LOG_DIR=$(printf %q "$FULL_LOG_DIR")

# Create crontab entries with pre-expanded, escaped literals
# This prevents cron from expanding variables at runtime (eliminating command injection risk)
CRON_FILE="/tmp/kevinalthaus-cron"

cat > "$CRON_FILE" <<EOF
# Kevin Althaus Platform - Automated Maintenance Tasks

# Daily PostgreSQL backup at 2 AM
0 2 * * * cd $ESCAPED_FULL_APP_DIR && $ESCAPED_FULL_APP_DIR/scripts/backup-postgres.sh >> $ESCAPED_FULL_LOG_DIR/backup.log 2>&1

# PostgreSQL monitoring every 5 minutes
*/5 * * * * cd $ESCAPED_FULL_APP_DIR && $ESCAPED_FULL_APP_DIR/scripts/monitor-postgres.sh >> $ESCAPED_FULL_LOG_DIR/monitor.log 2>&1

# Weekly database optimization (VACUUM ANALYZE) on Sundays at 3 AM
0 3 * * 0 docker exec $ESCAPED_CONTAINER_NAME psql -U $ESCAPED_POSTGRES_USER -d $ESCAPED_POSTGRES_DB -c 'VACUUM ANALYZE;' >> $ESCAPED_FULL_LOG_DIR/vacuum.log 2>&1

# Clean up old logs weekly (keep last 30 days)
0 4 * * 0 mkdir -p $ESCAPED_FULL_LOG_DIR/cron_cleanup && $ESCAPED_FULL_APP_DIR/scripts/cleanup-logs.sh $ESCAPED_FULL_LOG_DIR 2>> $ESCAPED_FULL_LOG_DIR/cron_cleanup/cleanup.error.log
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
