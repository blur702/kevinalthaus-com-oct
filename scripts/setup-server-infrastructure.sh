#!/bin/bash
# Server Infrastructure Setup Script
# Automates Phase 1 infrastructure setup on production server
# Usage: ./scripts/setup-server-infrastructure.sh [--dry-run]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (from SSH-SETUP-INSTRUCTIONS.md)
PROD_HOST="kevin-prod"
PROD_USER="kevin"
PROD_SERVER="kevinalthaus.com"
PROD_IP="65.181.112.77"
PROD_PASSWORD="${PROD_SUDO_PASSWORD:-}"  # Sudo password from environment variable
APP_DIR="/opt/kevinalthaus"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Flags
DRY_RUN=false
AUTO_CONFIRM=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --yes|-y)
            AUTO_CONFIRM=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--yes]"
            exit 1
            ;;
    esac
done

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

step() {
    echo
    echo -e "${BLUE}▶${NC} $1"
}

# Execute command on remote server
ssh_exec() {
    local cmd="$1"
    local description="${2:-Executing remote command}"

    if [ "$DRY_RUN" == "true" ]; then
        echo "[DRY RUN] Would execute: $cmd"
        return 0
    fi

    log "$description"
    if ! ssh "$PROD_HOST" "$cmd"; then
        error "Failed: $description"
    fi
}

# Execute sudo command on remote server
ssh_sudo() {
    local cmd="$1"
    local description="${2:-Executing remote sudo command}"

    if [ "$DRY_RUN" == "true" ]; then
        echo "[DRY RUN] Would execute with sudo: $cmd"
        return 0
    fi

    log "$description"
    # Use echo to pipe password to sudo -S (stdin)
    if ! ssh "$PROD_HOST" "echo '$PROD_PASSWORD' | sudo -S $cmd"; then
        error "Failed: $description"
    fi
}

# Execute command and return output
ssh_output() {
    local cmd="$1"

    if [ "$DRY_RUN" == "true" ]; then
        echo "[DRY RUN] Would execute and capture: $cmd"
        return 0
    fi

    ssh "$PROD_HOST" "$cmd" 2>&1
}

# Copy file to remote server
scp_to_server() {
    local local_path="$1"
    local remote_path="$2"
    local description="${3:-Copying file to server}"

    if [ "$DRY_RUN" == "true" ]; then
        echo "[DRY RUN] Would copy: $local_path -> ${PROD_HOST}:${remote_path}"
        return 0
    fi

    log "$description"
    if ! scp "$local_path" "${PROD_HOST}:${remote_path}"; then
        error "Failed: $description"
    fi
}

# Pre-flight checks
preflight_checks() {
    step "Running pre-flight checks..."

    # Check if sudo password is set
    if [ -z "$PROD_PASSWORD" ]; then
        error "PROD_SUDO_PASSWORD environment variable is not set. Please set it before running this script."
    fi

    # Check if SSH config exists for production server
    if ! grep -q "Host $PROD_HOST" ~/.ssh/config 2>/dev/null; then
        warn "SSH config not found for $PROD_HOST"
        echo "Run ./scripts/setup-ssh-keys.sh first to configure SSH access"
        error "SSH configuration missing"
    fi

    # Check if private key exists
    if [ ! -f ~/.ssh/id_kevin_prod ]; then
        warn "SSH private key not found at ~/.ssh/id_kevin_prod"
        echo "Run ./scripts/setup-ssh-keys.sh first to generate SSH keys"
        error "SSH key missing"
    fi

    # Test SSH connection
    log "Testing SSH connection to $PROD_SERVER..."
    if [ "$DRY_RUN" == "false" ]; then
        if ! ssh -q "$PROD_HOST" exit; then
            error "Cannot connect to production server. Check SSH configuration and keys."
        fi
    fi

    log "✓ SSH connection verified"

    # Check if deploy-ubuntu.sh exists
    if [ ! -f "$SCRIPT_DIR/deploy-ubuntu.sh" ]; then
        error "deploy-ubuntu.sh not found at $SCRIPT_DIR/deploy-ubuntu.sh"
    fi

    log "✓ Pre-flight checks passed"
}

# Display deployment summary
show_summary() {
    step "Phase 1 Infrastructure Setup Summary"

    echo
    echo "This script will install and configure:"
    echo "  • System packages: curl, git, openssl, ufw, fail2ban"
    echo "  • Docker Engine and Docker Compose v2"
    echo "  • UFW Firewall (SSH, HTTP, HTTPS)"
    echo "  • fail2ban SSH protection"
    echo "  • Application directory: $APP_DIR"
    echo "  • Log rotation configuration"
    echo
    echo "Target Server:"
    echo "  • Host: $PROD_SERVER ($PROD_IP)"
    echo "  • User: $PROD_USER"
    echo "  • Directory: $APP_DIR"
    echo

    if [ "$DRY_RUN" == "true" ]; then
        warn "DRY RUN MODE - No changes will be made"
        echo
        return 0
    fi

    if [ "$AUTO_CONFIRM" == "false" ]; then
        read -p "Continue with Phase 1 setup? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Setup cancelled by user"
            exit 0
        fi
    else
        log "Auto-confirm enabled, proceeding with setup..."
    fi
}

# Copy and execute deploy script
execute_deploy_script() {
    step "Executing infrastructure deployment..."

    # Create temporary directory on remote server
    log "Creating temporary directory on server..."
    REMOTE_TEMP="/tmp/kevinalthaus-setup-$(date +%Y%m%d-%H%M%S)"
    ssh_exec "mkdir -p $REMOTE_TEMP" "Creating temporary directory"

    # Copy deploy script to server
    scp_to_server "$SCRIPT_DIR/deploy-ubuntu.sh" "$REMOTE_TEMP/deploy-ubuntu.sh" \
        "Copying deploy-ubuntu.sh to server"

    # Make script executable
    ssh_exec "chmod +x $REMOTE_TEMP/deploy-ubuntu.sh" "Making script executable"

    # Execute deploy script with sudo
    log "Executing deploy-ubuntu.sh on server (this may take several minutes)..."
    log "Output will be displayed in real-time:"
    echo

    if [ "$DRY_RUN" == "false" ]; then
        # Execute script with sudo and stream output
        # Use -tt to force pseudo-terminal allocation
        if ! ssh -tt "$PROD_HOST" "echo '$PROD_PASSWORD' | sudo -S bash -c 'APP_DIR=$APP_DIR $REMOTE_TEMP/deploy-ubuntu.sh'"; then
            error "Deployment script failed. Check output above for details."
        fi
    else
        echo "[DRY RUN] Would execute: sudo APP_DIR=$APP_DIR $REMOTE_TEMP/deploy-ubuntu.sh"
    fi

    echo
    log "✓ Infrastructure deployment completed"

    # Cleanup temporary directory
    ssh_exec "rm -rf $REMOTE_TEMP" "Cleaning up temporary files"
}

# Run verification script
verify_installation() {
    step "Verifying installation..."

    # Copy verification script to server
    log "Copying verification script to server..."
    REMOTE_VERIFY="/tmp/verify-system-setup.sh"
    scp_to_server "$SCRIPT_DIR/verify-system-setup.sh" "$REMOTE_VERIFY" \
        "Copying verify-system-setup.sh to server"

    # Make script executable
    ssh_exec "chmod +x $REMOTE_VERIFY" "Making verification script executable"

    # Execute verification script
    log "Running system verification..."
    echo

    if [ "$DRY_RUN" == "false" ]; then
        if ssh "$PROD_HOST" "$REMOTE_VERIFY"; then
            log "✓ All components verified successfully"
        else
            warn "Some components failed verification. Check output above."
            EXIT_CODE=$?
        fi
    else
        echo "[DRY RUN] Would execute: $REMOTE_VERIFY"
    fi

    echo

    # Save verification results locally
    VERIFY_LOG="$PROJECT_ROOT/infrastructure-verification-$(date +%Y%m%d-%H%M%S).log"

    if [ "$DRY_RUN" == "false" ]; then
        log "Saving verification results to local file..."
        ssh "$PROD_HOST" "$REMOTE_VERIFY" > "$VERIFY_LOG" 2>&1 || true
        log "✓ Verification results saved to: $VERIFY_LOG"
    else
        echo "[DRY RUN] Would save results to: $VERIFY_LOG"
    fi

    # Cleanup
    ssh_exec "rm -f $REMOTE_VERIFY" "Cleaning up verification script"
}

# Show final summary
show_final_summary() {
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "PHASE 1 INFRASTRUCTURE SETUP COMPLETE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    log "Server: $PROD_SERVER ($PROD_IP)"
    log "Application Directory: $APP_DIR"
    echo
    log "Installed Components:"
    echo "  • Docker Engine + Docker Compose v2"
    echo "  • System utilities (curl, git, openssl)"
    echo "  • UFW Firewall (SSH, HTTP, HTTPS)"
    echo "  • fail2ban SSH protection"
    echo "  • Log rotation configuration"
    echo
    log "Next Steps:"
    echo "  1. Review verification results above"
    echo "  2. Proceed to Phase 2: Application deployment"
    echo "     Run: ./scripts/deploy-to-prod.sh"
    echo "  3. Setup automated backups"
    echo "     Run: ssh $PROD_HOST 'cd $APP_DIR && ./scripts/setup-cron.sh'"
    echo
    log "Useful Commands:"
    echo "  • SSH to server: ssh $PROD_HOST"
    echo "  • Check services: ssh $PROD_HOST 'systemctl status docker fail2ban ufw'"
    echo "  • View firewall: ssh $PROD_HOST 'sudo ufw status verbose'"
    echo "  • Check fail2ban: ssh $PROD_HOST 'sudo fail2ban-client status sshd'"
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
}

# Main execution
main() {
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Phase 1: Server Infrastructure Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo

    preflight_checks
    show_summary
    execute_deploy_script
    verify_installation
    show_final_summary

    log "Phase 1 setup completed successfully! ✓"
    echo
}

# Run main function
main "$@"
