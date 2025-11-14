#!/bin/bash
# Helper script to copy SSH key to production server
# This is a temporary script that will be deleted after use

PROD_HOST="kevinalthaus.com"
PROD_USER="kevin"
KEY_PATH="$HOME/.ssh/id_kevin_prod"

echo "======================================"
echo "SSH Key Copy Helper"
echo "======================================"
echo ""
echo "This will copy your SSH public key to the production server."
echo "You will be prompted for the password: (130Bpm)"
echo ""

# Use ssh-copy-id with the key
ssh-copy-id -i "${KEY_PATH}.pub" "${PROD_USER}@${PROD_HOST}"

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
