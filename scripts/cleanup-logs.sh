#!/bin/bash
# Safe log cleanup utility
# Usage: scripts/cleanup-logs.sh <log_dir>

set -euo pipefail

LOG_DIR="${1:-}"
MAX_AGE_DAYS=30

if [ -z "$LOG_DIR" ]; then
  echo "[ERROR] Missing log directory argument" >&2
  exit 1
fi

RESOLVED="$(realpath "$LOG_DIR" 2>/dev/null || readlink -f "$LOG_DIR" 2>/dev/null || echo "")"
if [ -z "$RESOLVED" ]; then
  echo "[ERROR] Unable to resolve log directory path: '$LOG_DIR'" >&2
  exit 1
fi

if [ "$RESOLVED" = "/" ] || [ "$RESOLVED" = "$(pwd -P)" ]; then
  echo "[ERROR] Refusing to operate on unsafe path: '$LOG_DIR'" >&2
  exit 1
fi

if [ ! -d "$RESOLVED" ]; then
  echo "[ERROR] Log directory does not exist: '$LOG_DIR'" >&2
  exit 1
fi

echo "[INFO] Cleaning *.log files older than $MAX_AGE_DAYS days in '$RESOLVED'"
find "$RESOLVED" -name "*.log" -type f -mtime +"$MAX_AGE_DAYS" -print -delete
echo "[INFO] Cleanup complete"

