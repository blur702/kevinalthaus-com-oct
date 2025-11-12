#!/bin/bash

# Secret Validation Script
# Prevents deployment with placeholder/insecure secret values
# Exit code 0 = all secrets valid, Exit code 1 = found placeholder/insecure values

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Validating environment secrets..."
echo ""

ERRORS=0
WARNINGS=0

# Array of required secrets
REQUIRED_SECRETS=(
  "JWT_SECRET"
  "SESSION_SECRET"
  "CSRF_SECRET"
  "INTERNAL_GATEWAY_TOKEN"
  "ENCRYPTION_KEY"
  "PLUGIN_SIGNATURE_SECRET"
  "FINGERPRINT_SECRET"
)

# Array of placeholder patterns that indicate invalid values
PLACEHOLDER_PATTERNS=(
  "REPLACE_WITH"
  "YOUR_.*_HERE"
  "CHANGE_ME"
  "CHANGEME"
  "PLACEHOLDER"
  "TODO"
  "FIXME"
)

# Minimum length for secrets (32 characters recommended)
MIN_SECRET_LENGTH=32

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${RED}✗ .env file not found!${NC}"
  echo "  Please create .env file from .env.example"
  exit 1
fi

# Load .env file
source .env 2>/dev/null || true

# Check each required secret
for SECRET_NAME in "${REQUIRED_SECRETS[@]}"; do
  SECRET_VALUE="${!SECRET_NAME}"
  
  if [ -z "$SECRET_VALUE" ]; then
    echo -e "${RED}✗ $SECRET_NAME is empty or not set${NC}"
    ((ERRORS++))
    continue
  fi
  
  # Check for placeholder patterns
  FOUND_PLACEHOLDER=0
  for PATTERN in "${PLACEHOLDER_PATTERNS[@]}"; do
    if echo "$SECRET_VALUE" | grep -qiE "$PATTERN"; then
      echo -e "${RED}✗ $SECRET_NAME contains placeholder value matching '$PATTERN'${NC}"
      echo "  Current value: ${SECRET_VALUE:0:30}..."
      ((ERRORS++))
      FOUND_PLACEHOLDER=1
      break
    fi
  done
  
  if [ $FOUND_PLACEHOLDER -eq 1 ]; then
    continue
  fi
  
  # Check minimum length
  SECRET_LENGTH=${#SECRET_VALUE}
  if [ $SECRET_LENGTH -lt $MIN_SECRET_LENGTH ]; then
    echo -e "${YELLOW}⚠ $SECRET_NAME is only $SECRET_LENGTH characters (recommended: $MIN_SECRET_LENGTH+)${NC}"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✓ $SECRET_NAME is valid ($SECRET_LENGTH characters)${NC}"
  fi
done

echo ""

# Check Sentry DSNs (optional but should not be placeholders if set)
if [ -n "$SENTRY_DSN" ] && echo "$SENTRY_DSN" | grep -qiE "YOUR_SENTRY_DSN_HERE"; then
  echo -e "${YELLOW}⚠ SENTRY_DSN is set to placeholder value${NC}"
  ((WARNINGS++))
fi

if [ -n "$VITE_SENTRY_DSN" ] && echo "$VITE_SENTRY_DSN" | grep -qiE "YOUR_SENTRY_DSN_HERE"; then
  echo -e "${YELLOW}⚠ VITE_SENTRY_DSN is set to placeholder value${NC}"
  ((WARNINGS++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Validation FAILED: $ERRORS critical issue(s) found${NC}"
  echo ""
  echo "To generate secure random secrets, run:"
  echo "  ./scripts/ensure-jwt-secret.sh"
  echo ""
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Validation passed with $WARNINGS warning(s)${NC}"
  echo ""
  echo "Consider:"
  echo "  - Increasing secret lengths to 32+ characters"
  echo "  - Configuring Sentry DSN for error tracking"
  echo ""
  exit 0
else
  echo -e "${GREEN}✅ All secrets validated successfully!${NC}"
  echo ""
  exit 0
fi
