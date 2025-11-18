# GitHub Secrets Setup Guide

This guide explains how to configure GitHub repository secrets for CI/CD workflows.

## Table of Contents

1. [Overview](#overview)
2. [Required Secrets](#required-secrets)
3. [Optional Secrets](#optional-secrets)
4. [Setup Methods](#setup-methods)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Overview

GitHub secrets are encrypted environment variables used in GitHub Actions workflows. This repository requires certain secrets to be configured for CI/CD pipelines to function properly.

**Security Note:** Secrets are encrypted and only exposed to GitHub Actions runners. They are never visible in logs or accessible to pull requests from forks.

---

## Required Secrets

These secrets **must** be configured for the E2E testing workflows to run successfully:

### 1. TEST_ADMIN_EMAIL

- **Description**: Admin user email/username for E2E tests
- **Used by**:
  - `.github/workflows/coderabbit.yml` (production tests)
  - `.github/workflows/e2e-tests.yml` (CI tests)
  - `tests/e2e/blog-csrf.spec.ts`
- **Example value**: `kevin` or `admin@example.com`
- **How to get**: Use your admin username or email configured in the application

### 2. TEST_ADMIN_PASSWORD

- **Description**: Admin user password for E2E tests
- **Used by**:
  - `.github/workflows/coderabbit.yml` (production tests)
  - `.github/workflows/e2e-tests.yml` (CI tests)
  - `tests/e2e/blog-csrf.spec.ts`
- **Example value**: Your secure admin password
- **Security**: Use a strong password. This can be different from production credentials.
- **How to get**: Set this to match the admin user password in your test/staging environment

---

## Optional Secrets

These secrets are optional. If not configured, related workflow steps will be skipped automatically:

### 3. CODERABBIT_TOKEN

- **Description**: API token for CodeRabbit AI code review service
- **Used by**: `.github/workflows/coderabbit.yml`
- **Required**: No - CodeRabbit review step will be skipped if not set
- **How to get**:
  1. Visit https://coderabbit.ai
  2. Sign up/login with your GitHub account
  3. Navigate to Settings → API Tokens
  4. Generate a new token
  5. Copy the token value

### 4. PROD_SSH_KEY

- **Description**: SSH private key for production server deployment
- **Used by**: `.github/workflows/deploy-production.yml`
- **Required**: No - Only needed for automated production deployments
- **How to get**:
  1. Generate SSH key pair: `ssh-keygen -t ed25519 -f ~/.ssh/id_prod`
  2. Copy public key to production server: `ssh-copy-id -i ~/.ssh/id_prod.pub user@server`
  3. Use the private key content (`~/.ssh/id_prod`) as the secret value

---

## Setup Methods

### Method 1: Automated Setup Script (Recommended)

We provide scripts to automate the setup process using GitHub CLI.

#### Prerequisites

Install GitHub CLI:
- **macOS**: `brew install gh`
- **Windows**: `winget install --id GitHub.cli`
- **Linux**: See https://github.com/cli/cli/blob/trunk/docs/install_linux.md

Authenticate with GitHub:
```bash
gh auth login
```

#### Run the Setup Script

**On macOS/Linux:**
```bash
cd scripts
chmod +x setup-github-secrets.sh
./setup-github-secrets.sh
```

**On Windows (PowerShell):**
```powershell
cd scripts
.\setup-github-secrets.ps1
```

The script will:
1. Check for GitHub CLI installation
2. Verify authentication
3. Prompt for each secret value
4. Set secrets in your GitHub repository
5. Display a summary of configured secrets

### Method 2: GitHub CLI Manual Commands

Set secrets individually using `gh` commands:

```bash
# Required secrets
echo "your_admin_email" | gh secret set TEST_ADMIN_EMAIL
echo "your_admin_password" | gh secret set TEST_ADMIN_PASSWORD

# Optional secrets
echo "your_coderabbit_token" | gh secret set CODERABBIT_TOKEN
cat ~/.ssh/id_prod | gh secret set PROD_SSH_KEY
```

### Method 3: GitHub Web UI

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name (e.g., `TEST_ADMIN_EMAIL`)
5. Enter the secret value
6. Click **Add secret**
7. Repeat for each required secret

**Direct link format:**
```
https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions
```

---

## Verification

### Check Configured Secrets

**Using GitHub CLI:**
```bash
gh secret list
```

**Using GitHub Web UI:**
1. Go to repository Settings → Secrets and variables → Actions
2. You should see all configured secrets listed
3. Note: Secret values are never displayed, only their names

### Test Workflows

After setting up secrets, trigger a workflow to verify:

**Trigger CodeRabbit workflow:**
```bash
# Create a test branch and push
git checkout -b test-secrets
git commit --allow-empty -m "test: verify GitHub secrets configuration"
git push -u origin test-secrets

# Create a pull request
gh pr create --title "Test: Verify Secrets" --body "Testing GitHub secrets configuration"
```

**Check workflow run:**
```bash
gh run list --workflow=coderabbit.yml
gh run view  # View latest run
```

### Expected Behavior

If secrets are configured correctly:
- ✅ E2E tests should run and authenticate successfully
- ✅ CodeRabbit review should post comments (if CODERABBIT_TOKEN is set)
- ✅ Production tests should run on main/master branches
- ✅ No authentication errors in workflow logs

If secrets are missing:
- ⚠️ CodeRabbit step will be skipped (workflow continues)
- ⚠️ Production tests will be skipped (workflow continues)
- ❌ E2E tests will fail with authentication error (required secrets missing)

---

## Troubleshooting

### Issue: "Error: TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables are required"

**Cause**: Required secrets are not configured in GitHub repository settings.

**Solution**:
1. Run the setup script: `./scripts/setup-github-secrets.sh`
2. Or manually add secrets via GitHub web UI
3. Verify secrets are set: `gh secret list`

### Issue: "CodeRabbit step is failing"

**Cause**: CODERABBIT_TOKEN is invalid or expired.

**Solution**:
1. Generate a new token from https://coderabbit.ai
2. Update the secret: `echo "new_token" | gh secret set CODERABBIT_TOKEN`
3. Or remove the secret if you don't want CodeRabbit: `gh secret remove CODERABBIT_TOKEN`

### Issue: "E2E tests fail with 401 Unauthorized"

**Cause**: TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD don't match the test environment credentials.

**Solution**:
1. Verify credentials work locally: `npm run test:e2e`
2. Check your local `.env` file for correct credentials
3. Update GitHub secrets to match: `./scripts/setup-github-secrets.sh`

### Issue: "Secret not found" error in workflow

**Cause**: Secret name is misspelled or doesn't exist.

**Solution**:
1. Check exact secret name in workflow file
2. Verify secret exists: `gh secret list`
3. Ensure secret name matches exactly (case-sensitive)

### Issue: "Permission denied" when setting secrets

**Cause**: GitHub CLI not authenticated or insufficient permissions.

**Solution**:
1. Authenticate: `gh auth login`
2. Select: "GitHub.com" → "HTTPS" → "Login with a web browser"
3. Grant necessary permissions (repo, workflow)
4. Verify: `gh auth status`

---

## Security Best Practices

1. **Never commit secrets to Git**
   - ✅ Use `.env` files (in `.gitignore`)
   - ✅ Use GitHub secrets for CI/CD
   - ❌ Never hardcode credentials in source code

2. **Use different credentials for different environments**
   - Production: Strong, unique credentials
   - Staging/Test: Different credentials than production
   - Development: Local credentials (not in GitHub secrets)

3. **Rotate secrets periodically**
   - Update TEST_ADMIN_PASSWORD every 90 days
   - Regenerate API tokens annually
   - Update secrets immediately if compromised

4. **Limit secret access**
   - GitHub secrets are only accessible to:
     - Repository collaborators with write access
     - GitHub Actions workflows in the repository
   - They are NOT accessible to:
     - Pull requests from forks
     - Public viewers of the repository

5. **Audit secret usage**
   - Review workflow logs for unexpected secret access
   - Monitor Actions usage in repository insights
   - Check for failed authentication attempts

---

## Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [CodeRabbit Setup Guide](https://docs.coderabbit.ai/)
- [SSH Key Generation Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)

---

## Support

If you encounter issues not covered in this guide:

1. Check workflow logs: `gh run view --log`
2. Review GitHub Actions documentation
3. Open an issue in the repository
4. Contact the development team

---

## Summary Checklist

Before running CI/CD workflows, ensure:

- [ ] GitHub CLI is installed and authenticated
- [ ] TEST_ADMIN_EMAIL secret is set
- [ ] TEST_ADMIN_PASSWORD secret is set
- [ ] Secrets are verified: `gh secret list`
- [ ] Test workflow runs successfully
- [ ] Optional secrets (CODERABBIT_TOKEN, PROD_SSH_KEY) are set if needed

**Quick Setup Command:**
```bash
./scripts/setup-github-secrets.sh
```

That's it! Your GitHub secrets should now be properly configured for CI/CD workflows.
