# Deployment Scripts Documentation

## Overview

This directory contains automated SSH-based deployment scripts for deploying to the production server at kevinalthaus.com.

## Production Server Details

- **Server**: kevinalthaus.com (65.181.112.77)
- **Username**: kevin
- **SSH Password**: Server login password - Used once for SSH key setup (typically the same value as PROD_SUDO_PASSWORD)
- **Sudo Password**: Read from PROD_SUDO_PASSWORD environment variable by deployment scripts

## Deployment Scripts

### 1. setup-ssh-keys.sh

**Purpose**: One-time SSH key setup for passwordless authentication

**Usage**:
```bash
./scripts/setup-ssh-keys.sh
```

**What it does**:
1. Generates ED25519 SSH key pair at `~/.ssh/id_kevin_prod`
2. Copies public key to production server (requires password once)
3. Tests SSH connection
4. Configures SSH config file for easy access (`ssh kevin-prod`)
5. Displays security recommendations

**When to run**:
- First time setting up deployment
- If SSH keys are lost or corrupted
- When setting up a new development machine

**Output**:
- SSH key pair: `~/.ssh/id_kevin_prod` (private), `~/.ssh/id_kevin_prod.pub` (public)
- SSH config entry: `~/.ssh/config` (adds `kevin-prod` alias)

---

### 2. deploy-to-prod.sh

**Purpose**: Main automated deployment script

**Usage**:
```bash
# Standard deployment
./scripts/deploy-to-prod.sh

# Force rebuild Docker containers
./scripts/deploy-to-prod.sh --force-rebuild

# Skip confirmation prompts (for CI/CD)
./scripts/deploy-to-prod.sh --skip-checks
```

**What it does**:
1. Verifies SSH connection to production server
2. Installs prerequisites (Git, Docker, Docker Compose) if needed
3. Clones or updates Git repository at `/opt/kevinalthaus`
4. Pulls latest code from Git
5. Copies `.env.production` to server
6. Generates secrets (PostgreSQL password, SSL certificates)
7. Builds and starts Docker containers
8. Verifies deployment health

**Prerequisites**:
- SSH keys set up (run `setup-ssh-keys.sh` first)
- `.env.production` file created and configured
- Git repository URL updated in script (line 20)

**Sudo Operations** (handled automatically with password):
- `apt update && apt install` - Installing packages
- `systemctl enable/start` - Managing services
- `mkdir -p /opt/kevinalthaus` - Creating directories
- `usermod -aG docker kevin` - Adding user to groups

**Configuration**:
- Line 18: Reads sudo password from `PROD_SUDO_PASSWORD` environment variable
- Line 20: `REPO_URL="git@github.com:..."` - Your Git repository URL

---

### 3. test-ssh-connection.sh

**Purpose**: Test and verify SSH connection to production server

**Usage**:
```bash
./scripts/test-ssh-connection.sh
```

**What it does**:
1. Checks if SSH key exists
2. Tests network connectivity to server
3. Verifies SSH port is open
4. Checks authentication methods
5. Tests key-based authentication
6. Offers to copy public key if not set up
7. Verifies passwordless connection works

**When to run**:
- Before first deployment
- To troubleshoot SSH connection issues
- To verify SSH setup is working

---

## Deployment Workflow

### First-Time Setup (3 steps)

```bash
# Step 1: Setup SSH keys (1-2 minutes)
export PROD_SUDO_PASSWORD="your_sudo_password"
./scripts/setup-ssh-keys.sh
# Enter your SSH password when prompted (typically the same as PROD_SUDO_PASSWORD)

# Step 2: Create production environment file (30 seconds)
cp .env.example .env.production
# Edit .env.production with production values

# Step 3: Deploy (5-10 minutes)
./scripts/deploy-to-prod.sh
```

### Subsequent Deployments

```bash
# Pull latest code and redeploy (2-3 minutes)
./scripts/deploy-to-prod.sh
```

## Password and Authentication

### SSH Password vs Sudo Password

| Type | Value | When Used | How Used | Source |
|------|-------|-----------|----------|--------|
| SSH Password | Server login password | Once (SSH key setup) | Manual entry at prompt | User types password when prompted |
| Sudo Password | Server sudo password | Only during initial infrastructure setup | Automatic (piped to sudo) | Read from $PROD_SUDO_PASSWORD env var |
| SSH Key | Auto-generated | Every connection | Automatic | ~/.ssh/id_kevin_prod |

**Important**: `PROD_SUDO_PASSWORD` is **only required for initial infrastructure setup** (installing Git, Docker, Docker Compose, and creating application directories). Once the infrastructure is set up, subsequent application deployments (`git pull`, `docker-compose up`, etc.) run without sudo and do not require `PROD_SUDO_PASSWORD`.

**When sudo is used**:
- Initial setup: `apt install`, `systemctl enable/start`, `usermod -aG docker`, `mkdir -p /opt/kevinalthaus`
- After setup: All deployment operations (Git, Docker) run as the `kevin` user without sudo

**Note**: For convenience, operators typically set `PROD_SUDO_PASSWORD` to the same value as the server's sudo password. The deployment scripts read the sudo password from the `$PROD_SUDO_PASSWORD` environment variable and pipe it to `sudo -S` commands automatically during infrastructure setup.

### How Authentication Works

```
Development Machine                Production Server
       │                                  │
       │  1. SSH Key Setup                │
       ├──────────────────────────────────>
       │  Enter password: [SSH_SETUP_PASSWORD]│
       │  (copies public key)             │
       │                                  │
       │  2. SSH Connection               │
       ├──────────────────────────────────>
       │  Uses SSH key (no password)      │
       │                                  │
       │  3. Sudo Command                 │
       ├──────────────────────────────────>
       │  echo '$PROD_SUDO_PASSWORD' | sudo -S ...│
       │  (password piped automatically)  │
```

### SSH Helper Functions in deploy-to-prod.sh

**ssh_exec()** - Execute command without sudo
```bash
ssh_exec "cd /opt/kevinalthaus && git pull" "Pulling latest code"
```

**ssh_sudo()** - Execute command with sudo (password automatic)
```bash
ssh_sudo "apt update && apt install -y git" "Installing Git"
```

**ssh_output()** - Execute command and return output
```bash
RESULT=$(ssh_output "docker ps")
```

## What Requires Sudo

### Requires Sudo (password needed)

✅ Installing system packages
```bash
ssh_sudo "apt update && apt install -y docker.io"
```

✅ Managing systemd services
```bash
ssh_sudo "systemctl enable docker && systemctl start docker"
```

✅ Creating system directories
```bash
ssh_sudo "mkdir -p /opt/kevinalthaus"
```

✅ User/group management
```bash
ssh_sudo "usermod -aG docker kevin"
```

### Does NOT Require Sudo

❌ Docker commands (after user added to docker group)
```bash
ssh_exec "docker ps"
ssh_exec "docker-compose up -d"
```

❌ Git operations
```bash
ssh_exec "cd /opt/kevinalthaus && git pull"
```

❌ Application file operations
```bash
ssh_exec "cd /opt/kevinalthaus && npm install"
```

## Configuration Files

### scripts/deploy-to-prod.sh

Key configuration variables:

```bash
PROD_HOST="kevin-prod"              # SSH config alias
PROD_USER="kevin"                   # Server username
# Sudo password read from PROD_SUDO_PASSWORD environment variable
APP_DIR="/opt/kevinalthaus"         # Application directory
REPO_URL="git@github.com:..."       # Git repository URL
BRANCH="main"                       # Git branch to deploy
```

### .env.production (not committed)

Required secrets:

```bash
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<generate-with-openssl>
SESSION_SECRET=<generate-with-openssl>
ENCRYPTION_KEY=<generate-with-openssl>
PLUGIN_SIGNATURE_SECRET=<generate-with-openssl>
ADMIN_PASSWORD=<admin-password>
```

Generate secrets:
```bash
openssl rand -base64 32  # Run for each secret
```

## Troubleshooting

### SSH Connection Fails

```bash
# Test connection manually
ssh kevin@65.181.112.77

# Check if key exists
ls -la ~/.ssh/id_kevin_prod*

# Re-run setup
./scripts/setup-ssh-keys.sh

# Test with verbose output
ssh -v kevin@65.181.112.77
```

### Sudo Password Doesn't Work

```bash
# Test manually
ssh kevin@65.181.112.77
sudo echo "test"
# Enter: your_sudo_password

# Check if user is in sudo group
ssh kevin@65.181.112.77 groups
# Should include: sudo or wheel
```

### Git Clone/Pull Fails

```bash
# For private repositories, setup deploy key
ssh kevin@65.181.112.77
ssh-keygen -t ed25519 -C "deploy@kevinalthaus.com" -f ~/.ssh/id_deploy
cat ~/.ssh/id_deploy.pub
# Add to GitHub/GitLab as deploy key

# Configure Git to use it
git config --global core.sshCommand "ssh -i ~/.ssh/id_deploy"
```

### Docker Commands Need Sudo

```bash
# User needs to logout/login after being added to docker group
ssh kevin@65.181.112.77
exit
ssh kevin@65.181.112.77
docker ps  # Should work now
```

### Deployment Fails Mid-Way

The script includes automatic rollback:

```bash
# If deployment fails, it will:
# 1. Ask if you want to rollback
# 2. Revert git commit: git reset --hard HEAD~1
# 3. Restart previous version

# Manual rollback:
ssh kevin@65.181.112.77
cd /opt/kevinalthaus
git reset --hard HEAD~1
docker-compose restart
```

## Security Considerations

### Current Setup

✅ SSH password used only once
✅ SSH key-based authentication for connections
✅ Sudo password transmitted over encrypted SSH
✅ Private keys protected in `.gitignore`
✅ Password not logged or exposed in errors

### Recommended Improvements

After initial infrastructure setup (once Docker, Git, and application directories are configured), consider:

**1. Unset the PROD_SUDO_PASSWORD environment variable** (safe after infrastructure is complete):
```bash
# After the first successful deployment that completes setup_server(),
# you can safely unset this variable since subsequent deployments don't need sudo
unset PROD_SUDO_PASSWORD

# Or remove it from your shell profile (~/.bashrc, ~/.zshrc, etc.)
# Remove or comment out the line: export PROD_SUDO_PASSWORD="..."
```

**When is it safe to unset?**
- ✅ Safe after: First deployment completes successfully and shows "✓ Docker is already installed", "✓ Git is already installed", "✓ Application directory exists"
- ❌ Not safe: If you plan to re-run infrastructure setup or need to install new system packages
- 💡 Alternative: Store in CI/CD secret store and inject only when needed for infrastructure changes

**2. Configure passwordless sudo** for specific commands:
```bash
ssh kevin@65.181.112.77
sudo visudo -f /etc/sudoers.d/kevin-automation

# Add:
kevin ALL=(ALL) NOPASSWD: /usr/bin/apt update
kevin ALL=(ALL) NOPASSWD: /usr/bin/apt install
kevin ALL=(ALL) NOPASSWD: /usr/bin/systemctl *
kevin ALL=(ALL) NOPASSWD: /usr/bin/docker *
```

**3. Disable SSH password authentication**:
```bash
ssh kevin@65.181.112.77
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

**4. Configure firewall**:
```bash
ssh kevin@65.181.112.77
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## Post-Deployment Commands

### Check Status

```bash
# Container status
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose ps"

# View logs
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose logs -f"

# Follow specific service
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose logs -f api-gateway"
```

### Manage Services

```bash
# Restart all services
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose restart"

# Restart specific service
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose restart api-gateway"

# Stop services
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose down"

# Start services
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose up -d"
```

### Database Operations

```bash
# Check database health
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose exec postgres pg_isready"

# Access database
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose exec postgres psql -U postgres -d kevinalthaus"

# Backup database
ssh kevin-prod "cd /opt/kevinalthaus && ./scripts/backup-postgres.sh"

# View backups
ssh kevin-prod "ls -lh /opt/kevinalthaus/backups/"
```

## Related Documentation

- **`.claude/CLAUDE.md`** - Main Claude Code configuration (includes deployment section)
- **`docs/deployment.md`** - Full deployment documentation
- **`SSH-SETUP-INSTRUCTIONS.md`** - Step-by-step SSH setup guide
- **`DEPLOYMENT-READY-CHECKLIST.md`** - Complete deployment checklist
- **`SUDO-PASSWORD-SETUP.md`** - Technical implementation details
- **`CREDENTIALS.md`** - Password documentation (gitignored)

## Quick Reference

```bash
# Setup (once)
./scripts/setup-ssh-keys.sh

# Test connection
./scripts/test-ssh-connection.sh

# Deploy
./scripts/deploy-to-prod.sh

# Deploy with rebuild
./scripts/deploy-to-prod.sh --force-rebuild

# Connect to server
ssh kevin-prod

# Check deployment
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose ps"

# View logs
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose logs -f"

# Restart services
ssh kevin-prod "cd /opt/kevinalthaus && docker-compose restart"
```

## Files Created by Scripts

### Local (development machine)
- `~/.ssh/id_kevin_prod` - SSH private key (protected)
- `~/.ssh/id_kevin_prod.pub` - SSH public key
- `~/.ssh/config` - SSH configuration (kevin-prod alias)
- `.env.production` - Production environment variables

### Remote (production server)
- `~/.ssh/authorized_keys` - Contains public key
- `/opt/kevinalthaus/` - Application directory
- `/opt/kevinalthaus/.env` - Environment variables (from .env.production)
- `/opt/kevinalthaus/secrets/` - Generated secrets
  - `postgres_password.txt` - PostgreSQL password
  - `server.crt` - SSL certificate
  - `server.key` - SSL private key

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review related documentation
3. Test SSH connection with `./scripts/test-ssh-connection.sh`
4. Check deployment logs: `ssh kevin-prod "cd /opt/kevinalthaus && docker-compose logs"`

---

**Last Updated**: 2025-11-14
**Scripts Version**: 1.0.0
