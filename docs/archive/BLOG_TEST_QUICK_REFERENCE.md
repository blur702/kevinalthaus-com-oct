> **ARCHIVED DOCUMENT** - This document contains historical testing data and may reference outdated credentials.
> For current credentials, refer to environment variables: TEST_ADMIN_PASSWORD, ADMIN_INITIAL_PASSWORD

# Blog Post Creation Test - Quick Reference

## Quick Start

### Run Tests
```bash
# All tests
npx playwright test e2e/blog-post-creation.spec.ts

# Single browser (Chrome)
npx playwright test e2e/blog-post-creation.spec.ts --project=chromium

# With UI
npx playwright test e2e/blog-post-creation.spec.ts --ui

# Debug mode
npx playwright test e2e/blog-post-creation.spec.ts --debug
```

### Test Credentials
```typescript
Username: 'kevin'
Password: '[test password]'
```

## Test Files

| File | Purpose |
|------|---------|
| `e2e/blog-post-creation.spec.ts` | Main test suite (8 tests) |
| `e2e/utils/auth.ts` | Authentication helpers |
| `BLOG_POST_CREATION_TEST_ANALYSIS.md` | Detailed analysis & security audit |
| `BLOG_POST_CREATION_TEST_SUMMARY.md` | Implementation summary |

## Test Coverage

### Core Workflow
- ✓ Login with credentials
- ✓ Navigate to /content
- ✓ Click "Create New Post"
- ✓ Fill form (title, content, excerpt, status)
- ✓ Submit form
- ✓ Verify creation

### Authentication
- ✓ Cookie verification (accessToken, refreshToken, csrf-token)
- ✓ 401 error handling
- ✓ Authentication persistence
- ✓ Request cookie headers

### Form Validation
- ✓ Required field validation
- ✓ Submit button disabled when fields empty
- ✓ All form fields displayed correctly

### Navigation
- ✓ "Back to List" button
- ✓ Multiple page navigation with auth

## Architecture

### Ports
```
Admin Panel:  http://localhost:3003
API Gateway:  http://localhost:3000
Main App:     http://localhost:3001
```

### Authentication
- **Type**: Cookie-based JWT
- **Cookies**: accessToken, refreshToken, csrf-token
- **CSRF**: Double-submit cookie pattern
- **Token Expiry**: 15 min (access), 30 days (refresh)

### Blog API
```
POST   /api/blog          - Create post (auth required)
GET    /api/blog          - List posts (auth required)
GET    /api/blog/:id      - Get single post
PUT    /api/blog/:id      - Update post (auth required)
DELETE /api/blog/:id      - Delete post (auth required)
GET    /api/blog/public   - List published posts (public)
```

## Common Issues

### Port Mismatch
```bash
# Set correct port
PLAYWRIGHT_BASE_URL=http://localhost:3003 npx playwright test
```

### Services Not Running
```bash
# Start all services
cd packages/admin && npm run dev        # Port 3003
cd packages/api-gateway && npm run dev  # Port 3000
cd packages/main-app && npm run dev     # Port 3001
```

### Test Timeout
```bash
# Increase timeout
npx playwright test --timeout=60000
```

## Test Structure

```typescript
test.beforeEach(async ({ page }) => {
  // Login before each test
  await login(page, 'kevin', '[test password]');

  // Verify cookies
  expect(await hasAuthCookies(page)).toBeTruthy();
});

test('should create blog post', async ({ page }) => {
  // Navigate
  await page.goto('/content');

  // Click create
  await page.locator('button:has-text("Create New Post")').click();

  // Fill form
  await page.fill('input[name="title"]', 'Test Post');
  await page.locator('textarea').first().fill('Content');

  // Submit
  await page.locator('button:has-text("Create")').click();

  // Verify
  await expect(page).toHaveURL(/\/content/);
});
```

## Security Checklist

- [x] httpOnly cookies
- [x] CSRF protection
- [x] Short-lived access tokens
- [x] Refresh token rotation
- [x] SameSite cookie attribute
- [x] withCredentials: true
- [x] RBAC authorization
- [x] Author verification

## API Request Format

### Create Blog Post
```bash
POST /api/blog
Content-Type: application/json
Cookie: accessToken=...; refreshToken=...; csrf-token=...
X-CSRF-Token: ...

{
  "title": "Test Blog Post",
  "body_html": "Content here",
  "excerpt": "Summary",
  "status": "draft"
}
```

### Response
```json
{
  "id": "uuid",
  "title": "Test Blog Post",
  "slug": "test-blog-post",
  "status": "draft",
  "author_id": "user-uuid",
  "created_at": "2025-11-03T10:00:00.000Z"
}
```

## Debugging

### View Test Report
```bash
npx playwright show-report
```

### Screenshots
Location: `test-results/*/test-failed-*.png`

### Videos
Location: `test-results/*/video.webm`

### Trace Viewer
```bash
npx playwright show-trace test-results/.../trace.zip
```

## Helper Functions

```typescript
// Login
await login(page, username, password); // Use environment variables for credentials

// Check auth
const hasAuth = await hasAuthCookies(page);

// Get cookies
const cookies = await getAuthCookies(page);

// Clear auth
await clearAuth(page);
```

## Next Steps

1. Run tests: `npx playwright test e2e/blog-post-creation.spec.ts`
2. Review results: `npx playwright show-report`
3. Add more tests as needed
4. Integrate with CI/CD

## Resources

- Playwright Docs: https://playwright.dev
- Test Location: `e2e/blog-post-creation.spec.ts`
- Analysis: `BLOG_POST_CREATION_TEST_ANALYSIS.md`
- Summary: `BLOG_POST_CREATION_TEST_SUMMARY.md`
