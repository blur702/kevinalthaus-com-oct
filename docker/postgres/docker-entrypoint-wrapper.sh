#!/bin/bash
# Wrapper entrypoint that fixes SSL certificate permissions before starting PostgreSQL
set -e

# Fix SSL certificate permissions if they exist
if [ -f "/etc/ssl/certs/server.crt" ]; then
  chmod 644 /etc/ssl/certs/server.crt
  chown postgres:postgres /etc/ssl/certs/server.crt
  echo "Fixed permissions for server.crt"
fi

if [ -f "/etc/ssl/private/server.key" ]; then
  chmod 600 /etc/ssl/private/server.key
  chown postgres:postgres /etc/ssl/private/server.key
  echo "Fixed permissions for server.key"
fi

# Call the original entrypoint
exec /usr/local/bin/docker-entrypoint.sh "$@"
