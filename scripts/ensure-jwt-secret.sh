#!/bin/bash
# Security Secrets Generation Script
# Ensures .env file contains all required security secrets
# Usage: ./scripts/ensure-jwt-secret.sh

set -eo pipefail

ENV_FILE=".env"

# Array of all required secrets
REQUIRED_SECRETS=(
  "JWT_SECRET:JWT Secret for authentication"
  "SESSION_SECRET:Session Secret for session management"
  "CSRF_SECRET:CSRF Secret for cross-site request forgery protection"
  "INTERNAL_GATEWAY_TOKEN:Internal Gateway Token for service-to-service communication"
  "ENCRYPTION_KEY:Encryption Key for sensitive data encryption"
  "PLUGIN_SIGNATURE_SECRET:Plugin Signature Secret for plugin integrity verification"
  "FINGERPRINT_SECRET:Fingerprint Secret for device fingerprinting"
)

echo "🔐 Checking security secrets in $ENV_FILE..."
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE file..."
  touch "$ENV_FILE"
  # Restrict permissions to owner read/write only
  chmod 600 "$ENV_FILE" || true
fi

GENERATED_COUNT=0
EXISTING_COUNT=0

# Check and generate each required secret
for SECRET_ENTRY in "${REQUIRED_SECRETS[@]}"; do
  SECRET_NAME="${SECRET_ENTRY%%:*}"
  SECRET_DESC="${SECRET_ENTRY##*:}"

  # Check if secret is already set
  if grep -q "^${SECRET_NAME}=" "$ENV_FILE"; then
    echo "✓ $SECRET_NAME already exists"
    ((EXISTING_COUNT++))
  else
    echo "⚙ Generating $SECRET_NAME..."

    # Generate a secure random secret (64 bytes base64 encoded = ~86 characters)
    SECRET_VALUE=$(openssl rand -base64 64 | tr -d '\n')

    # Validate that secret is non-empty
    if [ -z "$SECRET_VALUE" ]; then
      echo "❌ Error: Failed to generate $SECRET_NAME (empty result)"
      exit 1
    fi

    # Append to .env file
    echo "" >> "$ENV_FILE"
    echo "# $SECRET_DESC (auto-generated on $(date +%Y-%m-%d))" >> "$ENV_FILE"
    echo "${SECRET_NAME}=${SECRET_VALUE}" >> "$ENV_FILE"

    echo "✓ $SECRET_NAME generated successfully"
    ((GENERATED_COUNT++))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $GENERATED_COUNT -gt 0 ]; then
  echo "✅ Generated $GENERATED_COUNT new secret(s)"
  echo "✓  Found $EXISTING_COUNT existing secret(s)"
  echo ""
  echo "⚠️  IMPORTANT SECURITY NOTICES:"
  echo "   • These secrets must be persisted and remain identical across restarts"
  echo "   • Do NOT regenerate secrets unless you want to invalidate existing sessions/tokens"
  echo "   • Keep these secrets secure and do NOT commit them to version control"
  echo "   • Ensure .env file has restricted permissions (chmod 600)"
  echo ""
  echo "To manually generate a new secret in the future:"
  echo "  openssl rand -base64 64"
  echo ""
else
  echo "✅ All $EXISTING_COUNT required secrets already exist"
  echo ""
fi
