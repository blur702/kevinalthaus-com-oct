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

if [ "$LOG_DIR" = "/" ] || [ "$LOG_DIR" = "." ]; then
  echo "[ERROR] Refusing to operate on unsafe path: '$LOG_DIR'" >&2
  exit 1
fi

if [ ! -d "$LOG_DIR" ]; then
  echo "[ERROR] Log directory does not exist: '$LOG_DIR'" >&2
  exit 1
fi

echo "[INFO] Cleaning *.log files older than $MAX_AGE_DAYS days in '$LOG_DIR'"
find "$LOG_DIR" -name "*.log" -type f -mtime +"$MAX_AGE_DAYS" -print -delete
echo "[INFO] Cleanup complete"

