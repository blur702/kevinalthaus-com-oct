#!/bin/bash
# Generate self-signed SSL certificates for PostgreSQL
# Usage: ./scripts/generate-ssl-certs.sh

set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-./secrets}"
CERT_FILE="$SECRETS_DIR/server.crt"
KEY_FILE="$SECRETS_DIR/server.key"

echo "Generating SSL certificates for PostgreSQL..."

# Create secrets directory if it doesn't exist
mkdir -p "$SECRETS_DIR"

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "SSL certificates already exist in $SECRETS_DIR"
    echo "To regenerate, remove existing files and run this script again"
    exit 0
fi

# Generate self-signed certificate valid for 365 days
openssl req -new -x509 -days 365 -nodes \
    -text \
    -out "$CERT_FILE" \
    -keyout "$KEY_FILE" \
    -subj "/CN=postgres/O=Development/C=US"

# Set secure permissions on private key
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "✓ SSL certificates generated successfully:"
echo "  Certificate: $CERT_FILE"
echo "  Private Key: $KEY_FILE"
echo ""
echo "⚠️  WARNING: These are self-signed certificates for development/testing."
echo "   For production, replace with CA-signed certificates."
echo ""
echo "Next steps:"
echo "  1. Verify permissions: ls -la $SECRETS_DIR"
echo "  2. For production, obtain CA-signed certificates"
echo "  3. Start services: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
