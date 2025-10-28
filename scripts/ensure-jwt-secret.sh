#!/bin/bash
# JWT Secret Migration Script
# Ensures .env file contains a JWT_SECRET variable
# Usage: ./scripts/ensure-jwt-secret.sh

set -eo pipefail

ENV_FILE=".env"

echo "Checking JWT_SECRET in $ENV_FILE..."

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE file..."
  touch "$ENV_FILE"
fi

# Check if JWT_SECRET is already set
if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
  echo "✓ JWT_SECRET already exists in $ENV_FILE"
  exit 0
fi

# Generate a secure random JWT secret
echo ""
echo "JWT_SECRET not found in $ENV_FILE"
echo "Generating a new secure JWT secret..."
echo ""

# With set -o pipefail, any failure in the pipeline will cause script to exit
# Still validate JWT_SECRET is non-empty after generation
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Validate that JWT_SECRET is non-empty
# (pipefail ensures script exits if openssl or tr fails)
if [ -z "$JWT_SECRET" ]; then
  echo "Error: Failed to generate JWT_SECRET (empty result)"
  exit 1
fi

# Append to .env file
echo "" >> "$ENV_FILE"
echo "# JWT Secret for authentication (auto-generated on $(date +%Y-%m-%d))" >> "$ENV_FILE"
echo "JWT_SECRET=$JWT_SECRET" >> "$ENV_FILE"

echo "✓ JWT_SECRET has been generated and added to $ENV_FILE"
echo ""
echo "⚠️  IMPORTANT: This secret must be persisted and remain identical across restarts"
echo "⚠️  Do NOT regenerate this secret unless you want to invalidate all existing tokens"
echo "⚠️  Keep this secret secure and do NOT commit it to version control"
echo ""
echo "To generate a new secret manually in the future, use:"
echo "  openssl rand -base64 64"
echo ""
