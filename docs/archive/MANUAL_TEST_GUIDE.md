# Manual Test Guide - Complete Workflow Verification

## Overview

This guide walks through the complete user management workflow to verify all functionality:
1. Login as admin
2. Create a new test user
3. Verify user appears in listings
4. Login as the new user
5. Verify successful authentication

## Prerequisites

- All services running (Docker containers or local dev servers)
- Admin panel accessible at http://localhost:3003

## Test Steps

### Step 1: Login as Admin

1. Navigate to http://localhost:3003/login
2. Enter credentials:
   - **Username**: `kevin`
   - **Password**: `(130Bpm)`
3. Click "Sign In"
4. ✅ **Expected**: Redirect to dashboard, see "Welcome" message

### Step 2: Navigate to Users Page

1. Click "Users" in the left sidebar
2. ✅ **Expected**: Users page loads, see table with existing users
3. ✅ **Expected**: See the kevin user in the list

### Step 3: Create New User

1. Click "Create User" button (top right)
2. Fill in the form:
   - **Username**: `testuser1` (or any unique name)
   - **Email**: `testuser1@example.com`
   - **Password**: `Test123!@#`
   - **Role**: Select "viewer" from dropdown
3. Click "Create" button
4. ✅ **Expected**: Dialog closes, success message appears
5. ✅ **Expected**: New user appears in the users table

### Step 4: Verify User in Listing

1. In the search box, type: `testuser1`
2. ✅ **Expected**: Table filters to show only the new user
3. ✅ **Expected**: User row shows:
   - Username: testuser1
   - Email: testuser1@example.com
   - Role: viewer
   - Status: Active (green badge)
4. Clear the search to see all users again

### Step 5: Logout

1. Click the user menu icon (top right)
2. Click "Logout"
3. ✅ **Expected**: Redirect to login page

### Step 6: Login as New User

1. Enter new user credentials:
   - **Username**: `testuser1`
   - **Password**: `Test123!@#`
2. Click "Sign In"
3. ✅ **Expected**: Successful login, redirect to dashboard

### Step 7: Verify Authentication

1. Check that user menu shows testuser1
2. Navigate to different pages (Dashboard, Users, Content)
3. ✅ **Expected**: Pages load successfully
4. ✅ **Expected**: User remains authenticated

## Test Completion Checklist

- [ ] Admin login successful
- [ ] Users page loads and displays users
- [ ] New user created via UI
- [ ] New user appears in listings
- [ ] New user details are correct (username, email, role)
- [ ] Admin logout successful
- [ ] New user login successful
- [ ] New user can access dashboard
- [ ] New user authentication persists across pages

## Troubleshooting

### Issue: 404 errors for /api/users-manager

**Solution**: Services need to be rebuilt to include new routes

```bash
# Stop services
docker compose down

# Rebuild
docker compose build main-app api-gateway

# Restart
docker compose up -d

# Wait for healthy status
sleep 20
docker ps
```

### Issue: "Failed to load users" message

**Solution**: Check API Gateway and Main App logs

```bash
# Check API Gateway
docker logs kevinalthaus-api-gateway

# Check Main App
docker logs kevinalthaus-main-app

# Look for route registration or errors
```

### Issue: Login fails with "Invalid credentials"

**Solution**: Verify admin user exists

```bash
# Check database
docker exec kevinalthaus-postgres psql -U postgres -d kevinalthaus -c "SELECT username, email, role FROM users WHERE username = 'kevin';"
```

## API Endpoints Reference

All endpoints require JWT authentication (except /auth/login and /auth/register).

### Users Manager API

- `GET /api/users-manager` - List users with pagination
- `GET /api/users-manager/:id` - Get single user
- `POST /api/users-manager` - Create user (admin only)
- `PATCH /api/users-manager/:id` - Update user (admin only)
- `DELETE /api/users-manager/:id` - Delete user (admin only, cannot delete kevin)

### Dashboard API

- `GET /api/dashboard/stats` - Get dashboard statistics

## Success Criteria

This test is considered **COMPLETE** when:

1. ✅ Admin can login
2. ✅ Admin can see users list
3. ✅ Admin can create a new user via UI
4. ✅ New user appears in the listings table
5. ✅ Admin can logout
6. ✅ New user can login with their credentials
7. ✅ New user can access the dashboard and other pages

## Notes

- The kevin admin user is protected and cannot be deleted
- All passwords must be at least 8 characters
- Usernames must be alphanumeric (hyphens and underscores allowed)
- Emails must be valid format

## Screenshot Locations

If using Playwright, failed test screenshots are saved to:
- `test-results/*/test-failed-*.png`
- `test-results/*/video.webm`
- `test-results/*/error-context.md`

## CodeRabbit Verification

After completing the manual test, run CodeRabbit to verify code quality:

```bash
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-wrapper.sh --type uncommitted --prompt-only"
```

Check the results in:
- `.coderabbit-status/output.txt`
- `.coderabbit-status/notification.txt`
