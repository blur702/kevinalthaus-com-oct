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

# Protected system directories
PROTECTED_PATHS=(
  "/"
  "/etc"
  "/usr"
  "/bin"
  "/sbin"
  "/var"
  "/home"
  "/root"
  "$(pwd -P)"
)

# Check if RESOLVED matches or is subdirectory of protected paths
for protected in "${PROTECTED_PATHS[@]}"; do
  if [ "$RESOLVED" = "$protected" ] || [[ "$RESOLVED" == "$protected/"* ]]; then
    echo "[ERROR] Refusing to operate on unsafe path: '$LOG_DIR'" >&2
    exit 1
  fi
done

if [ ! -d "$RESOLVED" ]; then
  echo "[ERROR] Log directory does not exist: '$LOG_DIR'" >&2
  exit 1
fi

echo "[INFO] Finding *.log files older than $MAX_AGE_DAYS days in '$RESOLVED'"

# Step 1: Find and list candidates
TEMP_LIST=$(mktemp)
find "$RESOLVED" -name "*.log" -type f -mtime +"$MAX_AGE_DAYS" -print0 > "$TEMP_LIST"

# Count files
FILE_COUNT=$(tr -cd '\0' < "$TEMP_LIST" | wc -c)

if [ "$FILE_COUNT" -eq 0 ]; then
  echo "[INFO] No files to delete"
  rm -f "$TEMP_LIST"
  exit 0
fi

echo "[INFO] Found $FILE_COUNT file(s) to delete:"
xargs -0 -n 1 < "$TEMP_LIST" | head -20
if [ "$FILE_COUNT" -gt 20 ]; then
  echo "[INFO] ... and $((FILE_COUNT - 20)) more"
fi

# Step 2: Confirm deletion
if [ -t 0 ]; then
  # Interactive mode
  read -p "Delete these files? [y/N] " -r response
  case "$response" in
    [yY][eE][sS]|[yY])
      echo "[INFO] Deleting files..."
      xargs -0 rm -f < "$TEMP_LIST"
      echo "[INFO] Cleanup complete"
      ;;
    *)
      echo "[INFO] Cleanup cancelled"
      ;;
  esac
else
  # Non-interactive mode: delete immediately
  echo "[INFO] Non-interactive mode: deleting files..."
  xargs -0 rm -f < "$TEMP_LIST"
  echo "[INFO] Cleanup complete"
fi

rm -f "$TEMP_LIST"

