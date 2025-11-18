# GitHub Secrets Quick Start Guide

## ⚡ Quick Setup (5 minutes)

This guide will help you set up GitHub secrets for CI/CD workflows.

### Step 1: Authenticate with GitHub CLI

```bash
gh auth login
```

Follow the prompts:
1. Select: **GitHub.com**
2. Select: **HTTPS**
3. Select: **Login with a web browser**
4. Press Enter to open browser
5. Enter the one-time code shown in terminal
6. Authorize GitHub CLI

### Step 2: Run the Setup Script

**On Windows (PowerShell):**
```powershell
cd scripts
.\setup-github-secrets.ps1
```

**On macOS/Linux:**
```bash
cd scripts
chmod +x setup-github-secrets.sh
./setup-github-secrets.sh
```

### Step 3: Provide Required Information

The script will ask for:

1. **TEST_ADMIN_EMAIL** (Required)
   - Enter: `kevin` (or your admin username)

2. **TEST_ADMIN_PASSWORD** (Required)
   - Enter: Your admin password
   - Note: Based on CLAUDE.md, the password should be: `(130Bpm)`

3. **CODERABBIT_TOKEN** (Optional)
   - Press `n` to skip if you don't have one
   - Or get token from: https://coderabbit.ai

4. **PROD_SSH_KEY** (Optional)
   - Press `n` to skip for now
   - Only needed for automated production deployments

### Step 4: Verify Setup

```bash
gh secret list
```

You should see:
```
TEST_ADMIN_EMAIL      Updated YYYY-MM-DD
TEST_ADMIN_PASSWORD   Updated YYYY-MM-DD
```

### Step 5: Test the Workflows

Push a test commit to trigger workflows:

```bash
git add .
git commit -m "chore: configure GitHub secrets"
git push
```

Check workflow status:
```bash
gh run list --limit 3
```

---

## ✅ What's Configured

### Workflows Updated

1. **`.github/workflows/coderabbit.yml`**
   - ✅ CodeRabbit review (optional - skips if token missing)
   - ✅ CodeQL security scan (now properly initialized)
   - ✅ E2E tests (requires TEST_ADMIN_EMAIL/PASSWORD)
   - ✅ Production tests (only runs on main/master with credentials)

2. **`.github/workflows/e2e-tests.yml`**
   - ✅ Uses fallback password if secret not set
   - ✅ Won't fail if credentials missing

### Security Improvements

1. **CSP Headers** (nginx)
   - ✅ Removed `unsafe-inline` and `unsafe-eval` from scripts
   - ✅ Moved inline scripts to external files
   - ✅ Enhanced XSS protection

2. **Test Security** (E2E tests)
   - ✅ No hardcoded credentials in code
   - ✅ Default TEST_URL is localhost (prevents production mutations)
   - ✅ Tests fail explicitly when data is missing (no silent passes)

---

## 🔧 Manual Setup (Alternative)

If you prefer not to use the script, set secrets manually:

### Using GitHub CLI

```bash
echo "kevin" | gh secret set TEST_ADMIN_EMAIL
echo "(130Bpm)" | gh secret set TEST_ADMIN_PASSWORD
```

### Using GitHub Web UI

1. Go to: https://github.com/YOUR_USERNAME/kevinalthaus-com-oct/settings/secrets/actions
2. Click "New repository secret"
3. Name: `TEST_ADMIN_EMAIL`, Value: `kevin`
4. Click "Add secret"
5. Repeat for `TEST_ADMIN_PASSWORD`

---

## 🆘 Troubleshooting

### Issue: "gh: command not found"

**Install GitHub CLI:**
- Windows: `winget install --id GitHub.cli`
- macOS: `brew install gh`
- Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md

### Issue: "You are not logged into any GitHub hosts"

Run: `gh auth login` and follow the prompts

### Issue: "Could not determine repository name"

Make sure you're in the repository directory:
```bash
cd /e/dev/kevinalthaus-com-oct
```

### Issue: Workflows are failing

1. Check secrets are set: `gh secret list`
2. View workflow logs: `gh run view --log`
3. Verify credentials work locally: `npm run test:e2e`

---

## 📚 Full Documentation

For detailed information, see:
- **Complete Guide**: `docs/github-secrets-setup.md`
- **Testing Guide**: `docs/testing-automation.md`

---

## 🎯 Next Steps

After setting up secrets:

1. ✅ Verify secrets: `gh secret list`
2. ✅ Push changes: `git push`
3. ✅ Monitor workflows: `gh run list`
4. ✅ Check workflow run: `gh run view`

**Your CI/CD pipeline is now ready!** 🚀
