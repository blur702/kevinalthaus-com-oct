#!/bin/bash
# SSH Key Setup Script for Production Deployment
# Sets up passwordless SSH authentication from dev to prod server
# Usage: ./scripts/setup-ssh-keys.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production server details
PROD_HOST="65.181.112.77"
PROD_USER="kevin"
KEY_NAME="id_kevin_prod"
KEY_PATH="$HOME/.ssh/$KEY_NAME"

# Logging functions
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if SSH directory exists
setup_ssh_directory() {
    log "Setting up SSH directory..."
    if [ ! -d "$HOME/.ssh" ]; then
        mkdir -p "$HOME/.ssh"
        chmod 700 "$HOME/.ssh"
        log "Created ~/.ssh directory"
    fi
}

# Generate SSH key pair
generate_ssh_key() {
    if [ -f "$KEY_PATH" ]; then
        warn "SSH key already exists at $KEY_PATH"
        read -p "Overwrite existing key? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Keeping existing key"
            return 0
        fi
        rm -f "$KEY_PATH" "${KEY_PATH}.pub"
    fi

    log "Generating ED25519 SSH key pair..."
    ssh-keygen -t ed25519 \
        -C "dev-to-prod@kevinalthaus.com" \
        -f "$KEY_PATH" \
        -N "" \
        -q

    if [ $? -eq 0 ]; then
        log "SSH key pair generated successfully"
        chmod 600 "$KEY_PATH"
        chmod 644 "${KEY_PATH}.pub"
    else
        error "Failed to generate SSH key pair"
    fi
}

# Copy public key to production server
copy_public_key() {
    log "Copying public key to production server..."
    echo
    warn "You will be prompted for the production server password"
    warn "Password will only be used this one time for initial setup"
    echo

    # Check if ssh-copy-id is available
    if command -v ssh-copy-id &> /dev/null; then
        ssh-copy-id -i "${KEY_PATH}.pub" "${PROD_USER}@${PROD_HOST}"
    else
        # Manual fallback for Windows/systems without ssh-copy-id
        warn "ssh-copy-id not found, using manual method"

        read -sp "Enter production server password: " PROD_PASS
        echo

        # Create .ssh directory on remote if it doesn't exist
        sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "${PROD_USER}@${PROD_HOST}" \
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh"

        # Copy the public key
        cat "${KEY_PATH}.pub" | sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no \
            "${PROD_USER}@${PROD_HOST}" \
            "cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

        # Clear password from memory
        unset PROD_PASS
    fi

    if [ $? -eq 0 ]; then
        log "Public key copied successfully"
    else
        error "Failed to copy public key to production server"
    fi
}

# Test SSH connection
test_ssh_connection() {
    log "Testing SSH connection..."

    ssh -i "$KEY_PATH" \
        -o StrictHostKeyChecking=no \
        -o ConnectTimeout=10 \
        "${PROD_USER}@${PROD_HOST}" \
        "echo 'SSH connection successful'" &> /dev/null

    if [ $? -eq 0 ]; then
        log "SSH connection test passed ✓"
        echo
        log "You can now connect with: ssh -i $KEY_PATH ${PROD_USER}@${PROD_HOST}"
    else
        error "SSH connection test failed"
    fi
}

# Setup SSH config
setup_ssh_config() {
    log "Setting up SSH config..."

    SSH_CONFIG="$HOME/.ssh/config"
    CONFIG_ENTRY="Host kevin-prod
    HostName ${PROD_HOST}
    User ${PROD_USER}
    IdentityFile ${KEY_PATH}
    StrictHostKeyChecking accept-new
    ServerAliveInterval 60
    ServerAliveCountMax 3"

    # Check if config already has this entry
    if [ -f "$SSH_CONFIG" ] && grep -q "Host kevin-prod" "$SSH_CONFIG"; then
        warn "SSH config entry already exists"
        read -p "Update existing entry? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Remove old entry
            sed -i.bak '/Host kevin-prod/,/^$/d' "$SSH_CONFIG"
            echo "$CONFIG_ENTRY" >> "$SSH_CONFIG"
            log "Updated SSH config"
        fi
    else
        echo "$CONFIG_ENTRY" >> "$SSH_CONFIG"
        log "Added SSH config entry"
    fi

    chmod 600 "$SSH_CONFIG"
    echo
    log "You can now connect with: ssh kevin-prod"
}

# Display security recommendations
show_security_recommendations() {
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "SECURITY RECOMMENDATIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    echo "1. ✓ SSH keys have been set up for passwordless authentication"
    echo "2. ⚠️  The temporary password (130Bpm) is no longer needed"
    echo "3. 🔒 Keep your private key secure: $KEY_PATH"
    echo "4. 📝 Key permissions set to 600 (read/write for owner only)"
    echo "5. 🔑 Consider adding a passphrase to the key for extra security:"
    echo "   ssh-keygen -p -f $KEY_PATH"
    echo "6. 🚫 Never commit the private key to version control"
    echo "7. 🔐 On production server, disable password authentication:"
    echo "   Edit /etc/ssh/sshd_config:"
    echo "   PasswordAuthentication no"
    echo "   systemctl restart sshd"
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
}

# Main execution
main() {
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "SSH Key Setup for Production Deployment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    log "Production Server: ${PROD_USER}@${PROD_HOST}"
    echo

    # Check for sshpass on non-Windows systems
    if [[ "$OSTYPE" != "msys" ]] && [[ "$OSTYPE" != "win32" ]]; then
        if ! command -v sshpass &> /dev/null && ! command -v ssh-copy-id &> /dev/null; then
            warn "Neither sshpass nor ssh-copy-id found"
            echo "Install one of them:"
            echo "  Ubuntu/Debian: sudo apt install sshpass"
            echo "  macOS: brew install sshpass"
            error "Required tool not found"
        fi
    fi

    setup_ssh_directory
    generate_ssh_key
    copy_public_key
    test_ssh_connection
    setup_ssh_config
    show_security_recommendations

    log "SSH key setup complete! ✓"
    echo
    log "Next steps:"
    echo "  1. Test connection: ssh kevin-prod"
    echo "  2. Run deployment: ./scripts/deploy-to-prod.sh"
    echo
}

# Run main function
main "$@"
