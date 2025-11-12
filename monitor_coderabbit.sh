#!/bin/bash

# CodeRabbit Progress Monitor
# Checks CodeRabbit status every 10 seconds and logs progress

LOG_FILE=".coderabbit-monitor.log"
STATUS_DIR=".coderabbit-status"
CHECK_INTERVAL=10

echo "=== CodeRabbit Monitor Started at $(date) ===" | tee -a "$LOG_FILE"
echo "Monitoring CodeRabbit progress every ${CHECK_INTERVAL} seconds..." | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

ITERATION=0
while true; do
  ITERATION=$((ITERATION + 1))
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

  echo "[${TIMESTAMP}] Check #${ITERATION}" | tee -a "$LOG_FILE"

  # Check if CodeRabbit process is still running
  if pgrep -f "coderabbit-wrapper" > /dev/null; then
    echo "  ✓ CodeRabbit process is running" | tee -a "$LOG_FILE"

    # Check for status files
    if [ -d "$STATUS_DIR" ]; then
      echo "  ✓ Status directory exists" | tee -a "$LOG_FILE"

      # Look for status files
      STATUS_FILES=$(ls -1 "$STATUS_DIR" 2>/dev/null | wc -l)
      if [ "$STATUS_FILES" -gt 0 ]; then
        echo "  ✓ Found ${STATUS_FILES} status file(s)" | tee -a "$LOG_FILE"

        # Show latest status
        LATEST_STATUS=$(ls -t "$STATUS_DIR"/* 2>/dev/null | head -1)
        if [ -f "$LATEST_STATUS" ]; then
          echo "  Latest status: $(basename "$LATEST_STATUS")" | tee -a "$LOG_FILE"
          tail -3 "$LATEST_STATUS" | sed 's/^/    /' | tee -a "$LOG_FILE"
        fi
      else
        echo "  ⚠ No status files yet" | tee -a "$LOG_FILE"
      fi
    else
      echo "  ⚠ Status directory not found" | tee -a "$LOG_FILE"
    fi
  else
    echo "  ✗ CodeRabbit process completed or stopped" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "=== CodeRabbit Monitor Ended at $(date) ===" | tee -a "$LOG_FILE"
    break
  fi

  echo "" | tee -a "$LOG_FILE"

  # Wait for next check
  sleep "$CHECK_INTERVAL"
done

echo "Monitoring complete. Check $LOG_FILE for full details."
