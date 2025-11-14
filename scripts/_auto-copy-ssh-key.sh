#!/bin/bash
# Automated SSH key copy script
# This will attempt to copy the SSH key with the known password

PUBKEY=$(cat ~/.ssh/id_kevin_prod.pub)
PASSWORD="(130Bpm)"

echo "Attempting to copy SSH key to production server..."

# Create a temporary script that will be executed on the server
REMOTE_CMD="mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$PUBKEY' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'KEY_COPY_SUCCESS'"

# Use SSH with password (interactive prompt)
echo "Connecting to kevin@kevinalthaus.com..."
echo "When prompted, enter password: (130Bpm)"
echo ""

winpty ssh -o StrictHostKeyChecking=accept-new kevin@kevinalthaus.com "$REMOTE_CMD"

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✓ SSH key appears to be copied successfully!"
    echo "Testing passwordless connection..."

    if ssh -o BatchMode=yes kevin-prod exit 2>/dev/null; then
        echo "✓ Passwordless SSH is working!"
        exit 0
    else
        echo "⚠ Key copy succeeded but passwordless auth test failed"
        echo "Please test manually: ssh kevin-prod"
        exit 1
    fi
else
    echo "✗ SSH key copy failed"
    exit 1
fi
