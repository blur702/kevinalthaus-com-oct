# Documentation Index

## SSH Deployment & Credentials Documentation

This document provides an index of where SSH deployment and credential information is documented in the project.

## 📍 Where Credentials Are Documented

### Production Server Credentials

**Server**: kevinalthaus.com (65.181.112.77)
**Username**: kevin
**Password/Sudo**: [Stored in PROD_SUDO_PASSWORD environment variable or secure credentials management system]

### Documentation Locations

| Document | Location | Content |
|----------|----------|---------|
| **Claude Code Config** | `.claude/CLAUDE.md` | Main project configuration with SSH deployment section |
| **Deployment Guide** | `docs/deployment.md` | Full deployment documentation with credentials section |
| **Credentials Reference** | `CREDENTIALS.md` | Detailed password documentation (gitignored) |
| **SSH Setup Guide** | `SSH-SETUP-INSTRUCTIONS.md` | Step-by-step SSH setup instructions |
| **Deployment Checklist** | `DEPLOYMENT-READY-CHECKLIST.md` | Complete deployment checklist |
| **Sudo Setup Guide** | `SUDO-PASSWORD-SETUP.md` | Technical implementation of sudo password |
| **Scripts README** | `scripts/README-DEPLOYMENT.md` | Detailed script documentation |

## 📚 Documentation Hierarchy

### Primary Documentation

1. **`.claude/CLAUDE.md`** (lines 451-676)
   - Quick start deployment guide
   - SSH authentication overview
   - Sudo password configuration
   - Deployment commands
   - Security best practices
   - Troubleshooting guide

2. **`docs/deployment.md`** (lines 27-300, 416-462)
   - Automated SSH deployment section
   - Prerequisites and setup
   - Git repository configuration
   - Environment configuration
   - Production credentials section
   - Authentication methods
   - What requires sudo vs what doesn't

### Supporting Documentation

3. **`CREDENTIALS.md`** (gitignored)
   - SSH password: [PROD_SUDO_PASSWORD environment variable]
   - Sudo password: [PROD_SUDO_PASSWORD environment variable]
   - Password usage and security
   - After-deployment security improvements

4. **`SSH-SETUP-INSTRUCTIONS.md`**
   - Test results and verification
   - Three setup options
   - Security recommendations
   - Post-setup verification

5. **`DEPLOYMENT-READY-CHECKLIST.md`**
   - Current status summary
   - 3-step deployment process
   - Pre-deployment checklist
   - Troubleshooting guide

6. **`SUDO-PASSWORD-SETUP.md`**
   - Technical implementation details
   - `ssh_sudo()` function explanation
   - What requires sudo
   - Security considerations

7. **`scripts/README-DEPLOYMENT.md`**
   - Complete script documentation
   - Usage examples
   - Configuration details
   - Post-deployment commands

## 🔑 Credential Information Summary

### SSH Authentication

**Initial Setup**:
- Password: [PROD_SUDO_PASSWORD environment variable]
- Used once with `./scripts/setup-ssh-keys.sh`
- Creates SSH key pair at `~/.ssh/id_kevin_prod`

**After Setup**:
- No password needed for SSH connections
- Uses private key for authentication
- Connect with: `ssh kevin-prod`

### Sudo Authentication

**Configuration**:
- Password: [PROD_SUDO_PASSWORD environment variable]
- Configured in: `scripts/deploy-to-prod.sh:18`
- Used automatically by `ssh_sudo()` function

**Required For**:
- Installing packages: `apt update && apt install`
- Managing services: `systemctl enable/start/restart`
- Creating system directories: `/opt/kevinalthaus`
- User management: `usermod -aG docker kevin`

**NOT Required For** (after initial setup):
- Docker commands (user in docker group)
- Git operations (user-owned repository)
- Application files (in user directory)

## 📖 Quick Access Guide

### For Initial Setup

1. Read: **`DEPLOYMENT-READY-CHECKLIST.md`**
   - Complete 3-step setup process
   - Pre-deployment checklist
   - Quick reference commands

2. Follow: **`SSH-SETUP-INSTRUCTIONS.md`**
   - Setup SSH keys
   - Test connection
   - Verify passwordless access

### For Deployment

1. Reference: **`.claude/CLAUDE.md`** (SSH-Based Deployment section)
   - Quick start commands
   - Deployment workflow
   - Common tasks

2. Use: **`scripts/README-DEPLOYMENT.md`**
   - Script usage examples
   - Configuration details
   - Troubleshooting

### For Credentials

1. Check: **`CREDENTIALS.md`**
   - All passwords documented
   - Security considerations
   - Usage guidelines

2. Review: **`docs/deployment.md`** (Production Credentials section)
   - Authentication methods
   - What requires sudo
   - Security notes

### For Troubleshooting

1. See: **`.claude/CLAUDE.md`** (Troubleshooting section)
   - SSH connection issues
   - Sudo problems
   - Git/Docker issues

2. See: **`scripts/README-DEPLOYMENT.md`** (Troubleshooting section)
   - Detailed solutions
   - Manual fixes
   - Verification commands

## 🔍 Search Keywords

To find credential documentation, search for these terms:

- `PROD_SUDO_PASSWORD` - Sudo password environment variable
- `PROD_PASSWORD` - Sudo password variable
- `kevin-prod` - SSH config alias
- `ssh_sudo` - Sudo helper function
- `65.181.112.77` - Production server IP
- `kevinalthaus.com` - Production domain

## 📂 File Locations

### Configuration Files
```
.claude/
  └── CLAUDE.md                    # Main Claude Code config (includes deployment)

docs/
  └── deployment.md                # Full deployment guide (includes credentials)

scripts/
  ├── setup-ssh-keys.sh           # SSH key setup script
  ├── deploy-to-prod.sh           # Main deployment script (contains password)
  ├── test-ssh-connection.sh      # Connection test script
  └── README-DEPLOYMENT.md        # Script documentation
```

### Documentation Files
```
CREDENTIALS.md                     # Password reference (gitignored)
SSH-SETUP-INSTRUCTIONS.md         # SSH setup guide
DEPLOYMENT-READY-CHECKLIST.md     # Deployment checklist
SUDO-PASSWORD-SETUP.md            # Sudo implementation guide
DOCUMENTATION-INDEX.md            # This file
```

## 🔒 Security Notes

### Protected Files (in .gitignore)

These files contain credentials and are NOT committed:

- `CREDENTIALS.md` - Password documentation
- `.env.production` - Production environment variables
- `~/.ssh/id_kevin_prod` - SSH private key
- `~/.ssh/id_kevin_prod.pub` - SSH public key

### Public Files (safe to commit)

These files reference credentials but don't contain sensitive data:

- `.claude/CLAUDE.md` - Contains password in examples (for documentation)
- `docs/deployment.md` - Contains password in examples (for documentation)
- `scripts/deploy-to-prod.sh` - Contains password (for automation)
- All other documentation files

**Note**: While the password is documented in public files for ease of use during development, you should rotate it and remove from scripts before making the repository public.

## 🚀 Common Documentation Paths

### "How do I deploy?"
→ Read: `DEPLOYMENT-READY-CHECKLIST.md`
→ Run: `./scripts/deploy-to-prod.sh`

### "What's the sudo password?"
→ Check: `.claude/CLAUDE.md` line 459
→ Check: `CREDENTIALS.md`
→ Check: `scripts/deploy-to-prod.sh` line 18

### "How do I set up SSH?"
→ Read: `SSH-SETUP-INSTRUCTIONS.md`
→ Run: `./scripts/setup-ssh-keys.sh`

### "What requires sudo?"
→ See: `.claude/CLAUDE.md` lines 532-541
→ See: `docs/deployment.md` lines 435-446
→ See: `SUDO-PASSWORD-SETUP.md`

### "How do the scripts work?"
→ Read: `scripts/README-DEPLOYMENT.md`
→ Read: `SUDO-PASSWORD-SETUP.md`

### "What are all the passwords?"
→ Read: `CREDENTIALS.md` (complete reference)

## 📋 Documentation Checklist

When updating deployment/credential information, update these files:

- [ ] `.claude/CLAUDE.md` - Main configuration file
- [ ] `docs/deployment.md` - Deployment documentation
- [ ] `CREDENTIALS.md` - Credential reference (if password changes)
- [ ] `scripts/deploy-to-prod.sh` - If password changes (line 18)
- [ ] `SUDO-PASSWORD-SETUP.md` - If implementation changes
- [ ] `scripts/README-DEPLOYMENT.md` - If scripts change
- [ ] This file (`DOCUMENTATION-INDEX.md`) - If new docs added

## 🎯 Quick Reference

### Passwords
```bash
SSH Password: $PROD_SUDO_PASSWORD        # Used once for SSH key setup
Sudo Password: $PROD_SUDO_PASSWORD       # Used automatically in scripts
```

### Key Files
```bash
SSH Private Key: ~/.ssh/id_kevin_prod
SSH Public Key: ~/.ssh/id_kevin_prod.pub
SSH Config: ~/.ssh/config (kevin-prod alias)
Deploy Script: scripts/deploy-to-prod.sh (line 18 has password)
```

### Key Commands
```bash
Setup SSH: ./scripts/setup-ssh-keys.sh
Test SSH: ./scripts/test-ssh-connection.sh
Deploy: ./scripts/deploy-to-prod.sh
Connect: ssh kevin-prod
```

### Documentation
```bash
Main Guide: .claude/CLAUDE.md (lines 451-676)
Deploy Docs: docs/deployment.md (lines 27-300, 416-462)
Credentials: CREDENTIALS.md (gitignored)
Checklist: DEPLOYMENT-READY-CHECKLIST.md
Scripts: scripts/README-DEPLOYMENT.md
```

---

**Last Updated**: 2025-11-14

All credential and deployment information is now thoroughly documented across multiple files for redundancy and ease of access.
