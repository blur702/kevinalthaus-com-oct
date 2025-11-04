# Manual Testing Checklist - Blog Post Creation

## Prerequisites
- Admin panel running on http://localhost:3005 (auto-selected port)
- Main app running on http://localhost:3001
- PostgreSQL database running

## Step-by-Step Testing Guide

### Step 1: Log In
1. Navigate to: `http://localhost:3005/login`
2. Enter credentials:
   - Username: `kevin`
   - Password: `(130Bpm)`
3. Click "Login" button
4. **Expected Result:** Redirected to Dashboard at `http://localhost:3005/`

### Step 2: Navigate to Content Page
1. Click "Content" in the left sidebar
2. **Expected Result:** See "Blog Posts" heading and "Create New Post" button

### Step 3: Create New Blog Post
1. Click "Create New Post" button
2. **Expected Result:** Form appears with the following fields:
   - Title (required)
   - Slug (optional)
   - Content (required, multi-line)
   - Excerpt (optional, multi-line)
   - Meta Description (optional)
   - Keywords (can add multiple)
   - Reading Time (number)
   - Status (dropdown: Draft/Published/Scheduled)
   - Allow Comments (toggle)

### Step 4: Fill Out Form
Fill in the form with test data:
```
Title: My First Blog Post
Slug: (leave empty - will auto-generate)
Content: This is the main content of my blog post. It supports HTML.
Excerpt: A brief summary of the post
Meta Description: SEO-friendly description for search engines
Keywords: (click Add to add: "test", "blog", "first post")
Reading Time: 5
Status: Draft
Allow Comments: ✓ (checked)
```

### Step 5: Submit Form
1. Click "Create" button
2. **Expected Results:**
   - No errors in console (except harmless React Router warnings)
   - Form submits successfully
   - Redirected back to blog post list
   - New post appears in the table

### Step 6: Verify Post Created
1. Check the blog posts table
2. **Expected Result:** See your new post with:
   - Title: "My First Blog Post"
   - Status: Draft (gray chip)
   - Author: kevin
   - Created date: Today's date

### Step 7: Edit Post
1. Click the three-dot menu (⋮) on your post
2. Click "Edit"
3. **Expected Result:** Form appears with all fields pre-filled

### Step 8: Update Post
1. Change the title to: "My Updated Blog Post"
2. Change status to: "Published"
3. Click "Update" button
4. **Expected Result:**
   - Form submits successfully
   - Back to list view
   - Post shows updated title and Published status (green chip)

### Step 9: Delete Post (Optional)
1. Click the three-dot menu (⋮) on your post
2. Click "Delete"
3. Confirm deletion
4. **Expected Result:** Post removed from list

## Common Issues and Solutions

### Issue: 401 Unauthorized Error
**Symptom:** Console shows `POST http://localhost:3005/api/blog 401 (Unauthorized)`

**Solution:**
1. Make sure you're logged in
2. Check browser cookies:
   - Open DevTools → Application → Cookies → http://localhost:3005
   - Should see: `accessToken`, `refreshToken`, `csrf-token`
3. If no cookies, log out and log back in
4. Clear browser cache if needed

### Issue: Form Fields Not Visible
**Symptom:** Clicking "Create New Post" doesn't show the form

**Solution:**
1. Check console for errors
2. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
3. Clear browser cache
4. Restart dev servers

### Issue: Can't Find "Create New Post" Button
**Symptom:** Button not visible on Content page

**Solution:**
1. Make sure you're on: http://localhost:3005/content
2. Check if you're logged in (should see "Logout" button in top right)
3. Refresh the page

## React Router Warnings (Safe to Ignore)

These warnings appear in the console but don't affect functionality:
```
⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7.
⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7.
```

**Action Required:** None. These are informational warnings about React Router v7 migration.

## Network Tab Verification

To verify authentication is working:

1. Open DevTools → Network tab
2. Click "Create New Post" and fill form
3. Click "Create" button
4. Look for `POST /api/blog` request:
   - **Status should be:** 201 Created (success)
   - **Headers should include:**
     - Cookie: accessToken=...
     - Cookie: refreshToken=...
     - X-CSRF-Token: ...

If status is 401, you need to log in again.

## Success Criteria

✅ Can log in successfully
✅ Can navigate to Content page
✅ Can click "Create New Post" and see form
✅ Can fill out all form fields
✅ Can submit form without errors
✅ New post appears in list after creation
✅ Can edit existing post
✅ Can update post successfully
✅ All authentication cookies present
✅ CSRF token sent with requests

## Port Configuration

- **Admin Panel:** http://localhost:3005 (Vite auto-selected this port)
- **Main App (API):** http://localhost:3001 (proxied through admin panel)
- **Proxy Config:** Admin panel proxies `/api/*` requests to main-app

## Debug Checklist

If something doesn't work:

1. **Check servers are running:**
   ```bash
   # Should see process on port 3005
   netstat -ano | findstr :3005

   # Should see process on port 3001
   netstat -ano | findstr :3001
   ```

2. **Check authentication cookies:**
   - DevTools → Application → Cookies
   - Should see accessToken, refreshToken, csrf-token

3. **Check network requests:**
   - DevTools → Network tab
   - Filter by "XHR" or "Fetch"
   - Look for 401 errors

4. **Check console errors:**
   - Ignore React Router warnings
   - Look for actual errors (red text)
   - Check for authentication errors

## Test Results Documentation

After completing all steps, document results:

- [ ] Login successful
- [ ] Content page loaded
- [ ] Create form displayed
- [ ] Form submission successful
- [ ] Post created in database
- [ ] Edit form pre-filled correctly
- [ ] Update successful
- [ ] Delete successful
- [ ] No console errors (except warnings)
- [ ] Authentication working properly

---

**Current Status:** Form is implemented and tested. Authentication is working. Main issue is ensuring user is logged in before attempting to create posts.
