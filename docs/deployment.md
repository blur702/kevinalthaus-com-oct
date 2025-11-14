# Deployment

## Server Requirements

- Ubuntu 20.04/22.04/24.04 LTS
- Docker Engine 20.10+, Docker Compose v2
- 4GB RAM (8GB recommended), 50GB+ disk
- fail2ban for SSH protection
- UFW firewall

## Phased Deployment Approach

The production deployment process is divided into three phases:

1. **Phase 1: Initial Server Infrastructure Setup** - Install system packages, Docker, security tools
2. **Phase 2: Application Deployment** - Deploy application code and containers
3. **Phase 3: Production Hardening** - SSL certificates, backups, monitoring

This guide covers all three phases with automated scripts for each step.

## Phase 1: Initial Server Infrastructure Setup

Phase 1 establishes the foundational infrastructure required for the application. This includes system packages, Docker, firewall configuration, and security tools.

### What Phase 1 Installs

- **System Packages**: curl, git, openssl
- **Container Runtime**: Docker Engine, Docker Compose v2
- **Security**: UFW firewall, fail2ban SSH protection
- **Directory Structure**: Application and backup directories
- **Log Rotation**: Automated log management

### Running Phase 1 Setup

Use the automated wrapper script to execute Phase 1 setup on the remote server:

```bash
# From your development machine
cd /path/to/kevinalthaus-com-oct

# Run Phase 1 setup (requires SSH keys configured)
./scripts/setup-server-infrastructure.sh

# Or preview changes without executing
./scripts/setup-server-infrastructure.sh --dry-run
```

The script will:
1. Verify SSH connectivity to production server
2. Copy `deploy-ubuntu.sh` to the server
3. Execute deployment with sudo privileges
4. Run verification checks
5. Save verification results locally

**Prerequisites**:
- SSH keys must be configured (run `./scripts/setup-ssh-keys.sh` first)
- Development machine must have SSH client and bash

### fail2ban Configuration

Phase 1 configures fail2ban to protect SSH access with the following default settings:

- **Service**: SSH (port 22)
- **Max Retries**: 5 failed attempts
- **Find Time**: 10 minutes
- **Ban Time**: 10 minutes

After 5 failed SSH login attempts within 10 minutes, the source IP will be banned for 10 minutes.

**Checking fail2ban status**:
```bash
# View SSH jail status
ssh kevin-prod "sudo fail2ban-client status sshd"

# List currently banned IPs
ssh kevin-prod "sudo fail2ban-client status sshd | grep 'Banned IP'"

# Unban a specific IP
ssh kevin-prod "sudo fail2ban-client set sshd unbanip <IP_ADDRESS>"
```

### Verification

After Phase 1 completes, verify all components are properly installed:

```bash
# Run verification on remote server
ssh kevin-prod "./scripts/verify-system-setup.sh"

# Get JSON output for automation
ssh kevin-prod "./scripts/verify-system-setup.sh --json"
```

The verification script checks:
- Docker Engine and Docker Compose v2 versions
- System utilities (curl, git, openssl)
- UFW firewall status and rules
- fail2ban service status and SSH jail
- Directory permissions and ownership

### Troubleshooting Phase 1

**SSH connection fails**:
```bash
# Test connection manually
ssh kevin@kevinalthaus.com

# Re-run SSH setup if needed
./scripts/setup-ssh-keys.sh
```

**Sudo password authentication fails**:
```bash
# Verify password is correct in scripts/setup-server-infrastructure.sh
# Password should be: (130Bpm)

# Test sudo access manually
ssh kevin@kevinalthaus.com
sudo echo "test"
```

**Docker installation fails**:
```bash
# Check logs on server
ssh kevin-prod "journalctl -xeu docker"

# Verify GPG key fingerprint
# Expected: 9DC858229FC7DD38854AE2D88D81803C0EBFCD88

# Manual installation if needed
ssh kevin-prod
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**UFW configuration conflicts**:
```bash
# Check current UFW status
ssh kevin-prod "sudo ufw status verbose"

# Reset UFW if needed (WARNING: This will disconnect SSH if not careful!)
# Only run if you have console access to the server
ssh kevin-prod "sudo ufw --force reset"
ssh kevin-prod "sudo ufw allow ssh && sudo ufw --force enable"
```

**fail2ban not starting**:
```bash
# Check fail2ban logs
ssh kevin-prod "sudo journalctl -xeu fail2ban"

# Verify configuration
ssh kevin-prod "sudo fail2ban-client -d"

# Restart fail2ban
ssh kevin-prod "sudo systemctl restart fail2ban"
```

### Post-Phase 1 Checklist

After Phase 1 completes successfully, verify:

- [ ] Docker Engine is running: `docker ps` works without sudo
- [ ] Docker Compose v2 is available: `docker compose version`
- [ ] UFW is active with SSH, HTTP, HTTPS rules
- [ ] fail2ban is active and monitoring SSH
- [ ] Application directory exists at `/opt/kevinalthaus`
- [ ] All system components verified successfully

See `docs/server-infrastructure.md` for detailed infrastructure documentation.

## Quick Start (Ubuntu)

```bash
git clone https://github.com/blur702/kevinalthaus-com-oct.git
cd kevinalthaus-com-oct
sudo ./scripts/deploy-ubuntu.sh

# Configure environment
sudo nano /opt/kevinalthaus/.env

# Restart services
cd /opt/kevinalthaus
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

# Setup automated backups
sudo ./scripts/setup-cron.sh
```

## Automated SSH Deployment

For automated deployments from your development machine to production, use the SSH deployment scripts.

### Prerequisites

Before running automated deployments:

1. **Development machine requirements**:
   - SSH client installed (OpenSSH on Windows/Linux/macOS)
   - Git configured with SSH access to your repository
   - Bash shell (Git Bash on Windows, native on Linux/macOS)

2. **Production server access**:
   - Server: `kevinalthaus.com` (IP: 65.181.112.77)
   - Username: `kevin`
   - Initial password: `(130Bpm)` (only used once for SSH key setup)

3. **Repository SSH access**:
   - Set up a deploy key on GitHub/GitLab for the production server
   - Or configure the production server's SSH key in your Git provider

### First-Time Setup

Run the SSH key setup script once to establish passwordless authentication:

```bash
# From your development machine
cd /path/to/kevinalthaus-com-oct
./scripts/setup-ssh-keys.sh
```

This script will:
1. Generate an ED25519 SSH key pair (`~/.ssh/id_kevin_prod`)
2. Copy the public key to the production server (requires password once)
3. Test the SSH connection
4. Configure SSH config file for easy access (`ssh kevin-prod`)

**Security Notes:**
- The temporary password `(130Bpm)` is only used during initial setup
- After setup, all connections use SSH keys (no password needed)
- Private key is stored at `~/.ssh/id_kevin_prod` (keep secure, never commit)
- Consider adding a passphrase to the key: `ssh-keygen -p -f ~/.ssh/id_kevin_prod`

### Deploying to Production

After SSH keys are set up, deploy with:

```bash
# Standard deployment
./scripts/deploy-to-prod.sh

# Force rebuild Docker containers
./scripts/deploy-to-prod.sh --force-rebuild

# Skip confirmation prompts
./scripts/deploy-to-prod.sh --skip-checks
```

The deployment script will:

1. **Verify SSH connection** to production server
2. **Setup server prerequisites** (Git, Docker, Docker Compose) if needed
3. **Clone or update repository** at `/opt/kevinalthaus`
4. **Pull latest code** from the `main` branch
5. **Configure environment** (copy `.env.production` to server)
6. **Generate secrets** (if not already present)
7. **Build and deploy** Docker containers
8. **Verify deployment** health checks

### Git Repository Configuration

Update the repository URL in `scripts/deploy-to-prod.sh`:

```bash
REPO_URL="git@github.com:yourusername/kevinalthaus-com-oct.git"
```

**For private repositories:**

Option 1 - Deploy key (recommended):
1. Generate a deploy key on the production server:
   ```bash
   ssh kevin-prod
   ssh-keygen -t ed25519 -C "deploy@kevinalthaus.com" -f ~/.ssh/id_deploy
   cat ~/.ssh/id_deploy.pub
   ```
2. Add the public key as a deploy key in your GitHub/GitLab repository settings
3. Configure Git to use the key:
   ```bash
   ssh kevin-prod
   git config --global core.sshCommand "ssh -i ~/.ssh/id_deploy"
   ```

Option 2 - HTTPS with credentials:
- Use HTTPS URL in the deployment script
- Configure Git credential helper on the production server

### Environment Configuration

Before deploying, ensure you have `.env.production` in your local repository:

```bash
# Create from example
cp .env.example .env.production

# Edit with production values
nano .env.production
```

Required secrets in `.env.production`:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `PLUGIN_SIGNATURE_SECRET`
- `ADMIN_PASSWORD`

The deployment script will copy this file to the production server.

### Post-Deployment Verification

After deployment, verify services:

```bash
# Check container status
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose ps"

# View logs
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose logs -f"

# Test health endpoints
curl http://kevinalthaus.com:4000/health
```

### Troubleshooting SSH Deployment

**SSH connection fails:**
```bash
# Test connection manually
ssh kevin-prod

# If fails, re-run setup
./scripts/setup-ssh-keys.sh

# Verify SSH config
cat ~/.ssh/config | grep -A 5 "kevin-prod"
```

**Git pull fails (authentication):**
```bash
# Check deploy key on production server
ssh kevin-prod "ssh -T git@github.com"

# Verify Git remote URL
ssh kevin-prod "cd /opt/kevinalthaus && git remote -v"

# If using HTTPS, check credentials
ssh kevin-prod "git config --list | grep credential"
```

**Docker build fails:**
```bash
# Check build logs
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose logs --tail=100"

# Verify shared package built
ssh kevin-prod "ls -la /opt/kevinalthaus/packages/shared/dist"

# Manual build
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose build --no-cache"
```

**Port conflicts:**
```bash
# Check ports on production server
ssh kevin-prod "netstat -tulpn | grep -E ':(3000|3001|3002|3003|3004|4000|5432|8000)'"

# Kill conflicting processes
ssh kevin-prod "sudo lsof -ti:4000 | xargs kill -9"
```

### Rollback Deployment

If deployment fails or introduces issues:

```bash
# SSH to production server
ssh kevin-prod

# Navigate to app directory
cd /opt/kevinalthaus

# Revert to previous commit
git reset --hard HEAD~1

# Restart containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Or restore from backup
./scripts/restore-postgres.sh /backups/latest.sql
```

### Security Best Practices

1. **SSH Keys**:
   - Keep private key secure (`chmod 600 ~/.ssh/id_kevin_prod`)
   - Never commit private keys to version control
   - Rotate keys periodically
   - Add passphrase protection to keys

2. **Production Server**:
   - Disable password authentication after SSH key setup:
     ```bash
     ssh kevin-prod
     sudo nano /etc/ssh/sshd_config
     # Set: PasswordAuthentication no
     sudo systemctl restart sshd
     ```
   - Configure firewall (UFW):
     ```bash
     ssh kevin-prod
     sudo ufw allow 22/tcp   # SSH
     sudo ufw allow 80/tcp   # HTTP
     sudo ufw allow 443/tcp  # HTTPS
     sudo ufw enable
     ```

3. **Git Repository**:
   - Use deploy keys with read-only access
   - Don't use personal SSH keys on production server
   - Verify commits with GPG signatures

4. **Secrets Management**:
   - Never commit `.env.production` to Git
   - Use environment-specific secrets
   - Rotate secrets regularly
   - Store backups securely (encrypted)

### Continuous Deployment

For automated deployments on Git push, add a webhook:

1. **GitHub Actions** (example):
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to Production
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Deploy
           env:
             SSH_PRIVATE_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
           run: |
             mkdir -p ~/.ssh
             echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_deploy
             chmod 600 ~/.ssh/id_deploy
             ./scripts/deploy-to-prod.sh --skip-checks
   ```

2. **Git Hooks** (post-receive):
   ```bash
   # On production server: /opt/kevinalthaus/.git/hooks/post-receive
   #!/bin/bash
   cd /opt/kevinalthaus
   git pull origin main
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

## PostgreSQL

**Version**: PostgreSQL 16 (Alpine)

**⚠️ Important**: This project uses PostgreSQL 16, which is a major version upgrade from PostgreSQL 15. Before deploying or upgrading an existing installation, follow the upgrade checklist below.

Quick migration from Postgres 15 (single-node):

**Note:** Replace `<postgres-container>` with your actual container name. Find it with `docker compose ps` or `docker ps`.

```bash
# 1) Backup all DBs from the Postgres 15 container
docker exec <postgres-container> pg_dumpall -U postgres -f /backups/pre-upgrade.sql
docker cp <postgres-container>:/backups/pre-upgrade.sql ./pre-upgrade.sql

# 2) Stop services and remove old data volume (destructive)
docker compose down
docker volume rm kevinalthaus-com-oct_postgres_data

# 3) Bring up Postgres 16
docker compose up -d postgres

# 4) Restore backup into Postgres 16
docker cp ./pre-upgrade.sql <postgres-container>:/backups/pre-upgrade.sql
docker exec <postgres-container> psql -U postgres -f /backups/pre-upgrade.sql
```

### PostgreSQL 16 Upgrade Checklist

If upgrading from PostgreSQL 15 or earlier:

1. **Pre-Upgrade Steps**:
   - Take a full backup of your existing database: `./scripts/backup-postgres.sh`
   - Review [PostgreSQL 16 release notes](https://www.postgresql.org/docs/16/release-16.html) for breaking changes
   - Verify that all extensions used in this project are compatible with PostgreSQL 16

2. **Staging Environment Testing**:
   - Deploy PostgreSQL 16 to a staging environment first
   - Restore your production backup to staging
   - Run all database migrations against the staging database
   - Test all application features thoroughly
   - Verify query performance and check for any deprecated features in use

3. **Production Upgrade Path**:
   ```bash
   # 1. Stop all services
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down

   # 2. Backup existing data
   ./scripts/backup-postgres.sh

   # 3. If upgrading in-place, use pg_upgrade (recommended to test in staging first):
   #    See: https://www.postgresql.org/docs/16/pgupgrade.html

   # 4. Or, for a clean upgrade, restore backup to PostgreSQL 16:
   #    - Start new PostgreSQL 16 container with fresh volume
   #    - Restore backup using ./scripts/restore-postgres.sh

   # 5. Start services with PostgreSQL 16
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

   # 6. Run post-upgrade checks
   ./scripts/monitor-postgres.sh
   docker exec -it <postgres-container> psql -U postgres -d kevinalthaus -c "SELECT version();"
   ```

4. **Rollback Plan** (if issues occur):
   ```bash
   # 1. Stop services
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down

   # 2. Change docker-compose.yml image back to postgres:15-alpine

   # 3. Restore from backup taken before upgrade
   ./scripts/restore-postgres.sh <backup-file>

   # 4. Restart services
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

5. **Expected Downtime**:
   - Small databases (< 1GB): 5-15 minutes
   - Medium databases (1-10GB): 15-60 minutes
   - Large databases (> 10GB): Plan for several hours

### PostgreSQL Configuration

- SSL optional via `POSTGRES_USE_SSL`
- In dev, self-signed certs can be generated automatically when enabled
- Access: `docker exec -it <postgres-container> psql -U postgres -d kevinalthaus`

Connection string example:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres:5432/kevinalthaus
```

## Critical Secrets (set in .env)

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `PLUGIN_SIGNATURE_SECRET`, `ADMIN_PASSWORD`
- `COOKIE_SAMESITE` (lax/strict/none) — use `lax` unless you require cross-site cookies with HTTPS

## Backups

- Automated backups via `postgres-backup` service
- Manual backup: `./scripts/backup-postgres.sh`
- **⚠️ WARNING: DESTRUCTIVE OPERATION** — Restore: `./scripts/restore-postgres.sh <backup-file>`

  **CAUTION:** This command will **irreversibly overwrite the entire database** with the backup file contents. All existing data will be permanently replaced. Only run this after verifying your backups and ensuring you have a recent backup of the current database state if needed.

## Monitoring

- Health: `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps`
- Logs: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f`
- DB health: `./scripts/monitor-postgres.sh [--json]`

## Production Credentials

**Server**: kevinalthaus.com (65.181.112.77)
**Username**: kevin
**Password/Sudo**: (130Bpm)

### Authentication Methods

1. **SSH Key Authentication** (after initial setup)
   - Private key: `~/.ssh/id_kevin_prod`
   - No password required for SSH connections
   - Setup once with `./scripts/setup-ssh-keys.sh`

2. **Sudo Password** (for privileged operations)
   - Password: `(130Bpm)`
   - Configured in `scripts/deploy-to-prod.sh:18`
   - Used automatically by deployment script
   - Required for: package installation, service management, system directories

### What Requires Sudo

**Operations requiring sudo password**:
- Installing packages: `apt update && apt install`
- Managing services: `systemctl enable/start/restart`
- Creating system directories: `/opt/kevinalthaus`
- User management: `usermod -aG docker kevin`

**Operations NOT requiring sudo** (after initial setup):
- Docker commands (user added to docker group)
- Git operations (user-owned repository)
- File operations in `/opt/kevinalthaus`

### Security Notes

- SSH password `(130Bpm)` only used once for key setup
- Sudo password transmitted over encrypted SSH
- Private key protected in `.gitignore`
- All secrets excluded from version control

See `CREDENTIALS.md` for detailed password documentation.

## Production Notes

- Only API Gateway is publicly exposed
- Internal services (main-app, python) should not publish host ports
- Use strong secrets and configure firewall (UFW)
- SSH and sudo passwords documented in `.claude/CLAUDE.md` and `CREDENTIALS.md`
