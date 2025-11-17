#!/bin/bash
# Helper script to copy SSH key to production server
# This is a temporary script that will be deleted after use
# Usage: Run interactively (recommended) or use pre-existing key-based auth
#
# SECURITY NOTICE:
# SSH_SETUP_PASSWORD env var is NO LONGER SUPPORTED due to security risks:
# - Exposes password in process listings
# - Can leak via shell history or logs
# Use interactive mode (secure) or ensure key-based auth is already set up.

PROD_HOST="kevinalthaus.com"
PROD_USER="kevin"
KEY_PATH="$HOME/.ssh/id_kevin_prod"
# Expected server SSH host key fingerprint (verify out-of-band before first use)
EXPECTED_FINGERPRINT="SHA256:PLACEHOLDER_REPLACE_WITH_ACTUAL_SERVER_FINGERPRINT"

echo "======================================"
echo "SSH Key Copy Helper"
echo "======================================"
echo ""

# Check for deprecated SSH_SETUP_PASSWORD usage
if [ -n "$SSH_SETUP_PASSWORD" ]; then
    echo "✗ Error: SSH_SETUP_PASSWORD is no longer supported for security reasons."
    echo ""
    echo "Reason: Environment variables expose passwords to process listings."
    echo ""
    echo "Alternative methods:"
    echo "  1. Run this script interactively (recommended)"
    echo "  2. Use a secure secrets manager"
    echo "  3. Set up key-based authentication manually"
    echo ""
    exit 1
fi

# Verify SSH host key before copying public key
echo "Step 1: Verifying server SSH host key fingerprint..."
echo ""

# Fetch server host key
SERVER_KEY=$(ssh-keyscan -t ed25519 "$PROD_HOST" 2>/dev/null)
if [ -z "$SERVER_KEY" ]; then
    echo "✗ Error: Could not fetch server host key from $PROD_HOST"
    exit 1
fi

# Extract fingerprint
ACTUAL_FINGERPRINT=$(echo "$SERVER_KEY" | ssh-keygen -lf - 2>/dev/null | awk '{print $2}')

echo "Server fingerprint: $ACTUAL_FINGERPRINT"
echo ""

# Verify fingerprint
if [ "$EXPECTED_FINGERPRINT" = "SHA256:PLACEHOLDER_REPLACE_WITH_ACTUAL_SERVER_FINGERPRINT" ]; then
    echo "⚠ Warning: No expected fingerprint configured in this script."
    echo ""
    echo "First-time setup: Verify this fingerprint out-of-band before proceeding."
    echo "Update EXPECTED_FINGERPRINT in this script with: $ACTUAL_FINGERPRINT"
    echo ""
    read -p "Do you trust this fingerprint and want to continue? (yes/no): " TRUST_ANSWER
    if [ "$TRUST_ANSWER" != "yes" ]; then
        echo "Aborted by user. Please verify the fingerprint and try again."
        exit 1
    fi
elif [ "$ACTUAL_FINGERPRINT" != "$EXPECTED_FINGERPRINT" ]; then
    echo "✗ SECURITY ERROR: Host key fingerprint mismatch!"
    echo ""
    echo "Expected: $EXPECTED_FINGERPRINT"
    echo "Actual:   $ACTUAL_FINGERPRINT"
    echo ""
    echo "This could indicate a man-in-the-middle attack or server key change."
    echo "DO NOT PROCEED unless you are certain the server key has legitimately changed."
    exit 1
else
    echo "✓ Host key fingerprint verified successfully"
fi

# Add verified host key to known_hosts
echo ""
echo "Step 2: Adding verified host key to known_hosts..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# Remove any existing entries for this host
ssh-keygen -R "$PROD_HOST" 2>/dev/null || true

# Add verified key
echo "$SERVER_KEY" >> "$HOME/.ssh/known_hosts"
echo "✓ Host key added to known_hosts"

# Interactive mode - use standard ssh-copy-id with strict host key checking
echo ""
echo "Step 3: Copying SSH public key to server..."
echo "You will be prompted for your SSH password."
echo ""

ssh-copy-id -o StrictHostKeyChecking=yes \
    -i "${KEY_PATH}.pub" \
    "${PROD_USER}@${PROD_HOST}"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ SSH key copied successfully!"
    echo ""
    echo "Testing connection..."
    if ssh -o BatchMode=yes kevin-prod exit 2>/dev/null; then
        echo "✓ SSH connection test passed!"
    else
        echo "⚠ SSH connection test failed. Please check manually."
    fi
else
    echo "✗ Failed to copy SSH key"
    exit 1
fi
