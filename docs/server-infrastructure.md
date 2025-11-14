# Server Infrastructure Documentation

Complete documentation for the Kevin Althaus platform server infrastructure (Phase 1).

## Table of Contents

- [Overview](#overview)
- [System Requirements](#system-requirements)
- [Installed Components](#installed-components)
- [Firewall Configuration](#firewall-configuration)
- [fail2ban Configuration](#fail2ban-configuration)
- [Directory Structure](#directory-structure)
- [Log Rotation](#log-rotation)
- [Security Best Practices](#security-best-practices)
- [Verification Procedures](#verification-procedures)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Post-Setup Checklist](#post-setup-checklist)

## Overview

The server infrastructure for the Kevin Althaus platform is deployed in phases, with Phase 1 establishing the foundational components required for the application. This includes system packages, containerization tools, security services, and directory structures.

**Phase 1 Components**:
- Docker Engine and Docker Compose v2 for containerization
- System utilities: curl, git, openssl
- UFW firewall for network security
- fail2ban for SSH brute-force protection
- Structured directory hierarchy for application and backups
- Log rotation for automated log management

## System Requirements

### Operating System

- **Ubuntu 20.04 LTS** (Focal Fossa)
- **Ubuntu 22.04 LTS** (Jammy Jellyfish)
- **Ubuntu 24.04 LTS** (Noble Numbat)

### Hardware Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 50GB+ available
- **CPU**: 2+ cores recommended for production workloads
- **Network**: Public IP address with ports 22, 80, 443 accessible

### Network Requirements

- SSH access (port 22) for remote administration
- HTTP (port 80) and HTTPS (port 443) for web traffic
- Outbound internet access for package installation and updates

## Installed Components

### Docker Engine

**Purpose**: Container runtime for running application services in isolated environments.

**Version**: Latest stable from Docker CE repository
**Installation Source**: Official Docker APT repository
**GPG Key Fingerprint**: `9DC858229FC7DD38854AE2D88D81803C0EBFCD88`

**Key Features**:
- Container lifecycle management
- Image building and storage
- Network isolation
- Volume management for persistent data

**Verification**:
```bash
docker --version
docker ps
docker info
```

**Configuration Files**:
- `/etc/docker/daemon.json` - Docker daemon configuration
- `/lib/systemd/system/docker.service` - Systemd service unit

**Management Commands**:
```bash
# Check Docker status
sudo systemctl status docker

# View Docker logs
sudo journalctl -xeu docker

# Restart Docker
sudo systemctl restart docker
```

### Docker Compose v2

**Purpose**: Multi-container application orchestration and management.

**Version**: Latest v2.x from Docker Compose plugin
**Installation**: Installed as Docker plugin (`docker-compose-plugin`)

**Key Features**:
- YAML-based service definitions
- Multi-container orchestration
- Network and volume management
- Service scaling and health checks

**Verification**:
```bash
docker compose version
```

**Usage**:
```bash
# Start services
docker compose up -d

# View service status
docker compose ps

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### System Utilities

#### curl

**Purpose**: HTTP client for API requests, file downloads, and health checks.

**Installation**: System package manager (apt)

**Common Uses**:
- Downloading files and scripts
- Testing API endpoints
- Health check monitoring

**Verification**:
```bash
curl --version
curl -I http://localhost:4000/health
```

#### git

**Purpose**: Version control for application code deployment and updates.

**Installation**: System package manager (apt)

**Common Uses**:
- Cloning application repository
- Pulling latest code updates
- Managing deployment versions

**Verification**:
```bash
git --version
git config --list
```

**Configuration**:
```bash
# Set user information (for commits)
git config --global user.name "Deploy User"
git config --global user.email "deploy@kevinalthaus.com"
```

#### openssl

**Purpose**: SSL/TLS certificate generation, encryption, and security operations.

**Installation**: System package manager (apt)

**Common Uses**:
- Generating SSL certificates
- Creating secure random secrets
- Certificate verification

**Verification**:
```bash
openssl version
openssl rand -base64 32  # Generate random secret
```

## Firewall Configuration

### UFW (Uncomplicated Firewall)

**Purpose**: Simplified iptables management for network security.

**Default Policy**: Deny all incoming, allow all outgoing

**Configured Rules**:

| Port | Protocol | Service | Purpose |
|------|----------|---------|---------|
| 22 | TCP | SSH | Remote administration |
| 80 | TCP | HTTP | Web traffic (redirects to HTTPS) |
| 443 | TCP | HTTPS | Secure web traffic |

**Configuration**:
```bash
# View current rules
sudo ufw status verbose

# View numbered rules (for deletion)
sudo ufw status numbered

# Add new rule
sudo ufw allow 8080/tcp

# Delete rule by number
sudo ufw delete 3

# Reset firewall (WARNING: Requires console access!)
sudo ufw --force reset
```

**Important Notes**:
- UFW is configured to allow SSH before enabling to prevent lockout
- Always verify SSH rule before enabling firewall
- If locked out, console access required to reset firewall
- Rules persist across reboots

**Logs**:
```bash
# View UFW logs
sudo tail -f /var/log/ufw.log

# View denied connections
sudo grep 'UFW BLOCK' /var/log/ufw.log
```

## fail2ban Configuration

### Purpose

fail2ban monitors log files for failed authentication attempts and temporarily bans IP addresses that exceed the configured threshold. This protects against brute-force SSH attacks.

### SSH Jail Configuration

**Configuration File**: `/etc/fail2ban/jail.local`

**Settings**:
```ini
[sshd]
enabled = true          # Jail is active
port = ssh              # Monitor SSH port (22)
filter = sshd           # Use sshd filter rules
logpath = /var/log/auth.log  # Monitor authentication log
maxretry = 5            # Ban after 5 failed attempts
findtime = 10m          # Within 10 minute window
bantime = 10m           # Ban for 10 minutes
```

**How it Works**:
1. fail2ban monitors `/var/log/auth.log` for SSH authentication failures
2. If an IP has 5 failed attempts within 10 minutes, it's banned
3. Banned IPs cannot connect to SSH for 10 minutes
4. After 10 minutes, the ban is automatically lifted

### Management Commands

**Check fail2ban status**:
```bash
# Service status
sudo systemctl status fail2ban

# View all active jails
sudo fail2ban-client status

# View SSH jail details
sudo fail2ban-client status sshd
```

**View banned IPs**:
```bash
# List currently banned IPs for SSH jail
sudo fail2ban-client status sshd | grep "Banned IP"

# View ban history
sudo zgrep 'Ban' /var/log/fail2ban.log*
```

**Unban an IP address**:
```bash
# Unban specific IP from SSH jail
sudo fail2ban-client set sshd unbanip 192.168.1.100

# Unban from all jails
sudo fail2ban-client unban 192.168.1.100
```

**Restart fail2ban**:
```bash
# Restart service
sudo systemctl restart fail2ban

# Reload configuration without restarting
sudo fail2ban-client reload
```

### Whitelist Trusted IPs

To prevent legitimate IPs from being banned:

**Edit** `/etc/fail2ban/jail.local`:
```ini
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 192.168.1.0/24 203.0.113.50
```

**Reload configuration**:
```bash
sudo fail2ban-client reload
```

### Logs

**fail2ban logs**:
```bash
# View real-time logs
sudo tail -f /var/log/fail2ban.log

# View ban actions
sudo grep 'Ban' /var/log/fail2ban.log

# View unban actions
sudo grep 'Unban' /var/log/fail2ban.log
```

## Directory Structure

### Application Directory

**Path**: `/opt/kevinalthaus`
**Owner**: `root:root` (or `kevin:kevin` after application deployment)
**Permissions**: `755`

**Purpose**: Contains all application code, Docker configurations, and runtime files.

**Subdirectories**:
```
/opt/kevinalthaus/
├── packages/           # Application packages
├── plugins/            # Plugin system files
├── scripts/            # Utility scripts
├── docker-compose.yml  # Docker service definitions
├── docker-compose.prod.yml  # Production overrides
├── .env                # Environment configuration
├── secrets/            # Sensitive files (SSL certs, passwords)
└── logs/               # Application logs
```

### Backup Directory

**Path**: `/var/backups/kevinalthaus`
**Owner**: `root:root`
**Permissions**: `755`

**Purpose**: Stores automated PostgreSQL backups and system snapshots.

**Structure**:
```
/var/backups/kevinalthaus/
├── postgres/           # Database backups
│   ├── backup-20250114-120000.sql
│   └── backup-20250114-180000.sql
└── configs/            # Configuration backups
```

### Logs Directory

**Path**: `/opt/kevinalthaus/logs`
**Owner**: Application user
**Permissions**: `755`

**Purpose**: Centralized application logging with rotation.

**Log Files**:
```
/opt/kevinalthaus/logs/
├── api-gateway.log     # API Gateway logs
├── main-app.log        # Main application logs
├── plugin-engine.log   # Plugin system logs
└── python-service.log  # Python service logs
```

### Secrets Directory

**Path**: `/opt/kevinalthaus/secrets`
**Owner**: Application user
**Permissions**: `700` (directory), `600` (files)

**Purpose**: Secure storage for sensitive files.

**Contents**:
```
/opt/kevinalthaus/secrets/
├── postgres_password.txt  # PostgreSQL password
├── server.crt             # SSL certificate
└── server.key             # SSL private key
```

**Security**:
- Never commit secrets to version control
- Restrict permissions to owner only
- Rotate secrets regularly

## Log Rotation

### Configuration

**Configuration File**: `/etc/logrotate.d/kevinalthaus`

**Settings**:
```
/opt/kevinalthaus/logs/*.log {
    daily               # Rotate logs daily
    rotate 14           # Keep 14 days of logs
    compress            # Compress rotated logs
    delaycompress       # Compress after next rotation
    notifempty          # Don't rotate empty logs
    copytruncate        # Copy and truncate instead of move
    sharedscripts       # Run scripts once for all logs
}
```

**Rotation Schedule**:
- **Daily**: Logs rotate every day at midnight
- **Retention**: 14 days of history
- **Compression**: Rotated logs are gzipped (e.g., `api-gateway.log.1.gz`)

### Manual Rotation

```bash
# Force log rotation
sudo logrotate -f /etc/logrotate.d/kevinalthaus

# Test rotation (dry run)
sudo logrotate -d /etc/logrotate.d/kevinalthaus

# View rotation status
cat /var/lib/logrotate/status
```

### Viewing Rotated Logs

```bash
# View current log
tail -f /opt/kevinalthaus/logs/api-gateway.log

# View previous rotation
zcat /opt/kevinalthaus/logs/api-gateway.log.1.gz | less

# Search across rotated logs
zgrep "ERROR" /opt/kevinalthaus/logs/api-gateway.log*.gz
```

## Security Best Practices

### SSH Access

**1. Use SSH keys instead of passwords**:
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "admin@kevinalthaus.com"

# Copy to server
ssh-copy-id kevin@kevinalthaus.com

# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

**2. Change default SSH port** (optional):
```bash
sudo nano /etc/ssh/sshd_config
# Change: Port 2222
sudo ufw allow 2222/tcp
sudo ufw delete allow 22/tcp
sudo systemctl restart sshd
```

**3. Limit SSH access to specific users**:
```bash
sudo nano /etc/ssh/sshd_config
# Add: AllowUsers kevin admin
sudo systemctl restart sshd
```

### Firewall Management

**1. Review rules regularly**:
```bash
sudo ufw status numbered
```

**2. Remove unused rules**:
```bash
sudo ufw delete <rule_number>
```

**3. Enable logging**:
```bash
sudo ufw logging on
```

**4. Monitor denied connections**:
```bash
sudo tail -f /var/log/ufw.log | grep BLOCK
```

### fail2ban Monitoring

**1. Check for suspicious activity**:
```bash
# View recent bans
sudo fail2ban-client status sshd

# View ban history
sudo grep 'Ban' /var/log/fail2ban.log | tail -20
```

**2. Adjust thresholds if needed**:
```bash
# Edit configuration
sudo nano /etc/fail2ban/jail.local
# Adjust: maxretry, findtime, bantime

# Reload configuration
sudo fail2ban-client reload
```

**3. Set up email alerts** (optional):
```bash
# Install mail utilities
sudo apt-get install -y mailutils

# Edit jail.local
sudo nano /etc/fail2ban/jail.local
# Add under [DEFAULT]:
# destemail = admin@kevinalthaus.com
# sendername = fail2ban@kevinalthaus.com
# action = %(action_mwl)s

sudo fail2ban-client reload
```

### System Updates

**1. Regular updates**:
```bash
# Update package list
sudo apt-get update

# Upgrade packages
sudo apt-get upgrade -y

# Upgrade distribution (major updates)
sudo apt-get dist-upgrade -y
```

**2. Automatic security updates**:
```bash
# Install unattended-upgrades
sudo apt-get install -y unattended-upgrades

# Configure
sudo dpkg-reconfigure -plow unattended-upgrades
```

**3. Reboot if required**:
```bash
# Check if reboot needed
[ -f /var/run/reboot-required ] && echo "Reboot required"

# Schedule reboot
sudo shutdown -r +10 "System reboot in 10 minutes for updates"
```

## Verification Procedures

### System Component Verification

**Use the verification script**:
```bash
# Run verification
./scripts/verify-system-setup.sh

# JSON output for automation
./scripts/verify-system-setup.sh --json
```

**Manual verification**:
```bash
# Check Docker
docker --version
docker ps
sudo systemctl status docker

# Check Docker Compose
docker compose version

# Check utilities
curl --version
git --version
openssl version

# Check UFW
sudo ufw status verbose

# Check fail2ban
sudo systemctl status fail2ban
sudo fail2ban-client status sshd

# Check directories
ls -la /opt/kevinalthaus
ls -la /var/backups/kevinalthaus
```

### Service Health Checks

**Docker**:
```bash
# Verify Docker daemon is running
sudo systemctl is-active docker

# Check Docker info
docker info

# Test container execution
docker run --rm hello-world
```

**UFW**:
```bash
# Verify UFW is active
sudo ufw status | grep "Status: active"

# Verify rules are configured
sudo ufw status | grep -E "22|80|443"
```

**fail2ban**:
```bash
# Verify service is active
sudo systemctl is-active fail2ban

# Verify SSH jail is enabled
sudo fail2ban-client status | grep sshd

# Test ban functionality (be careful!)
# This will ban your own IP temporarily
# sudo fail2ban-client set sshd banip $(curl -s ifconfig.me)
# sudo fail2ban-client set sshd unbanip $(curl -s ifconfig.me)
```

### Network Verification

**Port accessibility**:
```bash
# From remote machine, test ports
nc -zv kevinalthaus.com 22
nc -zv kevinalthaus.com 80
nc -zv kevinalthaus.com 443

# Test from server
sudo netstat -tulpn | grep LISTEN
```

**Firewall rules**:
```bash
# View iptables rules (underlying UFW rules)
sudo iptables -L -n -v

# View UFW application profiles
sudo ufw app list
```

## Troubleshooting Guide

### Docker Issues

**Problem**: Docker daemon not starting

**Solution**:
```bash
# Check status
sudo systemctl status docker

# View logs
sudo journalctl -xeu docker

# Restart Docker
sudo systemctl restart docker

# Reset Docker (WARNING: Removes all containers/images)
sudo systemctl stop docker
sudo rm -rf /var/lib/docker
sudo systemctl start docker
```

**Problem**: Permission denied when running docker commands

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again
exit
ssh kevin@kevinalthaus.com

# Verify group membership
groups | grep docker
```

**Problem**: Docker Compose v2 not found

**Solution**:
```bash
# Verify plugin is installed
dpkg -l | grep docker-compose-plugin

# Reinstall if missing
sudo apt-get install -y docker-compose-plugin

# Verify installation
docker compose version
```

### UFW Issues

**Problem**: Locked out after enabling UFW

**Solution**:
- Requires console access to server (VPS control panel)
- Login via console
- Run: `sudo ufw disable`
- Add SSH rule: `sudo ufw allow 22/tcp`
- Re-enable: `sudo ufw enable`

**Prevention**:
- Always add SSH rule before enabling UFW
- Test SSH connection in new terminal before closing existing session
- Keep console access credentials available

**Problem**: UFW rules not working

**Solution**:
```bash
# Check UFW status
sudo ufw status verbose

# Reload UFW
sudo ufw reload

# Check iptables rules
sudo iptables -L -n -v

# Reset UFW (requires re-adding all rules)
sudo ufw --force reset
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### fail2ban Issues

**Problem**: fail2ban not starting

**Solution**:
```bash
# Check status
sudo systemctl status fail2ban

# View logs
sudo journalctl -xeu fail2ban

# Test configuration
sudo fail2ban-client -d

# Check jail configuration
sudo fail2ban-client -t

# Restart service
sudo systemctl restart fail2ban
```

**Problem**: Legitimate IP being banned

**Solution**:
```bash
# Unban IP immediately
sudo fail2ban-client set sshd unbanip <IP_ADDRESS>

# Add IP to whitelist
sudo nano /etc/fail2ban/jail.local
# Add to [DEFAULT]: ignoreip = <IP_ADDRESS>

# Reload configuration
sudo fail2ban-client reload
```

**Problem**: fail2ban not banning attackers

**Solution**:
```bash
# Verify SSH jail is enabled
sudo fail2ban-client status sshd

# Check log file path is correct
sudo nano /etc/fail2ban/jail.local
# Verify: logpath = /var/log/auth.log

# Test filter against logs
sudo fail2ban-regex /var/log/auth.log /etc/fail2ban/filter.d/sshd.conf

# Restart fail2ban
sudo systemctl restart fail2ban
```

### Directory Permission Issues

**Problem**: Cannot write to application directory

**Solution**:
```bash
# Check current permissions
ls -la /opt/kevinalthaus

# Set correct ownership (replace 'kevin' with actual user)
sudo chown -R kevin:kevin /opt/kevinalthaus

# Set correct permissions
sudo chmod 755 /opt/kevinalthaus
sudo chmod 755 /opt/kevinalthaus/logs
sudo chmod 700 /opt/kevinalthaus/secrets
sudo chmod 600 /opt/kevinalthaus/secrets/*
```

**Problem**: Log rotation failing

**Solution**:
```bash
# Check logrotate configuration
sudo logrotate -d /etc/logrotate.d/kevinalthaus

# Verify log file permissions
ls -la /opt/kevinalthaus/logs/

# Force rotation
sudo logrotate -f /etc/logrotate.d/kevinalthaus

# Check logrotate status
cat /var/lib/logrotate/status
```

## Post-Setup Checklist

After completing Phase 1 infrastructure setup, verify the following:

### System Components

- [ ] Docker Engine is installed and running
  ```bash
  docker --version && sudo systemctl is-active docker
  ```

- [ ] Docker Compose v2 is available
  ```bash
  docker compose version
  ```

- [ ] System utilities are installed
  ```bash
  curl --version && git --version && openssl version
  ```

### Security Services

- [ ] UFW firewall is active and configured
  ```bash
  sudo ufw status | grep -E "Status: active|22|80|443"
  ```

- [ ] fail2ban is running and monitoring SSH
  ```bash
  sudo systemctl is-active fail2ban && sudo fail2ban-client status sshd
  ```

- [ ] SSH jail is enabled in fail2ban
  ```bash
  sudo fail2ban-client status sshd | grep "Filter"
  ```

### Directories

- [ ] Application directory exists with correct permissions
  ```bash
  [ -d /opt/kevinalthaus ] && ls -la /opt/kevinalthaus
  ```

- [ ] Logs directory exists
  ```bash
  [ -d /opt/kevinalthaus/logs ] && ls -la /opt/kevinalthaus/logs
  ```

- [ ] Backup directory exists
  ```bash
  [ -d /var/backups/kevinalthaus ] && ls -la /var/backups/kevinalthaus
  ```

### Configuration

- [ ] Log rotation is configured
  ```bash
  [ -f /etc/logrotate.d/kevinalthaus ] && cat /etc/logrotate.d/kevinalthaus
  ```

- [ ] fail2ban jail configuration exists
  ```bash
  [ -f /etc/fail2ban/jail.local ] && cat /etc/fail2ban/jail.local
  ```

### Network

- [ ] Ports 22, 80, 443 are accessible from outside
  ```bash
  # Run from external machine
  nc -zv kevinalthaus.com 22 && nc -zv kevinalthaus.com 80 && nc -zv kevinalthaus.com 443
  ```

- [ ] SSH access works with SSH keys
  ```bash
  ssh kevin@kevinalthaus.com exit
  ```

### Next Steps

After completing this checklist:

1. **Proceed to Phase 2**: Application deployment
   ```bash
   ./scripts/deploy-to-prod.sh
   ```

2. **Setup automated backups**:
   ```bash
   ssh kevin-prod "cd /opt/kevinalthaus && ./scripts/setup-cron.sh"
   ```

3. **Configure SSL certificates**:
   - Install Certbot for Let's Encrypt
   - Or deploy custom SSL certificates

4. **Setup monitoring**:
   - Configure system monitoring (e.g., Prometheus, Grafana)
   - Setup log aggregation (e.g., ELK stack)
   - Configure alerts for critical events

---

**Related Documentation**:
- [Deployment Guide](./deployment.md) - Full deployment procedures
- [Security Guide](./security.md) - Security best practices
- [Getting Started](./getting-started.md) - Development setup

**Support**:
- For issues, check the troubleshooting guide above
- Review logs in `/var/log/` for system-level issues
- Check application logs in `/opt/kevinalthaus/logs/` for application issues
