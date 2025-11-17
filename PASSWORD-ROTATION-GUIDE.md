# Production Password Rotation Guide

## New Production Password

**IMPORTANT: Never commit actual passwords to this file or version control!**

The new password should be:
- Stored securely in your password manager
- Set in `.env.local` as `PROD_SUDO_PASSWORD` (this file is gitignored)
- Generated using: `openssl rand -base64 32`

```
<new-production-password>
```

## Manual Rotation Steps

### Step 1: Generate a New Strong Password

```bash
# Generate a secure 32-character password
NEW_PASSWORD=$(openssl rand -base64 32)
echo "Generated password (save this): $NEW_PASSWORD"
```

### Step 2: Change Password on Production Server

Run this command and follow the prompts:

```bash
ssh kevin@65.181.112.77
sudo passwd kevin
```

When prompted:
1. **Current password**: Enter your current production password
2. **New password**: Enter the generated password from Step 1
3. **Retype new password**: Re-enter the same password

**Security Note:** Never hardcode actual passwords in documentation. Always use environment variables or secret managers.

### Step 3: Save Password Locally

```bash
# Save to .env.local (gitignored)
echo "PROD_SUDO_PASSWORD=$NEW_PASSWORD" >> .env.local
```

### Step 4: Test the New Password

```bash
# Test sudo access with new password from environment
source .env.local
ssh kevin@65.181.112.77 "echo '$PROD_SUDO_PASSWORD' | sudo -S echo 'Sudo access confirmed'"
```

### Step 4: Test Deployment

```bash
# Load environment and test deployment
source .env.local
./scripts/deploy-to-prod.sh
```

## Automatic Rotation (Alternative)

If you prefer automatic rotation, run:

```bash
bash scripts/rotate-prod-password.sh
```

## Post-Rotation Checklist

- [ ] Password changed on production server
- [ ] New password saved in password manager
- [ ] `.env.local` created with new password
- [ ] Sudo access tested with new password
- [ ] Deployment tested with new password
- [ ] Old password references removed from documentation
- [ ] Team notified (if applicable)

## Security Notes

- The new password is 32 characters of base64-encoded random data
- Much stronger than the previous password
- Never commit `.env.local` to version control (already in .gitignore)
- The deployment script reads from `PROD_SUDO_PASSWORD` environment variable
