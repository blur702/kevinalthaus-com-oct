#!/bin/bash
# Test SSH Connection Script
# This script will help test the SSH connection to production server

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROD_HOST="65.181.112.77"
PROD_USER="kevin"
KEY_PATH="$HOME/.ssh/id_kevin_prod"

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

step() {
    echo -e "${BLUE}▶${NC} $1"
}

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "SSH Connection Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Step 1: Check if key exists
step "Step 1: Checking SSH key..."
if [ -f "$KEY_PATH" ]; then
    log "SSH key exists at $KEY_PATH ✓"
    log "Key fingerprint:"
    ssh-keygen -lf "$KEY_PATH"
else
    warn "SSH key not found, generating new key..."
    ssh-keygen -t ed25519 -C "dev-to-prod@kevinalthaus.com" -f "$KEY_PATH" -N "" -q
    log "SSH key generated ✓"
fi

# Fix permissions on Windows
chmod 600 "$KEY_PATH" 2>/dev/null || true
chmod 644 "${KEY_PATH}.pub" 2>/dev/null || true

echo

# Step 2: Test network connectivity
step "Step 2: Testing network connectivity..."
if ping -c 1 -W 5 "$PROD_HOST" &>/dev/null || ping -n 1 -w 5000 "$PROD_HOST" &>/dev/null; then
    log "Server is reachable ✓"
else
    error "Cannot reach server at $PROD_HOST"
    exit 1
fi

echo

# Step 3: Test SSH port
step "Step 3: Testing SSH port..."
if nc -zv -w 5 "$PROD_HOST" 22 2>&1 | grep -q "succeeded\|open" || \
   timeout 5 bash -c "cat < /dev/null > /dev/tcp/$PROD_HOST/22" 2>/dev/null; then
    log "SSH port 22 is open ✓"
else
    error "SSH port 22 is not accessible"
    exit 1
fi

echo

# Step 4: Test SSH authentication methods
step "Step 4: Checking SSH authentication methods..."
SSH_AUTH=$(ssh -o ConnectTimeout=10 -o BatchMode=yes "$PROD_USER@$PROD_HOST" exit 2>&1 || true)
if echo "$SSH_AUTH" | grep -q "publickey,password"; then
    log "Server accepts: publickey and password authentication ✓"
elif echo "$SSH_AUTH" | grep -q "publickey"; then
    log "Server accepts: publickey authentication only ✓"
elif echo "$SSH_AUTH" | grep -q "password"; then
    log "Server accepts: password authentication only ✓"
else
    warn "Could not determine authentication methods"
    echo "$SSH_AUTH"
fi

echo

# Step 5: Try key-based authentication
step "Step 5: Testing key-based authentication..."
if ssh -i "$KEY_PATH" -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no \
   "$PROD_USER@$PROD_HOST" "echo 'Connection successful'" 2>/dev/null; then
    log "Key-based authentication works! ✓"
    echo
    log "You can connect with: ssh -i $KEY_PATH $PROD_USER@$PROD_HOST"
    log "Or with alias: ssh kevin-prod (after running setup-ssh-keys.sh)"
    exit 0
else
    warn "Key-based authentication not set up yet"
    echo
    log "The public key needs to be copied to the server"
    echo
fi

echo

# Step 6: Offer to copy public key
step "Step 6: Copy public key to server"
echo
log "To enable passwordless SSH, we need to copy your public key to the server"
log "You will be prompted for the production server password"
echo
read -p "Would you like to copy the public key now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo
    log "Copying public key to server..."

    # Try ssh-copy-id if available
    if command -v ssh-copy-id &>/dev/null; then
        ssh-copy-id -i "${KEY_PATH}.pub" "$PROD_USER@$PROD_HOST"
    else
        # Manual method
        log "ssh-copy-id not found, using manual method"
        echo
        warn "You will be prompted for the production server password"
        echo

        # Create .ssh directory on remote
        ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" \
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh"

        # Copy public key
        cat "${KEY_PATH}.pub" | ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" \
            "cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && \
             sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys"
    fi

    if [ $? -eq 0 ]; then
        echo
        log "Public key copied successfully! ✓"
        echo

        # Test connection again
        log "Testing connection with key..."
        if ssh -i "$KEY_PATH" -o ConnectTimeout=10 -o BatchMode=yes \
           "$PROD_USER@$PROD_HOST" "echo 'SSH setup complete!'" 2>/dev/null; then
            echo
            log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            log "SUCCESS! SSH key-based authentication is working! ✓"
            log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo
            log "You can now connect with:"
            echo "  ssh -i $KEY_PATH $PROD_USER@$PROD_HOST"
            echo
            log "Next steps:"
            echo "  1. Run: ./scripts/setup-ssh-keys.sh (to configure SSH config)"
            echo "  2. Run: ./scripts/deploy-to-prod.sh (to deploy)"
            echo
        else
            error "Connection test failed after copying key"
            exit 1
        fi
    else
        error "Failed to copy public key"
        exit 1
    fi
else
    echo
    log "Skipped. Run ./scripts/setup-ssh-keys.sh when ready"
fi

echo
