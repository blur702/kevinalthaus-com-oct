#!/bin/bash
# ========================================
# WAL Archiving Setup Script
# ========================================
# Initializes WAL archiving infrastructure:
# - Verifies and makes archive script executable
# - Creates log directory
# - Creates WAL backup directory
# - Creates WAL cleanup script (scheduling done separately)
# ========================================

set -e

echo "Setting up WAL archiving..."

# Make WAL archive script executable (with existence check)
if [ -f /usr/local/bin/wal-archive.sh ]; then
    chmod +x /usr/local/bin/wal-archive.sh
    echo "WAL archive script is executable"
else
    echo "ERROR: /usr/local/bin/wal-archive.sh not found" >&2
    exit 1
fi

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
    # Clean up temporary files - collect once to avoid TOCTOU race
    tmp_files=()
    while IFS= read -r -d '' file; do
        tmp_files+=("$file")
    done < <(find "$WAL_DIR" -type f -name "*.tmp*" -print0 2>>"$LOG_FILE")

    if [ ${#tmp_files[@]} -gt 0 ]; then
        printf '%s\n' "${tmp_files[@]}" >> "$LOG_FILE"
        # Delete the exact files we collected
        printf '%s\0' "${tmp_files[@]}" | xargs -0 rm -f 2>>"$LOG_FILE"
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] Deleted ${#tmp_files[@]} temporary files" >> "$LOG_FILE"
    fi

    # Clean up old WAL files - collect once to avoid TOCTOU race
    old_files=()
    while IFS= read -r -d '' file; do
        old_files+=("$file")
    done < <(find "$WAL_DIR" -type f -mtime +${RETENTION_DAYS} -print0 2>>"$LOG_FILE")

    if [ ${#old_files[@]} -gt 0 ]; then
        printf '%s\n' "${old_files[@]}" >> "$LOG_FILE"
        # Delete the exact files we collected
        printf '%s\0' "${old_files[@]}" | xargs -0 rm -f 2>>"$LOG_FILE"
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] Deleted ${#old_files[@]} WAL files older than ${RETENTION_DAYS} days" >> "$LOG_FILE"
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
