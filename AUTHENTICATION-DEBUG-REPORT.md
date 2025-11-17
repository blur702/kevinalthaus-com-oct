# Authentication Debug Report

> **NOTE**: This is a test report document. For current test credentials, use environment variables: TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME

## Issue Summary
E2E test at `e2e/change-site-name.spec.ts` was failing with "Invalid credentials" error when trying to login with username "kevin" and password "kevin".

## Root Cause Analysis

### Investigation Steps
1. Checked if admin user "kevin" exists in database - **User found**
2. Verified user details:
   - Username: `kevin`
   - Email: `kevin@kevinalthaus.com`
   - Role: `admin`
   - Is Active: `true`
   - Created: `2025-10-30T20:33:23.829Z`

3. Tested password hashes against stored bcrypt hash:
   - Password "kevin": **NO MATCH**
   - Password from TEST_ADMIN_PASSWORD: **MATCH**

### Root Cause
The user "kevin" was created using the seed script `packages/main-app/scripts/seed-ci-user.js`, which uses the TEST_ADMIN_PASSWORD environment variable with a fallback default (not "kevin"):

```javascript
const plainPassword = process.env.TEST_ADMIN_PASSWORD || '[default test password]';
```

The `.env` file had:
```
TEST_ADMIN_PASSWORD=kevin
```

But the database contained a user with a different password (the default test password), indicating the user was created when the environment variable was not set or was set to a different value.

## Solution

### Fix Applied
Updated `.env` file to use the correct password:

```diff
TEST_ADMIN_USERNAME=kevin
- TEST_ADMIN_PASSWORD=kevin
+ TEST_ADMIN_PASSWORD=[test password]
```

### File Location
`E:\dev\kevinalthaus-com-oct\.env`

### Verification
Password verification confirmed that the TEST_ADMIN_PASSWORD environment variable matches the stored bcrypt hash in the database.

## How Authentication Works

### Authentication Flow
1. **Main App Auth** (`packages/main-app/src/auth/index.ts`):
   - Line 509: Login endpoint accepts username/email and password
   - Line 517: Queries database using case-insensitive lookup
   - Line 526: Uses `verifyPassword()` to compare with bcrypt hash
   - Line 551: Returns 401 "Invalid credentials" if password doesn't match

2. **Password Hashing**:
   - Uses bcrypt with cost factor 12
   - Hash stored in `users.password_hash` column
   - Verification done via `@monorepo/shared` package

### User Creation Scripts

1. **Seed CI User** (`packages/main-app/scripts/seed-ci-user.js`):
   - Password: From `TEST_ADMIN_PASSWORD` environment variable
   - Username: `kevin` (from `TEST_ADMIN_USERNAME`)
   - Upserts user on conflict

2. **Seed E2E User** (`scripts/seed-e2e-user.ts`):
   - Different script with password: `password123`
   - Username: `kevin_test`

## Prevention Recommendations

1. **Environment Variable Documentation**:
   - Update `.env.example` to show correct default password
   - Add comments explaining where defaults come from

2. **Seed Script Consistency**:
   - Consider using same password across all seed scripts
   - Or make it more obvious when different passwords are used

3. **Test Setup**:
   - E2E test setup should verify credentials before running tests
   - Add database check in `global-setup.ts` to validate test user

4. **Database Migrations**:
   - Consider adding initial admin user migration
   - Document expected default credentials

## Testing the Fix

To test the fix:

```bash
# 1. Verify environment variable is set
grep TEST_ADMIN_PASSWORD .env

# 2. Run the E2E test
npx playwright test e2e/change-site-name.spec.ts

# 3. Or test login manually
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"kevin","password":"[test password]"}'
```

## Related Files

- `.env` - Environment configuration (updated)
- `packages/main-app/scripts/seed-ci-user.js` - Seed script with default password
- `packages/main-app/src/auth/index.ts` - Main authentication logic
- `e2e/change-site-name.spec.ts` - E2E test that was failing
- `e2e/global-setup.ts` - E2E test setup (reads TEST_ADMIN_USERNAME/PASSWORD)

## Conclusion

**Issue**: Mismatch between `.env` TEST_ADMIN_PASSWORD and actual database password

**Fix**: Updated `.env` to use correct TEST_ADMIN_PASSWORD value

**Status**: RESOLVED
