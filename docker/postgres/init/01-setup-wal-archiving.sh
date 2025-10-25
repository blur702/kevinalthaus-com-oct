#!/bin/bash
# ========================================
# WAL Archiving Setup Script
# ========================================
# Initializes WAL archiving infrastructure:
# - Makes archive script executable
# - Creates log directory
# - Creates WAL backup directory
# - Sets up WAL cleanup cron job
# ========================================

set -e

echo "Setting up WAL archiving..."

# Make WAL archive script executable
chmod +x /usr/local/bin/wal-archive.sh
echo "WAL archive script is executable"

# Create log directory for WAL archive script
mkdir -p /var/log/postgresql
chown postgres:postgres /var/log/postgresql
echo "Created log directory: /var/log/postgresql"

# Create WAL backup directory
mkdir -p /backups/wal
chown postgres:postgres /backups/wal
echo "Created WAL backup directory: /backups/wal"

# Create WAL cleanup script for 7-day retention
cat > /usr/local/bin/wal-cleanup.sh << 'EOF'
#!/bin/bash
# Remove WAL files older than 7 days
RETENTION_DAYS=7
WAL_DIR="/backups/wal"
LOG_FILE="/var/log/postgresql/wal-cleanup.log"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting WAL cleanup (retention: ${RETENTION_DAYS} days)" >> "$LOG_FILE"

if [ -d "$WAL_DIR" ]; then
    # Clean up temporary files
    tmp_files=$(find "$WAL_DIR" -type f -name "*.tmp*" -print 2>>"$LOG_FILE")
    if [ -n "$tmp_files" ]; then
        echo "$tmp_files" >> "$LOG_FILE"
        tmp_count=$(echo "$tmp_files" | wc -l)
        find "$WAL_DIR" -type f -name "*.tmp*" -delete 2>>"$LOG_FILE"
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] Deleted $tmp_count temporary files" >> "$LOG_FILE"
    fi

    # Clean up old WAL files
    old_files=$(find "$WAL_DIR" -type f -mtime +${RETENTION_DAYS} -print 2>>"$LOG_FILE")
    if [ -n "$old_files" ]; then
        echo "$old_files" >> "$LOG_FILE"
        deleted=$(echo "$old_files" | wc -l)
        find "$WAL_DIR" -type f -mtime +${RETENTION_DAYS} -delete 2>>"$LOG_FILE"
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] Deleted $deleted WAL files older than ${RETENTION_DAYS} days" >> "$LOG_FILE"
    else
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] No WAL files older than ${RETENTION_DAYS} days to delete" >> "$LOG_FILE"
    fi
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WAL directory not found: $WAL_DIR" >> "$LOG_FILE"
fi
EOF

chmod +x /usr/local/bin/wal-cleanup.sh
echo "Created WAL cleanup script"

echo "WAL archiving setup complete"
