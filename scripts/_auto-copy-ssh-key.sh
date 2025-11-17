#!/bin/bash
# Automated SSH key copy script
# This will attempt to copy the SSH key using SSH_SETUP_PASSWORD environment variable
# Usage: export SSH_SETUP_PASSWORD='your_password' before running this script

# Cleanup function to clear SSHPASS variable
cleanup_sshpass() {
    SSHPASS=""
    unset SSHPASS
}

# Register cleanup to run on exit and signals
trap cleanup_sshpass EXIT INT TERM

if [ -z "$SSH_SETUP_PASSWORD" ]; then
    echo "Error: SSH_SETUP_PASSWORD environment variable is not set"
    echo "Please set it before running this script:"
    echo "  export SSH_SETUP_PASSWORD='your_password'"
    exit 1
fi

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed"
    echo "Please install sshpass to use automated password authentication:"
    echo "  - Ubuntu/Debian: sudo apt-get install sshpass"
    echo "  - macOS: brew install hudochenkov/sshpass/sshpass"
    echo "  - Windows (Git Bash): Download from https://sourceforge.net/projects/sshpass/"
    exit 1
fi

# Export password for sshpass
export SSHPASS="$SSH_SETUP_PASSWORD"

echo "Attempting to copy SSH key to production server..."

# Detect if we need winpty (Windows Git Bash/CYGWIN/MINGW)
WINPTY_CMD=""
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    # Check if winpty exists
    if command -v winpty &> /dev/null; then
        WINPTY_CMD="winpty"
    fi
fi

# Use sshpass with SSH for automated password authentication
echo "Connecting to kevin@kevinalthaus.com..."

# First, create the .ssh directory and set permissions (safe, no user input)
$WINPTY_CMD sshpass -e ssh -o StrictHostKeyChecking=accept-new kevin@kevinalthaus.com 'mkdir -p ~/.ssh && chmod 700 ~/.ssh'

RESULT=$?
if [ $RESULT -ne 0 ]; then
    echo "✗ Failed to create .ssh directory"
    exit 1
fi

# Second, pipe the public key data to the remote shell to avoid command injection
# The key content is sent as stdin, not as part of the command string
cat ~/.ssh/id_kevin_prod.pub | $WINPTY_CMD sshpass -e ssh kevin@kevinalthaus.com 'cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo "KEY_COPY_SUCCESS"'

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
