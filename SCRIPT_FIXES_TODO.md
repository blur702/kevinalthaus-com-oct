# Remaining Script Fixes

This document lists script improvements that should be implemented for production readiness.

## scripts/monitor-postgres.sh

### 1. Error Messages to stderr (lines 12, 20, 27, 34, 41, 53, 62)

Change all error/warning echo statements to write to stderr:

```bash
# Before
echo "ERROR: ..."

# After
echo "ERROR: ..." >&2
```

### 2. Dynamic Status Computation (lines 72, 86)

Compute status variable from threshold checks instead of hardcoding "healthy":

```bash
status="healthy"
if [ $CONNECTION_PERCENT -gt 90 ]; then
  status="critical"
elif [ $CONNECTION_PERCENT -gt 75 ]; then
  status="warning"
fi

# Use $status in JSON output (line 72)
# Use $status in human-readable output (line 86)
```

### 3. Use docker inspect (line 11)

Replace `docker ps | grep` with precise container lookup:

```bash
# Before
if ! docker ps | grep -q "$CONTAINER_NAME"; then

# After
CONTAINER_ID=$(docker inspect -f '{{.Id}}' "$CONTAINER_NAME" 2>/dev/null)
if [ -z "$CONTAINER_ID" ]; then
  echo "ERROR: Container $CONTAINER_NAME not found or not running" >&2
  exit 1
fi

# Use $CONTAINER_ID for all subsequent docker exec commands
```

### 4. Deduplicate Percentage Calculation (lines 59-60)

Compute percentage once and reuse:

```bash
RAW_PERCENT=$(echo "scale=2; $ACTIVE * 100 / $MAX_CONNECTIONS" | bc)
USAGE_PERCENT=$RAW_PERCENT
CONNECTION_PERCENT=$(echo "$RAW_PERCENT / 1" | bc)  # Truncate to integer
```

### 5. Validate bc Availability (lines 94-96)

Check for bc before computing and validate results:

```bash
if ! command -v bc >/dev/null 2>&1; then
  echo "ERROR: bc command not found" >&2
  exit 1
fi

CONNECTION_PERCENT=$(echo "$RAW_PERCENT / 1" | bc)
if ! [[ "$CONNECTION_PERCENT" =~ ^[0-9]+$ ]] || [ "$CONNECTION_PERCENT" -lt 0 ] || [ "$CONNECTION_PERCENT" -gt 100 ]; then
  echo "ERROR: Invalid connection percentage calculated: $CONNECTION_PERCENT" >&2
  exit 1
fi
```

## scripts/restore-postgres.sh

### Validate Database Name Before DROP/CREATE (lines 44-50)

psql `:variable` substitution does not work for identifiers (database names). Instead, validate the database name before passing it to psql:

```bash
# Validate database name: allow only safe alphanumeric and underscore characters
if ! [[ "$POSTGRES_DB" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "ERROR: Invalid database name '$POSTGRES_DB'. Only alphanumeric characters and underscores are allowed." >&2
  exit 1
fi

# Use validated identifier directly (safe after validation)
docker exec -t "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
docker exec -t "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -c "CREATE DATABASE \"$POSTGRES_DB\";"
```

**Important**: Never use sed-based escaping alone. Always validate database names against a safe pattern (e.g., `/^[A-Za-z0-9_]+$/`) or an explicit allowlist before using them in SQL commands. For maximum safety, reject any value that doesn't match the pattern.

## scripts/setup-cron.sh

### Safe Log Directory (lines 47-50)

Use fixed, safe location for error logging instead of $FULL_LOG_DIR:

```bash
# Define safe error log location at top of script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ERROR_LOG="/var/log/kevinalthaus/cleanup.error.log"

# Ensure parent directory exists
mkdir -p "$(dirname "$ERROR_LOG")"

# Update cron entry
0 2 * * 0 [ -d "$FULL_LOG_DIR" ] && find "$FULL_LOG_DIR" -name "*.log" -mtime +30 -delete || echo "Log directory not found" >> "$ERROR_LOG" 2>&1
```

## Priority

1. **High Priority**: monitor-postgres.sh status computation and stderr fixes (affects monitoring reliability)
2. **Medium Priority**: restore-postgres.sh psql variables (security improvement)
3. **Low Priority**: setup-cron.sh safe logging (edge case protection)

All fixes should be tested in a development environment before deploying to production.
