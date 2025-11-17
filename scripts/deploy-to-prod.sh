#!/bin/bash
# Automated Production Deployment Script
# Deploys latest code to production server via SSH
# Usage: ./scripts/deploy-to-prod.sh [--force-rebuild] [--skip-checks]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROD_HOST="kevin-prod"
PROD_USER="kevin"
# Sudo password should be set via environment variable for security
# Set PROD_SUDO_PASSWORD before running this script
PROD_PASSWORD="${PROD_SUDO_PASSWORD:-}"
APP_DIR="/opt/kevinalthaus"
REPO_URL="git@github.com:yourusername/kevinalthaus-com-oct.git"  # Update with your actual repo
BRANCH="main"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_PROD_FILE="docker-compose.prod.yml"

# Flags
FORCE_REBUILD=false
SKIP_CHECKS=false
NON_INTERACTIVE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force-rebuild)
            FORCE_REBUILD=true
            shift
            ;;
        --skip-checks)
            SKIP_CHECKS=true
            shift
            ;;
        --non-interactive|--yes|-y)
            NON_INTERACTIVE=true
            SKIP_CHECKS=true  # Non-interactive implies skip checks
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--force-rebuild] [--skip-checks] [--non-interactive|--yes|-y]"
            echo ""
            echo "Options:"
            echo "  --force-rebuild       Force rebuild of Docker containers"
            echo "  --skip-checks         Skip pre-deployment confirmation"
            echo "  --non-interactive     Run without user prompts (implies --skip-checks)"
            echo "  --yes, -y             Alias for --non-interactive"
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

    log "$description"
    if ! ssh "$PROD_HOST" "$cmd"; then
        error "Failed: $description"
    fi
}

# Execute sudo command on remote server
ssh_sudo() {
    local cmd="$1"
    local description="${2:-Executing remote sudo command}"

    # Check if sudo password is set
    if [ -z "$PROD_PASSWORD" ]; then
        error "PROD_SUDO_PASSWORD environment variable is not set. Required for sudo operations on production server."
    fi

    log "$description"
    # Use echo to pipe password to sudo -S (stdin)
    if ! ssh "$PROD_HOST" "echo '$PROD_PASSWORD' | sudo -S $cmd"; then
        error "Failed: $description"
    fi
}

# Execute command on remote server and return output
ssh_output() {
    local cmd="$1"
    ssh "$PROD_HOST" "$cmd" 2>&1
}

# Check if SSH connection works
check_ssh_connection() {
    step "Checking SSH connection..."

    if ! ssh -q "$PROD_HOST" exit; then
        error "Cannot connect to production server. Run ./scripts/setup-ssh-keys.sh first"
    fi

    log "SSH connection verified ✓"
}

# Setup production server (idempotent)
setup_server() {
    step "Setting up production server..."

    # Check if required tools are installed
    log "Checking for required tools..."

    # Check and install Git
    if ! ssh_output "command -v git" &> /dev/null; then
        log "Installing Git..."
        ssh_sudo "apt update && apt install -y git" "Installing Git"
    else
        log "Git is already installed ✓"
    fi

    # Check and install Docker
    if ! ssh_output "command -v docker" &> /dev/null; then
        log "Installing Docker..."
        ssh_sudo "apt update && apt install -y docker.io" "Installing Docker"
        ssh_sudo "systemctl enable docker && systemctl start docker" "Starting Docker"
        ssh_sudo "usermod -aG docker $PROD_USER" "Adding user to docker group"
        warn "Docker installed. You may need to re-login to production server for group changes"
    else
        log "Docker is already installed ✓"
    fi

    # Check and install Docker Compose
    if ! ssh_output "command -v docker-compose" &> /dev/null; then
        log "Installing Docker Compose..."
        ssh_sudo "apt install -y docker-compose" "Installing Docker Compose"
    else
        log "Docker Compose is already installed ✓"
    fi

    # Create application directory
    if ! ssh_output "[ -d $APP_DIR ]" &> /dev/null; then
        log "Creating application directory..."
        ssh_sudo "mkdir -p $APP_DIR && chown $PROD_USER:$PROD_USER $APP_DIR" \
            "Creating $APP_DIR"
    else
        log "Application directory exists ✓"
    fi
}

# Setup Git repository on production server
setup_git_repo() {
    step "Setting up Git repository..."

    # Check if repo is already cloned
    if ssh_output "[ -d $APP_DIR/.git ]" &> /dev/null; then
        log "Git repository already exists ✓"
        return 0
    fi

    log "Cloning repository..."

    if [ "$NON_INTERACTIVE" = true ]; then
        # In non-interactive mode, use configured REPO_URL
        log "Non-interactive mode: Using configured repository URL"
        log "Using SSH URL: $REPO_URL"
        ssh_exec "cd $APP_DIR && git clone $REPO_URL ." "Cloning repository via SSH"
    else
        # Interactive mode: prompt for options
        warn "Make sure the production server has access to the Git repository"
        echo
        echo "Options:"
        echo "  1. Use HTTPS (requires credentials)"
        echo "  2. Use SSH (requires deploy key setup on GitHub/GitLab)"
        echo "  3. Skip - I'll clone manually"
        echo
        read -p "Choose option (1/2/3): " -n 1 -r
        echo

        case $REPLY in
            1)
                read -p "Enter repository HTTPS URL: " HTTPS_URL
                ssh_exec "cd $APP_DIR && git clone $HTTPS_URL ." "Cloning repository via HTTPS"
                ;;
            2)
                log "Using SSH URL: $REPO_URL"
                ssh_exec "cd $APP_DIR && git clone $REPO_URL ." "Cloning repository via SSH"
                ;;
            3)
                warn "Skipping clone. Please clone manually to $APP_DIR"
                return 0
                ;;
            *)
                error "Invalid option"
                ;;
        esac
    fi
}

# Pull latest code from Git
git_pull() {
    step "Pulling latest code from Git..."

    # Fetch latest changes
    ssh_exec "cd $APP_DIR && git fetch origin" "Fetching from origin"

    # Check current branch
    CURRENT_BRANCH=$(ssh_output "cd $APP_DIR && git rev-parse --abbrev-ref HEAD")
    log "Current branch: $CURRENT_BRANCH"

    # Check for uncommitted changes
    if ssh_output "cd $APP_DIR && git status --porcelain" | grep -q .; then
        warn "Uncommitted changes detected on production server"
        if [ "$NON_INTERACTIVE" = true ]; then
            log "Non-interactive mode: Automatically stashing changes"
            ssh_exec "cd $APP_DIR && git stash" "Stashing changes"
        else
            read -p "Stash changes and pull? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                ssh_exec "cd $APP_DIR && git stash" "Stashing changes"
            else
                error "Cannot pull with uncommitted changes"
            fi
        fi
    fi

    # Pull latest code
    ssh_exec "cd $APP_DIR && git pull origin $BRANCH" "Pulling from $BRANCH"

    # Get commit info
    COMMIT_HASH=$(ssh_output "cd $APP_DIR && git rev-parse --short HEAD")
    COMMIT_MSG=$(ssh_output "cd $APP_DIR && git log -1 --pretty=%B")

    log "Deployed commit: $COMMIT_HASH"
    log "Commit message: $COMMIT_MSG"
}

# Setup environment configuration
setup_environment() {
    step "Setting up environment configuration..."

    # Check if .env.production exists locally
    if [ ! -f ".env.production" ]; then
        if [ "$NON_INTERACTIVE" = true ]; then
            error ".env.production not found. Required for non-interactive deployment."
        fi
        warn ".env.production not found locally"
        read -p "Create from .env.example? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ -f ".env.example" ]; then
                cp .env.example .env.production
                log "Created .env.production from .env.example"
                warn "Please edit .env.production before continuing"
                error "Update .env.production and run again"
            else
                error ".env.example not found"
            fi
        else
            warn "Skipping environment setup"
            return 0
        fi
    fi

    # Copy environment file to production
    log "Copying .env.production to server..."
    scp .env.production "${PROD_HOST}:${APP_DIR}/.env"

    if [ $? -eq 0 ]; then
        log "Environment file copied ✓"
    else
        error "Failed to copy environment file"
    fi

    # Setup secrets directory
    log "Setting up secrets..."
    ssh_exec "mkdir -p $APP_DIR/secrets" "Creating secrets directory"

    # Check if secrets need to be generated
    if ! ssh_output "[ -f $APP_DIR/secrets/postgres_password.txt ]" &> /dev/null; then
        warn "Secrets not found on production server"
        if [ "$NON_INTERACTIVE" = true ]; then
            log "Non-interactive mode: Automatically generating secrets"
            generate_secrets
        else
            read -p "Generate new secrets? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                generate_secrets
            else
                warn "Skipping secrets generation. Make sure they exist before deployment!"
            fi
        fi
    else
        log "Secrets already exist ✓"
    fi
}

# Generate production secrets
generate_secrets() {
    log "Generating production secrets..."

    # Generate PostgreSQL password
    ssh_exec "openssl rand -base64 32 > $APP_DIR/secrets/postgres_password.txt" \
        "Generating PostgreSQL password"

    # Generate SSL certificates (self-signed)
    ssh_exec "openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $APP_DIR/secrets/server.key \
        -out $APP_DIR/secrets/server.crt \
        -subj '/CN=kevinalthaus.com' 2>/dev/null" \
        "Generating SSL certificates"

    # Set proper permissions
    ssh_exec "chmod 600 $APP_DIR/secrets/*" "Setting secrets permissions"

    log "Secrets generated ✓"
}

# Build and deploy Docker containers
deploy_containers() {
    step "Deploying Docker containers..."

    local BUILD_FLAG=""
    if [ "$FORCE_REBUILD" = true ]; then
        BUILD_FLAG="--build"
        log "Force rebuild enabled"
    fi

    # Build shared package first (required for Docker build)
    log "Building shared package..."
    ssh_exec "cd $APP_DIR/packages/shared && npm install && npm run build" \
        "Building shared package"

    # Stop existing containers
    log "Stopping existing containers..."
    ssh_exec "cd $APP_DIR && docker-compose -f $COMPOSE_FILE -f $COMPOSE_PROD_FILE down" \
        "Stopping containers"

    # Pull latest images
    log "Pulling latest Docker images..."
    ssh_exec "cd $APP_DIR && docker-compose -f $COMPOSE_FILE -f $COMPOSE_PROD_FILE pull" \
        "Pulling images"

    # Start containers
    log "Starting containers..."
    ssh_exec "cd $APP_DIR && docker-compose -f $COMPOSE_FILE -f $COMPOSE_PROD_FILE up -d $BUILD_FLAG" \
        "Starting containers"

    # Wait for services to be healthy
    log "Waiting for services to start..."
    sleep 10
}

# Verify deployment health
verify_deployment() {
    step "Verifying deployment..."

    # Check container status
    log "Checking container status..."
    CONTAINER_STATUS=$(ssh_output "cd $APP_DIR && docker-compose -f $COMPOSE_FILE -f $COMPOSE_PROD_FILE ps")
    echo "$CONTAINER_STATUS"

    # Check for unhealthy containers
    if echo "$CONTAINER_STATUS" | grep -q "unhealthy\|Exit"; then
        error "Some containers are unhealthy or exited"
    fi

    # Test database connection
    log "Testing database connection..."
    if ssh_output "cd $APP_DIR && docker-compose -f $COMPOSE_FILE -f $COMPOSE_PROD_FILE exec -T postgres pg_isready" &> /dev/null; then
        log "Database is ready ✓"
    else
        warn "Database health check failed"
    fi

    # Test API Gateway
    log "Testing API Gateway..."
    if ssh_output "curl -f http://localhost:4000/health" &> /dev/null; then
        log "API Gateway is healthy ✓"
    else
        warn "API Gateway health check failed"
    fi

    log "Deployment verification complete ✓"
}

# Rollback deployment
rollback_deployment() {
    error "Deployment failed!"
    echo

    if [ "$NON_INTERACTIVE" = true ]; then
        warn "Non-interactive mode: Skipping rollback (requires manual intervention)"
        exit 1
    fi

    read -p "Rollback to previous version? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Rolling back..."
        ssh_exec "cd $APP_DIR && git reset --hard HEAD~1" "Reverting Git commit"
        ssh_exec "cd $APP_DIR && docker-compose -f $COMPOSE_FILE -f $COMPOSE_PROD_FILE up -d" \
            "Restarting containers"
        warn "Rolled back to previous version"
    fi

    exit 1
}

# Show deployment summary
show_summary() {
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "DEPLOYMENT SUMMARY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    log "Server: kevinalthaus.com (${PROD_HOST})"
    log "Branch: $BRANCH"
    log "Commit: $COMMIT_HASH"
    log "Message: $COMMIT_MSG"
    echo
    log "Services:"
    echo "  • API Gateway: http://kevinalthaus.com:4000"
    echo "  • Frontend: http://kevinalthaus.com:3002"
    echo "  • Admin: http://kevinalthaus.com:3003"
    echo
    log "Useful commands:"
    echo "  • View logs: ssh $PROD_HOST 'cd $APP_DIR && docker-compose logs -f'"
    echo "  • Check status: ssh $PROD_HOST 'cd $APP_DIR && docker-compose ps'"
    echo "  • Restart services: ssh $PROD_HOST 'cd $APP_DIR && docker-compose restart'"
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
}

# Main deployment flow
main() {
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Production Deployment Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo

    # Pre-flight checks
    if [ "$SKIP_CHECKS" = false ]; then
        warn "This will deploy to PRODUCTION server: kevinalthaus.com"
        echo
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Deployment cancelled"
            exit 0
        fi
    fi

    # Execute deployment steps
    check_ssh_connection
    setup_server
    setup_git_repo
    git_pull || rollback_deployment
    setup_environment
    deploy_containers || rollback_deployment
    verify_deployment || rollback_deployment

    # Success
    show_summary
    log "Deployment completed successfully! ✓"
    echo
}

# Trap errors
trap rollback_deployment ERR

# Run main function
main "$@"
