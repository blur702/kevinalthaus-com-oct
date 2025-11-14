#!/bin/bash
# Production Environment Setup Script
set -euo pipefail

cd /opt/kevinalthaus

echo '========================================='
echo 'CONFIGURING PRODUCTION ENVIRONMENT'
echo '========================================='
echo ''

# Create .env from example
cp .env.example .env

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
FINGERPRINT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
CSRF_SECRET=$(openssl rand -base64 32 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
PLUGIN_SIGNATURE_SECRET=$(openssl rand -base64 32 | tr -d '\n')
INTERNAL_GATEWAY_TOKEN=$(openssl rand -base64 32 | tr -d '\n')
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')

# Create new .env with all secrets
cat > .env <<EOF
# Node Environment
NODE_ENV=production

# Security Secrets
JWT_SECRET=$JWT_SECRET
FINGERPRINT_SECRET=$FINGERPRINT_SECRET
SESSION_SECRET=$SESSION_SECRET
CSRF_SECRET=$CSRF_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
PLUGIN_SIGNATURE_SECRET=$PLUGIN_SIGNATURE_SECRET
INTERNAL_GATEWAY_TOKEN=$INTERNAL_GATEWAY_TOKEN

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_USER=postgres
POSTGRES_DB=kevinalthaus
DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@postgres:5432/kevinalthaus

# Ports (from shared config)
API_GATEWAY_PORT=3000
FRONTEND_PORT=3001
ADMIN_PORT=3002
MAIN_APP_PORT=3003
PLUGIN_ENGINE_PORT=3004
PYTHON_SERVICE_PORT=8000

# Cookie Settings
COOKIE_SAMESITE=lax
EOF

echo '✓ Environment file configured with secure secrets'
echo ''

# Create secrets directory
mkdir -p secrets
chmod 700 secrets

# Save PostgreSQL password to secrets file
echo "$POSTGRES_PASSWORD" > secrets/postgres_password.txt
chmod 600 secrets/postgres_password.txt

echo '✓ Secrets directory created'
echo ''

# Generate SSL certificates (self-signed for now)
if [ ! -f secrets/server.crt ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout secrets/server.key \
        -out secrets/server.crt \
        -subj '/CN=kevinalthaus.com' 2>/dev/null
    chmod 600 secrets/server.key secrets/server.crt
    echo '✓ SSL certificates generated'
fi

echo ''
echo '========================================='
echo 'Environment configuration complete!'
echo '========================================='
