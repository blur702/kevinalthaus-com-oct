# E2E Testing Documentation

Comprehensive end-to-end testing infrastructure for the admin panel using Playwright.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests Locally](#running-tests-locally)
- [Writing New Tests](#writing-new-tests)
- [Test Utilities](#test-utilities)
- [Debugging Failed Tests](#debugging-failed-tests)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The E2E test suite provides comprehensive coverage of the admin panel functionality:

- **Authentication**: Login, logout, session persistence, cookie-based auth
- **Dashboard**: Stats display, API integration, fallback data, loading states
- **User Management**: CRUD operations, pagination, search/filter, bulk actions

### Test Coverage

- **Total Test Files**: 3
- **Test Scenarios**: 100+ test cases
- **Browsers**: Chromium, Firefox, WebKit
- **Coverage Areas**:
  - Authentication & Authorization
  - User Interface & Interactions
  - API Integration & Error Handling
  - Responsive Design
  - Security & XSS Protection

## Test Structure

```
e2e/
├── auth.spec.ts              # Authentication tests
├── dashboard.spec.ts         # Dashboard tests
├── users.spec.ts             # User management tests
├── global-setup.ts           # Global test setup
├── utils/
│   ├── auth.ts               # Authentication helpers
│   ├── api.ts                # API request helpers
│   ├── fixtures.ts           # Test data factories
│   └── selectors.ts          # Common UI selectors
└── README.md                 # This file
```

### Test Organization

Each test file follows a consistent structure:

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
  });

  test.describe('Sub-feature', () => {
    test('should do something', async ({ page }) => {
      // Test implementation
    });
  });
});
```

## Running Tests Locally

### Prerequisites

1. **Node.js 20+** installed
2. **Admin panel running** on http://localhost:3003
3. **Test user credentials** configured via TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD environment variables

### Install Dependencies

```bash
# Install all dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Run All Tests

```bash
# Run all tests in all browsers
npm run test:e2e

# Or using Playwright directly
npx playwright test
```

### Run Specific Browser

```bash
# Chromium only
npx playwright test --project=chromium

# Firefox only
npx playwright test --project=firefox

# WebKit (Safari) only
npx playwright test --project=webkit
```

### Run Specific Test File

```bash
# Authentication tests only
npx playwright test e2e/auth.spec.ts

# Dashboard tests only
npx playwright test e2e/dashboard.spec.ts

# User management tests only
npx playwright test e2e/users.spec.ts
```

### Run Specific Test

```bash
# Run a specific test by name
npx playwright test -g "should login successfully"

# Run tests matching a pattern
npx playwright test -g "login"
```

### Watch Mode

```bash
# Run tests in watch mode (re-run on file changes)
npx playwright test --watch
```

### Debug Mode

```bash
# Run tests in headed mode (see browser)
npx playwright test --headed

# Run with debug inspector
npx playwright test --debug

# Run specific test in debug mode
npx playwright test e2e/auth.spec.ts -g "should login" --debug
```

### UI Mode

```bash
# Open Playwright UI for interactive testing
npx playwright test --ui
```

## Writing New Tests

### Basic Test Template

```typescript
import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';
import { selectors } from './utils/selectors';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Login if test requires authentication
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

    // Navigate to the page under test
    await page.goto('/your-page');
  });

  test('should perform action', async ({ page }) => {
    // Arrange: Set up test conditions
    await page.fill(selectors.someInput, 'test value');

    // Act: Perform the action being tested
    await page.click(selectors.submitButton);

    // Assert: Verify expected outcomes
    await expect(page.locator(selectors.successMessage)).toBeVisible();
  });
});
```

### Using Test Utilities

#### Authentication

```typescript
import { login, logout, clearAuth, hasAuthCookies } from './utils/auth';

// Login
await login(page, 'username', 'password');

// Logout
await logout(page);

// Clear authentication
await clearAuth(page);

// Check if authenticated
const isAuth = await hasAuthCookies(page);
```

#### API Helpers

```typescript
import { createUserViaApi, deleteUserViaApi, listUsersViaApi } from './utils/api';

// Create user via API
const user = await createUserViaApi(page, {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123!',
  role: 'viewer',
});

// List users via API
const users = await listUsersViaApi(page, { page: 1, limit: 10 });

// Delete user via API (cleanup)
await deleteUserViaApi(page, userId);
```

#### Test Data Factories

```typescript
import { createTestUser, createTestUsers, INVALID_TEST_DATA } from './utils/fixtures';

// Generate single test user
const user = createTestUser();

// Generate multiple test users
const users = createTestUsers(5);

// Use invalid test data
await page.fill('input[name="email"]', INVALID_TEST_DATA.email.invalid);
```

#### Selectors

```typescript
import { selectors, getTableRow, getInputByLabel } from './utils/selectors';

// Use predefined selectors
await page.click(selectors.users.createButton);
await page.fill(selectors.auth.usernameInput, 'username');

// Get table row
const row = getTableRow(0); // First row
await page.click(row);

// Get input by label
const input = getInputByLabel('Email');
await page.fill(input, 'test@example.com');
```

### Test Data Cleanup

Always clean up test data created during tests:

```typescript
test('should create user', async ({ page }) => {
  const testUser = createTestUser();

  // Create user via UI or API
  const userId = await createUserViaApi(page, testUser);

  // Test assertions...

  // Cleanup
  await deleteUserViaApi(page, userId);
});
```

### Using beforeAll/afterAll for Test Data

```typescript
test.describe('Feature with test data', () => {
  let testUserId: string;

  test.beforeAll(async ({ browser }) => {
    // Create test data once for all tests
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

    const user = await createUserViaApi(page, createTestUser());
    testUserId = user.id;

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup test data
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

    await deleteUserViaApi(page, testUserId);

    await context.close();
  });

  test('should use test data', async ({ page }) => {
    // Test implementation using testUserId
  });
});
```

## Test Utilities

### Authentication (e2e/utils/auth.ts)

- `login(page, username, password)` - Login helper
- `logout(page)` - Logout helper
- `clearAuth(page)` - Clear cookies and storage
- `hasAuthCookies(page)` - Check if auth cookies exist
- `isAuthenticated(page)` - Check if user is authenticated
- `getAuthCookies(page)` - Get authentication cookies
- `TEST_CREDENTIALS` - Test user credentials

### API Helpers (e2e/utils/api.ts)

- `apiRequest(page, method, path, data)` - Make authenticated API request
- `createUserViaApi(page, userData)` - Create user
- `deleteUserViaApi(page, userId)` - Delete user
- `getUserViaApi(page, userId)` - Get user by ID
- `listUsersViaApi(page, params)` - List users with filters
- `updateUserViaApi(page, userId, updates)` - Update user
- `bulkDeleteUsersViaApi(page, userIds)` - Bulk delete users
- `getDashboardStatsViaApi(page)` - Get dashboard stats
- `waitForApiResponse(page, urlPattern)` - Wait for API response
- `mockApiResponse(page, urlPattern, mockData)` - Mock API response

### Test Data Factories (e2e/utils/fixtures.ts)

- `createTestUser(overrides)` - Generate test user
- `createTestUsers(count, overrides)` - Generate multiple users
- `TEST_USER_BY_ROLE` - Predefined users by role
- `INVALID_TEST_DATA` - Invalid data for validation tests
- `PAGINATION_SCENARIOS` - Pagination test data
- `SEARCH_SCENARIOS` - Search test data
- `FILTER_SCENARIOS` - Filter test data
- `WAIT_TIMES` - Common wait times
- `randomString(length)` - Generate random string
- `randomEmail()` - Generate random email

### Selectors (e2e/utils/selectors.ts)

Centralized selectors for all UI elements:

- `selectors.auth.*` - Authentication page selectors
- `selectors.dashboard.*` - Dashboard selectors
- `selectors.users.*` - User management selectors
- `selectors.userForm.*` - User form dialog selectors
- `selectors.userDetail.*` - User detail dialog selectors
- `selectors.common.*` - Common UI elements (alerts, loading, etc.)

Helper functions:
- `getTableRow(index)` - Get table row by index
- `getTableCell(rowIndex, colIndex)` - Get table cell
- `getInputByLabel(labelText)` - Get input by label
- `getSelectByLabel(labelText)` - Get select by label
- `getButtonByText(buttonText)` - Get button by text

## Debugging Failed Tests

### View Test Report

```bash
# Open HTML report
npx playwright show-report
```

### View Screenshots

Screenshots are automatically captured on test failure:

```
test-results/
  ├── auth-should-login-chromium/
  │   └── test-failed-1.png
  └── dashboard-should-load-firefox/
      └── test-failed-1.png
```

### View Videos

Videos are captured on failure (first retry):

```
test-results/
  └── auth-should-login-chromium/
      └── video.webm
```

### View Traces

Traces provide detailed execution information:

```bash
# Open trace viewer
npx playwright show-trace test-results/path-to-trace.zip
```

### Debug with Inspector

```bash
# Run test with inspector
npx playwright test --debug

# Inspect specific test
npx playwright test e2e/auth.spec.ts -g "login" --debug
```

### Use Console Logging

```typescript
test('should debug issue', async ({ page }) => {
  // Enable console logging
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  // Log page content
  const content = await page.content();
  console.log(content);

  // Take screenshot manually
  await page.screenshot({ path: 'debug-screenshot.png' });

  // Pause execution
  await page.pause();
});
```

### Common Debug Commands

```bash
# Run test in headed mode (see browser)
npx playwright test --headed

# Run test with slower execution
npx playwright test --slow-mo=1000

# Run single test in debug mode
npx playwright test --debug -g "test name"

# Generate detailed trace
npx playwright test --trace on
```

## CI/CD Integration

### GitHub Actions Workflow

The E2E tests run automatically on:

- Push to `main`, `master`, or `develop` branches
- Pull requests to these branches
- Manual workflow dispatch

### Workflow Features

- **Multi-browser testing**: Runs tests in Chromium, Firefox, and WebKit
- **Docker services**: Spins up PostgreSQL and Redis
- **Parallel execution**: Tests run in parallel across browsers
- **Artifact upload**: Screenshots, videos, and traces uploaded on failure
- **PR comments**: Test results posted as comments on pull requests

### Viewing CI Results

1. **Actions Tab**: Go to the Actions tab in GitHub
2. **Select Workflow**: Click on "E2E Tests" workflow
3. **View Run**: Click on a specific run to see details
4. **Download Artifacts**: Download test results, screenshots, and traces

### Local CI Simulation

```bash
# Set CI environment variable
export CI=true

# Run tests in CI mode
npx playwright test
```

## Best Practices

### 1. Test Independence

- Each test should be independent and not rely on other tests
- Use `beforeEach` to set up test state
- Use `afterEach` to clean up test data

### 2. Stable Selectors

- Use `data-testid` attributes for stable selectors
- Avoid selectors based on text content that might change
- Use semantic selectors when possible (`role`, `aria-label`)

### 3. Wait Strategies

```typescript
// GOOD: Wait for element to be visible
await page.waitForSelector('[data-testid="result"]', { state: 'visible' });

// GOOD: Wait for network idle
await page.goto('/dashboard', { waitUntil: 'networkidle' });

// BAD: Arbitrary timeout
await page.waitForTimeout(5000);
```

### 4. Assertions

```typescript
// GOOD: Wait for condition
await expect(page.locator('[data-testid="result"]')).toBeVisible();

// GOOD: Verify content
await expect(page.locator('h1')).toContainText('Dashboard');

// BAD: No assertion
const visible = await page.locator('[data-testid="result"]').isVisible();
```

### 5. Test Data

- Use factories to generate test data
- Clean up test data after tests
- Never modify the `kevin` admin user
- Use unique identifiers for test data

### 6. Error Handling

```typescript
// GOOD: Handle potential errors
const count = await page.locator('.item').count().catch(() => 0);

// GOOD: Use conditional logic
const hasError = await page.locator('.error').isVisible().catch(() => false);
if (hasError) {
  // Handle error case
}
```

### 7. Performance

- Use parallel execution (`fullyParallel: true`)
- Avoid unnecessary waits
- Use API calls for setup/teardown instead of UI
- Mock slow API responses when needed

## Troubleshooting

### Tests Failing Locally

**Issue**: Tests pass in CI but fail locally

**Solution**:
```bash
# Clear browser cache
rm -rf ~/.cache/ms-playwright

# Reinstall browsers
npx playwright install --force

# Clear test artifacts
rm -rf test-results playwright-report
```

### Authentication Issues

**Issue**: Tests fail with authentication errors

**Solution**:
- Verify admin panel is running on http://localhost:3003
- Check test credentials are correct
- Verify kevin admin user exists in database
- Clear cookies: `await clearAuth(page)`

### Timeout Errors

**Issue**: Tests timeout waiting for elements

**Solution**:
```typescript
// Increase timeout for slow operations
await page.waitForSelector('[data-testid="result"]', {
  timeout: 30000 // 30 seconds
});

// Or set globally in playwright.config.ts
export default defineConfig({
  timeout: 60000, // 60 seconds
});
```

### Network Errors

**Issue**: API requests failing

**Solution**:
- Verify backend services are running
- Check CORS configuration
- Verify API endpoints in `packages/main-app`
- Check network tab in trace viewer

### Selector Not Found

**Issue**: Element not found with selector

**Solution**:
```typescript
// Check if element exists
const exists = await page.locator(selector).count() > 0;

// Use more flexible selector
await page.locator('button:has-text("Submit")').click();

// Wait for element to appear
await page.waitForSelector(selector, { state: 'visible' });
```

### Flaky Tests

**Issue**: Tests pass sometimes and fail other times

**Solution**:
- Avoid arbitrary timeouts
- Wait for specific conditions
- Use proper wait strategies
- Check for race conditions
- Enable retries in CI

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
});
```

### Port Already in Use

**Issue**: Cannot start services due to port conflicts

**Solution**:
```bash
# Find and kill process using port 3003
lsof -ti:3003 | xargs kill -9

# Or use a different port
PLAYWRIGHT_BASE_URL=http://localhost:3004 npx playwright test
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Project CLAUDE.md](../CLAUDE.md) - Project-specific guidelines

## Support

For issues or questions:

1. Check this documentation
2. Review test examples in `e2e/*.spec.ts`
3. Check Playwright documentation
4. Review CI workflow logs
5. Create an issue in the repository

---

**Last Updated**: 2025-10-30
**Playwright Version**: 1.56.1
**Node.js Version**: 20+
