#!/bin/bash
# ========================================
# Ubuntu Production Deployment Script
# ========================================
# Deploys Kevin Althaus platform on Ubuntu 20.04/22.04 LTS
# Run with: sudo ./scripts/deploy-ubuntu.sh
# ========================================

set -e  # Exit on error

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
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

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
ufw allow ssh
if [ $? -ne 0 ]; then
    log "ERROR: Failed to allow SSH in firewall"
    exit 1
fi
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
if [ ! -f "./docker-compose.yml" ]; then
    log "ERROR: docker-compose.yml not found in current directory"
    exit 1
fi

if [ ! -f "./docker-compose.prod.yml" ]; then
    log "ERROR: docker-compose.prod.yml not found in current directory"
    exit 1
fi

# Copy application files
log "Copying application files..."
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env' . "$APP_DIR/"

cd "$APP_DIR"

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
    create 0640 root root
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
