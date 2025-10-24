#!/bin/bash
# Configure PostgreSQL SSL based on POSTGRES_USE_SSL and ensure dev certs exist if needed
# This runs during container initialization. It adjusts postgresql.conf and generates
# self-signed certificates for development if absent.

set -euo pipefail

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

  if [ ! -f "$CRT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "[init] Generating self-signed SSL certificate for PostgreSQL (development)" >&2
    openssl req -new -x509 -days 365 -nodes -text \
      -out "$CRT_PATH" -keyout "$KEY_PATH" \
      -subj "/CN=postgres.local"
    chmod 600 "$KEY_PATH"
    chown postgres:postgres "$CRT_PATH" "$KEY_PATH"
  fi

  # Toggle SSL on and set cert paths in postgresql.conf (append/replace)
  if [ -f "$CONF_FILE" ]; then
    sed -ri "s/^#?\s*ssl\s*=.*/ssl = on/" "$CONF_FILE" || true
    sed -ri "s|^#?\s*ssl_cert_file\s*=.*|ssl_cert_file = '${CRT_PATH}'|" "$CONF_FILE" || true
    sed -ri "s|^#?\s*ssl_key_file\s*=.*|ssl_key_file = '${KEY_PATH}'|" "$CONF_FILE" || true
    # If keys not present in file, append them
    grep -q '^ssl\s*=' "$CONF_FILE" || echo "ssl = on" >> "$CONF_FILE"
    grep -q '^ssl_cert_file\s*=' "$CONF_FILE" || echo "ssl_cert_file = '$CRT_PATH'" >> "$CONF_FILE"
    grep -q '^ssl_key_file\s*=' "$CONF_FILE" || echo "ssl_key_file = '$KEY_PATH'" >> "$CONF_FILE"
  fi
else
  # Ensure SSL is disabled for local/dev without certs
  if [ -f "$CONF_FILE" ]; then
    sed -ri "s/^#?\s*ssl\s*=.*/ssl = off/" "$CONF_FILE" || true
    # no need to keep cert paths when disabled
  fi
fi

echo "[init] SSL configuration updated (ssl=$([ "$enable_ssl" = true ] && echo on || echo off))"

