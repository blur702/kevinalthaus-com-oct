# Testing Documentation

This document provides a comprehensive catalog of all automated tests in the Kevin Althaus platform to prevent duplication and provide clear guidance on test coverage.

## Quick Reference

- **Total Test Files:** 29 test files
- **Test Framework:** Playwright with TypeScript
- **Test Directory:** `e2e/`
- **Run All Tests:** `npx playwright test`
- **Run Single Test:** `npx playwright test <filename>`
- **View Report:** `npx playwright show-report`

## Test Categories

###  Production Tests (Active & Maintained)

#### Authentication & Authorization

**1. `e2e/auth.spec.ts`** - Comprehensive Authentication Testing
- Login with valid/invalid credentials
- Session persistence across page reloads and navigation
- Cookie-based authentication (httpOnly)
- Protected route redirects
- Logout functionality
- XSS prevention in login forms
- **Status:**  Active - Core authentication tests

**2. `e2e/api-auth.spec.ts`** - Authentication API Endpoints
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - Login with username/email
- POST `/api/auth/refresh` - Token refresh
- POST `/api/auth/logout` - Logout
- POST `/api/auth/forgot-password` - Password reset
- POST `/api/auth/change-password` - Password change
- GET `/api/auth/validate` - Token validation
- GET `/api/auth/me` - Current user info
- **Status:**  Active - API endpoint coverage

**3. `e2e/admin-auth-csrf.spec.ts`** - CSRF Protection
- CSRF token validation on admin routes
- Double-submit cookie pattern
- **Status:**  Active - Security testing

---

#### User Management

**4. `e2e/users.spec.ts`** - User Management UI
- User list display with pagination
- Search and filtering (by username, email, role, status)
- Sorting (username, email, created date)
- Row selection (single, multiple, select all)
- Create user dialog with validation
- Edit user dialog
- View user details
- Delete user (with kevin protection)
- Bulk operations (import/export)
- Responsive design (mobile/tablet)
- Error handling (API errors, network timeouts)
- **Status:**  Active - Comprehensive UI testing

**5. `e2e/api-users.spec.ts`** - User Management API
- GET `/api/users` - List with pagination, search, filters
- GET `/api/users/:id` - Get user by ID
- POST `/api/users` - Create user
- PATCH `/api/users/:id` - Update user
- DELETE `/api/users/:id` - Delete user
- Authorization checks (admin-only)
- **Status:**  Active - API endpoint coverage

**6. `e2e/complete-workflow.spec.ts`** - User Management E2E
- Login as admin ’ Create user ’ Verify listing ’ Logout ’ Login as new user
- **Status:**  Active - End-to-end workflow validation

---

#### Blog & Content Management

**7. `e2e/blog-creation-final-test.spec.ts`** - Blog Post Creation E2E P
- Login ’ Navigate to content ’ Create post ’ Save ’ Logout
- Form field validation (title, content)
- Post appears in list after creation
- Comprehensive logging and screenshots
- **Status:**  Active - PRIMARY blog workflow test
- **Last Updated:** 2025-11-04 (Working Auth and Blog tag)

**8. `e2e/api-blog-comprehensive.spec.ts`** - Blog API
- GET `/api/blog` - List posts with pagination, filters
- GET `/api/blog/public` - Public posts (published only)
- POST `/api/blog` - Create post with slug generation
- GET `/api/blog/:id` - Get post by ID
- PUT `/api/blog/:id` - Update post
- POST `/api/blog/:id/publish` - Publish draft
- POST `/api/blog/:id/unpublish` - Unpublish post
- DELETE `/api/blog/:id` - Soft delete
- Authorization (author/admin only)
- **Status:**  Active - API endpoint coverage

**9. `e2e/blog-post.spec.ts`** - Blog Workflow
- Create ’ Publish ’ Verify public ’ Update ’ Unpublish ’ Delete
- **Status:**  Active - Blog lifecycle workflow

**10. `e2e/taxonomy-workflow.spec.ts`** - Content Taxonomy
- Create category ’ Create content ’ Assign category ’ Filter by category
- **Status:**  Active - Taxonomy system workflow

---

#### Dashboard & Analytics

**11. `e2e/dashboard.spec.ts`** - Dashboard UI
- Stats cards (Users, Plugins, Page Views, Articles, Growth)
- Loading states and error handling
- API integration with fallback data
- Recent activity and quick actions
- Responsive layout (mobile/tablet)
- Performance checks (< 5 seconds load time)
- **Status:**  Active - Dashboard UI testing

**12. `e2e/api-dashboard.spec.ts`** - Dashboard API
- GET `/api/dashboard/stats` - Statistics endpoint
- Data consistency checks
- Authorization (admin-only)
- Performance (< 5 seconds, concurrent requests)
- **Status:**  Active - Dashboard API coverage

**13. `e2e/api-analytics.spec.ts`** - Analytics API
- GET `/api/analytics/page-views` - Page views with filters
- GET `/api/analytics/page-views/stats` - View statistics
- GET `/api/analytics/page-views/top-pages` - Top pages
- GroupBy options (hour/day/week/month)
- Date range filtering
- **Status:**  Active - Analytics API coverage

---

#### Settings & Configuration

**14. `e2e/settings-ui.spec.ts`** - Settings Interface
- Settings page UI tests
- **Status:**  Active - Settings UI coverage

**15. `e2e/api-settings.spec.ts`** - Settings API
- Settings API endpoint tests
- **Status:**  Active - Settings API coverage

---

#### Health & Infrastructure

**16. `e2e/api-health.spec.ts`** - Health Check Endpoints
- GET `/health` - Overall health status
- GET `/health/live` - Liveness probe
- GET `/health/ready` - Readiness probe
- GET `/` - Gateway info
- 404 handling for non-existent routes
- Performance (concurrent requests, caching)
- Security headers validation
- **Status:**  Active - Infrastructure monitoring

**17. `e2e/api-gateway-logging.spec.ts`** - API Gateway Logging
- Logging functionality validation
- **Status:**  Active - Logging infrastructure

---

#### Security

**18. `e2e/security-cors.spec.ts`** - CORS Configuration
- CORS policy validation
- **Status:**  Active - Security testing

**19. `e2e/security-upload-errors.spec.ts`** - File Upload Security
- File upload validation and error handling
- **Status:**  Active - Security testing

---

### =' Diagnostic Tests (Debug & Troubleshooting)

These tests were created for debugging specific issues. They may be useful for future troubleshooting but are not part of the regular test suite.

**20. `e2e/diagnose-content-field.spec.ts`** - Content Field Diagnostics
- Debug content field typing issues
- Field visibility, enablement, editability checks
- Screenshots at each step
- **Purpose:** Diagnosed invisible textarea (opacity: 0) issue
- **Status:** =' Diagnostic - Keep for reference

**21. `e2e/diagnose-mui-textfield.spec.ts`** - MUI TextField Structure
- Deep dive into MUI TextField multiline rendering
- Textarea structure analysis
- Click and focus testing
- **Purpose:** Analyzed BlockNote vs MUI TextField rendering
- **Status:** =' Diagnostic - Keep for reference

**22. `e2e/diagnose-cookies.spec.ts`** - Cookie Diagnostics
- Cookie handling analysis
- **Status:** =' Diagnostic

**23. `e2e/blog-post-simple.spec.ts`** - Simple Blog Debug
- Simplified blog post creation with detailed debugging
- Cookie and authentication debugging
- **Status:** =' Diagnostic

---

###   Legacy/Duplicate Tests (Consider Cleanup)

These tests may be outdated or duplicated by newer comprehensive tests.

**24. `e2e/blog-post-creation.spec.ts`** - Blog Creation (Old)
- **Status:**   Possibly superseded by `blog-creation-final-test.spec.ts`
- **Action:** Review and potentially archive

**25. `e2e/debug-blog-form.spec.ts`** - Blog Form Debug
- **Status:**   May be obsolete after form fixes
- **Action:** Review and potentially archive

**26. `e2e/blog-edit-test.spec.ts`** - Blog Edit Test
- **Status:**   Check if covered by `api-blog-comprehensive.spec.ts`
- **Action:** Review and potentially archive

**27. `e2e/test-admin-login.spec.ts`** - Admin Login Test
- **Status:**   Likely duplicated by `auth.spec.ts`
- **Action:** Review and potentially archive

**28. `e2e/blog-create-codex.spec.ts`** - Blog Codex Test
- **Status:**   Purpose unclear
- **Action:** Review and potentially archive

**29. `e2e/blog-post-ui.spec.ts`** - Blog Post UI
- **Status:**   Check coverage vs other blog tests
- **Action:** Review and potentially archive

---

## Test Utilities

### Helper Modules

**Location:** `e2e/utils/`

- **`auth.ts`** - Authentication helpers
  - `login(page, username, password)` - Login helper
  - `logout(page)` - Logout helper
  - `apiRequest(page, url, options)` - Authenticated API requests
  - `isAuthenticated(page)` - Check auth status
  - `TEST_CREDENTIALS` - Test user credentials

---

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run Specific Category
```bash
# Authentication tests
npx playwright test auth

# Blog tests
npx playwright test blog

# API tests
npx playwright test api-

# Diagnostic tests
npx playwright test diagnose
```

### Run Single Test File
```bash
npx playwright test e2e/blog-creation-final-test.spec.ts
```

### Run with UI (Headed Mode)
```bash
npx playwright test --headed
```

### Run Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Debug Mode
```bash
npx playwright test --debug
```

### View Last Report
```bash
npx playwright show-report
```

---

## Test Configuration

**Config File:** `playwright.config.ts`

**Base URL:** `http://localhost:3008` (Admin Panel)

**Timeouts:**
- Test timeout: 30 seconds
- Expect timeout: 5 seconds
- Navigation timeout: 30 seconds
- Action timeout: 10 seconds

**Browsers:** Chromium, Firefox, WebKit

**Parallel Execution:** Yes (configurable workers)

**Artifacts:**
- Screenshots: On failure
- Videos: On first retry
- Traces: On first retry
- Reports: HTML, JSON, List

---

## Best Practices

### Before Creating a New Test

1. **Check this catalog** - Ensure functionality isn't already tested
2. **Review existing tests** - Look for similar patterns
3. **Use helpers** - Leverage `e2e/utils/` helpers
4. **Name clearly** - Use descriptive filenames
5. **Add to catalog** - Update this document

### Test Naming Conventions

- **UI Tests:** `<feature>.spec.ts` (e.g., `users.spec.ts`)
- **API Tests:** `api-<feature>.spec.ts` (e.g., `api-blog.spec.ts`)
- **Workflows:** `<feature>-workflow.spec.ts` (e.g., `taxonomy-workflow.spec.ts`)
- **Diagnostics:** `diagnose-<issue>.spec.ts` (e.g., `diagnose-content-field.spec.ts`)
- **Debug:** `debug-<feature>.spec.ts` (e.g., `debug-blog-form.spec.ts`)

### Test Organization

```typescript
import { test, expect } from '@playwright/test';
import { login, logout, TEST_CREDENTIALS } from './utils/auth';

test.describe('Feature Name', () => {
  test('should do something specific', async ({ page }) => {
    // Arrange
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

    // Act
    await page.goto('/feature');

    // Assert
    await expect(page.locator('h1')).toContainText('Feature');
  });
});
```

---

## Coverage Gaps

Areas that may need additional testing:

- [ ] Plugin management UI
- [ ] Plugin API endpoints
- [ ] File upload workflows (media library)
- [ ] Content publishing/scheduling
- [ ] Email functionality (if implemented)
- [ ] WebSocket/real-time features (if implemented)
- [ ] Mobile-specific tests
- [ ] Accessibility (a11y) tests
- [ ] Performance/load tests
- [ ] Database migration tests

---

## Maintenance Notes

**Last Updated:** 2025-11-04

**Maintenance Schedule:**
- Review diagnostic tests quarterly
- Archive obsolete tests after confirming replacement
- Update catalog when adding new tests
- Verify all tests pass before releases

**Known Issues:**
- Some diagnostic tests have hardcoded waits - refactor to use proper selectors
- Legacy tests may use outdated patterns - prioritize cleanup
- Logout helper uses data-testid selectors that may not exist - needs fallback

---

## Test Results

**Current Status:**  All production tests passing

**Latest Test Run:**
- **Date:** 2025-11-04
- **Primary Test:** `blog-creation-final-test.spec.ts`
- **Result:**  PASSED
- **Duration:** 13.3 seconds
- **Tag:** `working-auth-and-blog`

**Key Achievements:**
-  Login/logout workflow verified
-  Blog post creation and saving working
-  Content field typing issue resolved
-  BlockNote WYSIWYG replaced with functional MUI TextField

---

## Resources

- **Playwright Docs:** https://playwright.dev
- **Test Reports:** `playwright-report/`
- **Test Results:** `test-results/`
- **Screenshots:** `test-results/*.png`
- **Videos:** `test-results/*.webm`

---

For questions or issues with tests, refer to the [Testing Best Practices](https://playwright.dev/docs/best-practices) or consult the team.
