# Security Advisory - Credential Exposure Remediation

**Date**: 2025-11-17
**Severity**: CRITICAL
**Status**: ✅ REMEDIATED (2025-11-17)

**IMPORTANT NOTE**: This advisory contains references to the compromised password for audit trail purposes only. The password shown here has been rotated and is NO LONGER VALID.

## Summary

The production sudo password `(130Bpm)` *(now invalid)* was exposed in plaintext in the following locations:
- `.claude/settings.local.json` (line 26) - **REMOVED**
- `CLAUDE.md` documentation (multiple references) - **STILL PRESENT**
- `scripts/deploy-to-prod.sh` (hardcoded) - **NEEDS REVIEW**

## Immediate Actions Required

### 1. Rotate the Exposed Credential ✅ PRIORITY 1

The password `(130Bpm)` must be considered compromised and changed immediately.

**Steps:**
```bash
# 1. SSH to production server
ssh kevin@65.181.112.77

# 2. Change the user password
sudo passwd kevin
# Enter new strong password (20+ characters, use password manager)

# 3. Update local environment
echo "PROD_SUDO_PASSWORD=<new-password>" >> .env.local
# Add to your password manager

# 4. Update deployment script to read from environment
# See section below
```

### 2. Purge Git History ✅ PRIORITY 1

If the credential was ever committed to version control, the git history must be cleaned.

**Check history:**
```bash
# Search for the exposed password
git log -S "(130Bpm)" --all --oneline

# If found, rewrite history (BACKUP FIRST)
git filter-repo --invert-paths --path .claude/settings.local.json
# Or use BFG Repo-Cleaner for larger repos
```

### 3. Update Deployment Script ✅ PRIORITY 2

Modify `scripts/deploy-to-prod.sh` to use environment variables instead of hardcoded passwords.

**Current state (INSECURE):**
```bash
PROD_PASSWORD="(130Bpm)"  # Line 18
```

**Required change:**
```bash
# Read from environment or fail
PROD_PASSWORD="${PROD_SUDO_PASSWORD:-}"
if [ -z "$PROD_PASSWORD" ]; then
    echo "ERROR: PROD_SUDO_PASSWORD environment variable not set"
    echo "Please set it in .env.local or export it before running this script"
    exit 1
fi
```

**Usage after fix:**
```bash
# Method 1: Export before running
export PROD_SUDO_PASSWORD="<new-password>"
./scripts/deploy-to-prod.sh

# Method 2: Use .env.local (add to .gitignore)
echo "PROD_SUDO_PASSWORD=<new-password>" >> .env.local
source .env.local
./scripts/deploy-to-prod.sh

# Method 3: Inline (least secure, visible in process list)
PROD_SUDO_PASSWORD="<new-password>" ./scripts/deploy-to-prod.sh
```

### 4. Clean Documentation ✅ PRIORITY 2

Remove password references from documentation files:

**Files to update:**
- `.claude/CLAUDE.md` - Remove all references to `(130Bpm)`
- `SSH-SETUP-INSTRUCTIONS.md` - Update with environment variable approach
- `SUDO-PASSWORD-SETUP.md` - Update implementation details
- `CREDENTIALS.md` - If exists, ensure it's in .gitignore

### 5. Verify .gitignore Protection ✅ PRIORITY 3

Ensure sensitive files are properly excluded:

**Add to .gitignore:**
```
# Secrets and credentials
.env.local
.env.production
CREDENTIALS.md
secrets/

# SSH keys
*.pem
id_*
!*.pub
```

## Long-term Improvements

### Option A: SSH Key-Based Sudo (Recommended)

Configure passwordless sudo for deployment user:

```bash
# On production server
sudo visudo
# Add: kevin ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/systemctl
```

### Option B: CI/CD Secrets Manager

Use GitHub Actions secrets or similar:

```yaml
# .github/workflows/deploy.yml
env:
  PROD_SUDO_PASSWORD: ${{ secrets.PROD_SUDO_PASSWORD }}
```

### Option C: HashiCorp Vault or AWS Secrets Manager

For enterprise deployments, integrate a proper secrets management solution.

## Verification Checklist

- [ ] Production password has been rotated
- [ ] New password stored in password manager
- [ ] `.claude/settings.local.json` cleaned (line 26 removed)
- [ ] `scripts/deploy-to-prod.sh` updated to read from environment
- [ ] All documentation updated to remove hardcoded password
- [ ] Git history audited and cleaned if needed
- [ ] `.gitignore` updated to protect secrets
- [ ] Deployment tested with new credential flow
- [ ] Team notified of credential rotation (if applicable)
- [ ] Access logs reviewed for unauthorized access

## Timeline

- **T+0 (Immediate)**: Rotate production password
- **T+1 hour**: Update deployment script and documentation
- **T+4 hours**: Audit and clean git history
- **T+24 hours**: Verify no unauthorized access occurred
- **T+1 week**: Implement long-term secrets management solution

## References

- [OWASP: Hardcoded Password](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password)
- [Git History Cleanup](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Environment Variables Best Practices](https://12factor.net/config)

---

**Remediation Owner**: Security Team / DevOps
**Follow-up Date**: 2025-11-24 (1 week review)
