#!/bin/bash
# ========================================
# Ubuntu Production Deployment Script
# ========================================
# Deploys Kevin Althaus platform on Ubuntu 20.04, 22.04, 24.04 LTS
# Run with: sudo ./scripts/deploy-ubuntu.sh
# ========================================

set -euo pipefail  # Exit on error, unset variables, and pipeline failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="${APP_DIR:-/opt/kevinalthaus}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kevinalthaus}"
LOG_FILE="/tmp/deploy-ubuntu-$(date +%Y%m%d-%H%M%S).log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
log "Checking prerequisites..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root or with sudo"
fi

# Check Ubuntu version
if [ ! -f /etc/lsb-release ]; then
    error "This script is designed for Ubuntu only"
fi

source /etc/lsb-release
if [[ ! "$DISTRIB_RELEASE" =~ ^(20.04|22.04|24.04)$ ]]; then
    warn "This script is tested on Ubuntu 20.04/22.04/24.04 LTS. Your version: $DISTRIB_RELEASE"
fi

# Check disk space (minimum 20GB)
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 20971520 ]; then
    error "Insufficient disk space. At least 20GB required."
fi

# Install Docker
log "Installing Docker..."
if ! command -v docker &> /dev/null; then
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release

    mkdir -p /etc/apt/keyrings

    # Download Docker GPG key and verify fingerprint
    log "Downloading and verifying Docker GPG key..."
    TEMP_GPG_FILE=$(mktemp)
    trap 'rm -f "$TEMP_GPG_FILE"' EXIT

    if ! curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o "$TEMP_GPG_FILE"; then
        error "Failed to download Docker GPG key"
    fi

    # Compute fingerprint from downloaded key
    ACTUAL_FINGERPRINT=$(gpg --with-colons --import-options show-only --import "$TEMP_GPG_FILE" 2>/dev/null | awk -F: '/fpr:/ {print $10; exit}')
    EXPECTED_FINGERPRINT="9DC858229FC7DD38854AE2D88D81803C0EBFCD88"

    if [ "$ACTUAL_FINGERPRINT" != "$EXPECTED_FINGERPRINT" ]; then
        rm -f "$TEMP_GPG_FILE"
        error "Docker GPG key fingerprint mismatch!\nExpected: $EXPECTED_FINGERPRINT\nActual: $ACTUAL_FINGERPRINT\nThis could indicate a security compromise. Aborting installation."
    fi

    log "✓ Docker GPG key fingerprint verified: $ACTUAL_FINGERPRINT"

    # Dearmor and install the verified key
    gpg --dearmor < "$TEMP_GPG_FILE" > /etc/apt/keyrings/docker.gpg
    rm -f "$TEMP_GPG_FILE"

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    log "Docker installed successfully"
else
    log "Docker already installed"
fi

# Install Docker Compose V2
if ! docker compose version &> /dev/null; then
    error "Docker Compose V2 not found. Please install Docker Compose plugin"
fi

# Install required packages
log "Installing required packages..."
apt-get install -y curl git openssl ufw

# Setup application directory
log "Setting up application directory..."
mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$APP_DIR/logs"

# Configure firewall
log "Configuring firewall..."
ufw allow ssh || error "Failed to allow SSH in firewall"
ufw --force enable
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw status

# Setup environment
log "Setting up environment configuration..."
if [ ! -f "$APP_DIR/.env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production "$APP_DIR/.env"
        log "Copied .env.production to $APP_DIR/.env"
        warn "IMPORTANT: Edit $APP_DIR/.env and set secure passwords and secrets!"
        warn "Generate secrets with: openssl rand -hex 32"
    else
        error ".env.production file not found"
    fi
else
    log ".env file already exists"
fi

# Validate required Docker Compose files exist before copying
[ ! -f "./docker-compose.yml" ] && error "docker-compose.yml not found in current directory"
[ ! -f "./docker-compose.prod.yml" ] && error "docker-compose.prod.yml not found in current directory"

# Copy application files
log "Copying application files..."

# Verify APP_DIR exists and is not empty (safety check before rsync --delete)
if [ ! -d "$APP_DIR" ]; then
    error "APP_DIR does not exist: $APP_DIR"
fi

# Check if we're in the correct source directory
if [ ! -f "./docker-compose.yml" ] || [ ! -f "./package.json" ]; then
    error "Current directory does not appear to be the kevinalthaus application root. Aborting rsync to prevent data loss."
fi

# Perform dry-run first to show what would be changed
log "Performing rsync dry-run to preview changes..."
RSYNC_DRY_RUN=$(mktemp)
rsync -av --dry-run --delete --exclude='.git' --exclude='node_modules' --exclude='.env' . "$APP_DIR/" > "$RSYNC_DRY_RUN" 2>&1

# Check if anything would be deleted
DELETED_FILES=$(grep "deleting" "$RSYNC_DRY_RUN" | head -20)
TOTAL_DELETED=$(grep -c "deleting" "$RSYNC_DRY_RUN" || echo "0")

if [ "$TOTAL_DELETED" -gt 0 ]; then
    warn "rsync --delete will remove $TOTAL_DELETED file(s) from $APP_DIR"
    echo "$DELETED_FILES"
    if [ "$TOTAL_DELETED" -gt 20 ]; then
        warn "... and $(($TOTAL_DELETED - 20)) more files"
    fi
fi

# Show summary of changes
echo ""
log "Rsync dry-run summary:"
grep -E "^(sending|deleting|total size)" "$RSYNC_DRY_RUN" || echo "No significant changes"
rm -f "$RSYNC_DRY_RUN"
echo ""

# Prompt for confirmation unless in non-interactive mode
if [ "${FORCE:-0}" != "1" ] && [ "${CI:-false}" != "true" ]; then
    read -p "Proceed with rsync? This will sync files and delete removed files in $APP_DIR (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Rsync cancelled by user"
    fi
else
    log "Non-interactive mode (FORCE=1 or CI=true), proceeding with rsync..."
fi

# Perform actual rsync
log "Syncing application files..."
# --delete flag removes files in destination that don't exist in source
rsync -av --delete --exclude='.git' --exclude='node_modules' --exclude='.env' . "$APP_DIR/"
log "✓ Application files synced successfully"

cd "$APP_DIR"

# Validate .env file for security issues
log "Validating .env file for security issues..."
if [ -f "$APP_DIR/.env" ]; then
    # Optional: allow skipping env validation
    if [ "${SKIP_ENV_VALIDATION:-0}" != "1" ]; then
        # Refined placeholder detection to reduce false positives
        # Only match placeholders in assignment context (after =) to ignore comments
        if grep -qE '=(.*)(CHANGE_ME\b)|(<[A-Z0-9_]+>)|(\bplaceholder\b)|(\bexample\b)|(your_[A-Z0-9_]+)' "$APP_DIR/.env"; then
            error "Found placeholder values in .env file. Please replace all placeholders with actual values before deployment. If this detection is incorrect, set SKIP_ENV_VALIDATION=1 to bypass the check."
        fi
    else
        warn "SKIP_ENV_VALIDATION=1 set; skipping .env placeholder checks"
    fi

    # Parse the .env file safely (without executing commands)
    # Only extract simple KEY=VALUE lines, ignore comments and blank lines
    while IFS='=' read -r key value; do
        # Skip blank lines and comments
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue

        # Validate variable name: only letters, digits, underscores, not starting with digit
        if ! [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
            warn "Skipping invalid variable name in .env: $key"
            continue
        fi

        # Remove leading/trailing whitespace and quotes from value
        value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")

        # Export the variable using safe assignment (no eval or indirect expansion)
        export "$key=$value"
    done < "$APP_DIR/.env"

    # Validate JWT_SECRET
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "" ]; then
        error "JWT_SECRET is missing or empty in .env file. Generate one with: openssl rand -hex 32"
    fi

    # Validate POSTGRES_PASSWORD
    if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "" ]; then
        error "POSTGRES_PASSWORD is missing or empty in .env file. Generate one with: openssl rand -hex 32"
    fi

    log "✓ Environment file validation passed"
else
    error ".env file not found at $APP_DIR/.env"
fi

# Build Docker images
log "Building Docker images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
log "Starting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for health checks
log "Waiting for services to be healthy..."
sleep 30

# Verify services
log "Verifying services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Setup log rotation
log "Setting up log rotation..."
cat > /etc/logrotate.d/kevinalthaus <<EOF
$APP_DIR/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
    sharedscripts
}
EOF

log "========================================="
log "Deployment completed successfully!"
log "========================================="
log "Application directory: $APP_DIR"
log "Backup directory: $BACKUP_DIR"
log "Log file: $LOG_FILE"
log ""
log "Next steps:"
log "1. Edit $APP_DIR/.env and set secure passwords"
log "2. Generate secrets: openssl rand -hex 32"
log "3. Restart services: cd $APP_DIR && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart"
log "4. Setup backups: ./scripts/setup-cron.sh"
log "5. Configure SSL certificates (Let's Encrypt recommended)"
log ""
log "Check services: docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"
log "View logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
log "========================================="
