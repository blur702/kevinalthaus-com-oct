#!/bin/bash
# Configure PostgreSQL SSL based on POSTGRES_USE_SSL and ensure dev certs exist if needed
# This runs during container initialization. It adjusts postgresql.conf and generates
# self-signed certificates for development if absent.

set -euo pipefail

# Production validation: Require SSL in production environments
NODE_ENV="${NODE_ENV:-development}"
if [ "$NODE_ENV" = "production" ]; then
  POSTGRES_USE_SSL_LOWER="${POSTGRES_USE_SSL:-}"
  POSTGRES_USE_SSL_LOWER="${POSTGRES_USE_SSL_LOWER,,}"
  if [ "$POSTGRES_USE_SSL_LOWER" != "true" ] && [ "$POSTGRES_USE_SSL_LOWER" != "1" ]; then
    echo "[init] ERROR: NODE_ENV=production requires POSTGRES_USE_SSL=true for secure connections" >&2
    echo "[init] Deployment aborted: SSL must be enabled in production" >&2
    exit 1
  fi
fi

POSTGRES_USE_SSL_LOWER="${POSTGRES_USE_SSL:-false}"
POSTGRES_USE_SSL_LOWER="${POSTGRES_USE_SSL_LOWER,,}"

PGDATA_DIR="${PGDATA:-/var/lib/postgresql/data}"
CONF_FILE="$PGDATA_DIR/postgresql.conf"

CERT_DIR="/etc/ssl/certs"
KEY_DIR="/etc/ssl/private"
CRT_PATH="$CERT_DIR/server.crt"
KEY_PATH="$KEY_DIR/server.key"

enable_ssl=false
if [ "$POSTGRES_USE_SSL_LOWER" = "true" ] || [ "$POSTGRES_USE_SSL_LOWER" = "1" ]; then
  enable_ssl=true
fi

echo "[init] POSTGRES_USE_SSL=$POSTGRES_USE_SSL_LOWER (enable_ssl=$enable_ssl)"

if [ "$enable_ssl" = true ]; then
  # Ensure cert directories exist
  mkdir -p "$CERT_DIR" "$KEY_DIR"

  # Harden key directory permissions - only postgres user can access
  chown postgres:postgres "$KEY_DIR"
  chmod 700 "$KEY_DIR"

  # Fix permissions on existing mounted certificate files
  if [ -f "$CRT_PATH" ]; then
    chown postgres:postgres "$CRT_PATH"
    chmod 644 "$CRT_PATH"
  fi
  if [ -f "$KEY_PATH" ]; then
    chown postgres:postgres "$KEY_PATH"
    chmod 600 "$KEY_PATH"
  fi

  if [ ! -f "$CRT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    # In production, require CA-signed certificates
    if [ "$NODE_ENV" = "production" ]; then
      echo "[init] ERROR: Production environment requires CA-signed SSL certificates" >&2
      echo "[init] Missing certificates at:" >&2
      [ ! -f "$CRT_PATH" ] && echo "[init]   - $CRT_PATH" >&2
      [ ! -f "$KEY_PATH" ] && echo "[init]   - $KEY_PATH" >&2
      echo "[init] Please provide valid CA-signed certificates before starting" >&2
      exit 1
    fi

    # Non-production: generate self-signed certificate
    echo "[init] Generating self-signed SSL certificate for PostgreSQL (development)" >&2
    openssl req -new -x509 -days 365 -nodes -text \
      -out "$CRT_PATH" -keyout "$KEY_PATH" \
      -subj "/CN=postgres.local"
    chmod 600 "$KEY_PATH"
    chown postgres:postgres "$CRT_PATH" "$KEY_PATH"
  fi

  # Toggle SSL on and set cert paths in postgresql.conf (idempotent)
  if [ -f "$CONF_FILE" ]; then
    # For each setting, check if it exists (commented or not) and update, or append if missing

    # Handle ssl setting
    if grep -qE '^[[:space:]]*#?[[:space:]]*ssl[[:space:]]*=' "$CONF_FILE"; then
      # Update existing line (commented or not)
      if ! sed -ri "s/^[[:space:]]*#?[[:space:]]*ssl[[:space:]]*=.*/ssl = on/" "$CONF_FILE"; then
        echo "[init] ERROR: Failed to update ssl setting in $CONF_FILE" >&2
        exit 1
      fi
    else
      # Append if missing
      echo "ssl = on" >> "$CONF_FILE"
    fi

    # Handle ssl_cert_file setting
    if grep -qE '^[[:space:]]*#?[[:space:]]*ssl_cert_file[[:space:]]*=' "$CONF_FILE"; then
      # Update existing line
      if ! sed -ri "s|^[[:space:]]*#?[[:space:]]*ssl_cert_file[[:space:]]*=.*|ssl_cert_file = '${CRT_PATH}'|" "$CONF_FILE"; then
        echo "[init] ERROR: Failed to update ssl_cert_file setting in $CONF_FILE" >&2
        exit 1
      fi
    else
      # Append if missing
      echo "ssl_cert_file = '$CRT_PATH'" >> "$CONF_FILE"
    fi

    # Handle ssl_key_file setting
    if grep -qE '^[[:space:]]*#?[[:space:]]*ssl_key_file[[:space:]]*=' "$CONF_FILE"; then
      # Update existing line
      if ! sed -ri "s|^[[:space:]]*#?[[:space:]]*ssl_key_file[[:space:]]*=.*|ssl_key_file = '${KEY_PATH}'|" "$CONF_FILE"; then
        echo "[init] ERROR: Failed to update ssl_key_file setting in $CONF_FILE" >&2
        exit 1
      fi
    else
      # Append if missing
      echo "ssl_key_file = '$KEY_PATH'" >> "$CONF_FILE"
    fi
  fi
else
  # Ensure SSL is disabled for local/dev without certs
  if [ -f "$CONF_FILE" ]; then
    # Update or append ssl = off
    if grep -qE '^[[:space:]]*#?[[:space:]]*ssl[[:space:]]*=' "$CONF_FILE"; then
      if ! sed -ri "s/^#?\s*ssl\s*=.*/ssl = off/" "$CONF_FILE"; then
        echo "[init] ERROR: Failed to disable ssl in $CONF_FILE" >&2
        exit 1
      fi
    else
      echo "ssl = off" >> "$CONF_FILE"
    fi
  fi
fi

echo "[init] SSL configuration updated (ssl=$([ "$enable_ssl" = true ] && echo on || echo off))"

