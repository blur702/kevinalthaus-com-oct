> **ARCHIVED DOCUMENT** - This document contains historical testing data and may reference outdated credentials.
> For current credentials, refer to environment variables: TEST_ADMIN_PASSWORD, ADMIN_INITIAL_PASSWORD

# Debug: 401 Unauthorized Error Despite Being Logged In

## The Problem
- You CAN access the Content page (authentication works for navigation)
- You GET a 401 error when submitting the blog form (authentication fails for API)
- This means cookies aren't being sent properly with the API request

## Root Cause Analysis

The issue is likely one of these:

### 1. Proxy Port Mismatch
- Admin panel is on **localhost:3005**
- Vite proxy config expects **localhost:3003**
- API requests might not be proxied correctly

### 2. Cookie Domain Issue
- Cookies set for localhost:3003
- But you're accessing localhost:3005
- Browser won't send cookies across different ports

### 3. CSRF Token Missing
- CSRF token might not be sent with the request
- Or token is invalid/expired

## Immediate Diagnosis Steps

### Step 1: Check Network Request
1. Open DevTools (F12)
2. Go to Network tab
3. Click "Create" button on the form
4. Find the `POST /api/blog` request
5. Click on it and check:

**Request Headers tab:**
```
Should see:
Cookie: accessToken=...; refreshToken=...; csrf-token=...
X-CSRF-Token: <token value>
```

**If cookies are MISSING:**
- This confirms the cookie domain/port issue

**If cookies are PRESENT but still 401:**
- Token might be expired or invalid
- Server might be rejecting for another reason

### Step 2: Check Cookies Manually
1. DevTools → Application → Cookies
2. Check cookies for **http://localhost:3005**
3. Should see:
   - `accessToken` (httpOnly)
   - `refreshToken` (httpOnly)
   - `csrf-token`

**If cookies are on localhost:3003 instead:**
- You need to log in again on localhost:3005

### Step 3: Check Response Details
1. In Network tab, click the failed `POST /api/blog` request
2. Go to Response tab
3. Look for error message

Common responses:
```json
{"error": "Unauthorized"} // Missing/invalid token
{"error": "CSRF token invalid"} // CSRF issue
{"error": "Token expired"} // Session expired
```

## Quick Fixes to Try

### Fix 1: Re-login on Correct Port
Since your admin is on port 3005 (not 3003):

1. **Log out:** Click "Logout" button
2. **Navigate to:** http://localhost:3005/login
3. **Log in again** with kevin/[test password]
4. **Check cookies** are set for localhost:3005
5. **Try creating a post again**

### Fix 2: Hard Refresh
1. Press **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
2. This clears cached resources
3. Try creating a post again

### Fix 3: Clear All Cookies
1. DevTools → Application → Cookies
2. Right-click → Clear all cookies
3. Log in again
4. Try creating a post

### Fix 4: Check Proxy Configuration
The Vite proxy might not be forwarding cookies. Let me check the actual request:

1. Open browser console
2. Run this JavaScript:
```javascript
// Test if cookies are accessible
document.cookie

// Test API request manually
fetch('/api/blog', {
  method: 'POST',
  credentials: 'include', // Important!
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Test',
    body_html: 'Test content',
    status: 'draft'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

If this returns 401, the issue is with the cookies/session.
If this works, the issue is with how the form is making the request.

## Expected vs Actual

### Expected Behavior:
1. Login sets cookies on localhost:3005
2. Cookies automatically sent with API requests
3. Server validates cookies and accepts request
4. Response: 201 Created

### Actual Behavior:
1. Login works (you can access Content page)
2. Cookies might not be sent OR are invalid
3. Server rejects request
4. Response: 401 Unauthorized

## The Real Issue: Port Mismatch

I suspect the issue is:

- **Playwright tests** expect admin on **localhost:3003**
- **Your dev server** auto-selected **localhost:3005**
- **You logged in on one port** but **cookies are for another port**

### Solution:
Either:
1. **Stop other services using port 3003** and restart admin panel on 3003
2. **Or update Playwright config** to use localhost:3005
3. **Or just re-login** on the current port (3005)

## Verify the Fix

After trying fixes, verify:

1. **Check cookies are present:**
   ```javascript
   // Run in console
   document.cookie // Should show accessToken, refreshToken, csrf-token
   ```

2. **Check API works:**
   ```javascript
   // Run in console
   fetch('/api/blog', {
     method: 'GET',
     credentials: 'include'
   })
   .then(r => r.json())
   .then(console.log) // Should return list of posts, not 401
   ```

3. **Try creating a post** - Should work now!

## If Still Getting 401

Check the main-app server logs:

```bash
# In the terminal where main-app is running
# Look for authentication errors
```

Might see:
- "Invalid token"
- "Token expired"
- "CSRF token mismatch"
- "User not found"

This will tell us exactly why authentication is failing.
