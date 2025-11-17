# Logout Workflow Implementation Plan

This document provides a comprehensive plan for implementing the admin login/logout workflow with screenshots and console monitoring for the E2E test suite.

### Observations

**Key Findings:**

1. **Environment Configuration**: The `playwright.config.ts` uses `baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'` for environment switching. The admin panel runs on port 3002 locally.

2. **Authentication Patterns**: The `e2e/utils/auth.ts` provides `TEST_CREDENTIALS.ADMIN` with username and password from TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD environment variables with fallbacks.

3. **Console Monitoring Pattern**: The `e2e/test-dogs-post-with-console.spec.ts` demonstrates comprehensive console monitoring using `page.on('console', ...)` and `page.on('pageerror', ...)` with separate arrays for errors, warnings, and messages.

4. **Screenshot Convention**: Tests store screenshots in `e2e/screenshots/` directory with descriptive names and use `fullPage: true` option.

5. **Logout Button Mismatch**: The `e2e/utils/selectors.ts` defines `navigation.logoutButton: '[data-testid="logout-button"]'`, but the actual implementation in `packages/admin/src/App.tsx` (line 133) is a simple `<Button>` with text "Logout" and `startIcon={<LogoutIcon />}` without a `data-testid` attribute. The existing `logout()` function in `e2e/utils/auth.ts` (lines 143-151) also uses the incorrect selector.

6. **Test Structure**: Existing tests like `e2e/test-admin-login.spec.ts` show the pattern of using `test.describe()` blocks and waiting for dashboard visibility after login.

### Approach

Create a new Playwright test file `e2e/task-admin-login-logout.spec.ts` that implements Task 1: admin login with screenshot and logout. The test will support both local and production environments via environment variables, use existing authentication utilities from `e2e/utils/auth.ts`, implement comprehensive console monitoring patterns from `e2e/test-dogs-post-with-console.spec.ts`, and follow screenshot conventions from `e2e/manual-admin-screenshots.spec.ts`. The logout implementation will use a text-based selector to match the actual button in `packages/admin/src/App.tsx` since the current `data-testid` selector in `e2e/utils/selectors.ts` doesn't match the implementation.

### Reasoning

I explored the repository structure, read the relevant test files to understand existing patterns for authentication, console monitoring, and screenshots. I examined the authentication utilities, test helpers, and the actual logout button implementation in the admin app. I also reviewed the Playwright configuration files to understand environment variable support and baseURL configuration for local vs production testing.

## Mermaid Diagram

sequenceDiagram
    participant Test as Task 1 Test
    participant Browser as Browser Page
    participant Console as Console Monitor
    participant Admin as Admin Panel
    participant Auth as Auth System

    Note over Test: Setup console monitoring
    Test->>Console: Listen to console events
    Test->>Console: Listen to page errors
    
    Note over Test: Login Flow
    Test->>Browser: Navigate to /login
    Browser->>Admin: Load login page
    Test->>Browser: Fill username (kevin)
    Test->>Browser: Fill password (TEST_ADMIN_PASSWORD)
    Test->>Browser: Click submit button
    Browser->>Auth: POST /api/auth/login
    Auth-->>Browser: Set auth cookies
    Browser->>Admin: Redirect to dashboard
    
    Note over Test: Verify & Screenshot
    Test->>Browser: Wait for dashboard URL
    Test->>Browser: Verify "Dashboard" heading
    Test->>Browser: Wait 500-1000ms for render
    Test->>Browser: Take full-page screenshot
    Note over Browser: Screenshot saved to<br/>e2e/screenshots/task1-admin-logged-in.png
    
    Note over Test: Logout Flow
    Test->>Browser: Click "Logout" button
    Browser->>Auth: Clear auth cookies
    Browser->>Admin: Redirect to /login
    Test->>Browser: Wait for login URL
    Test->>Browser: Verify on login page
    
    Note over Test: Console Analysis
    Console-->>Test: Return collected errors
    Console-->>Test: Return collected warnings
    Test->>Test: Assert errors ≤ 5
    Test->>Test: Log console summary
    
    Note over Test: Test Complete ✓

## Proposed File Changes

### e2e\task-admin-login-logout.spec.ts(NEW)

References: 

- e2e\utils\auth.ts(MODIFY)
- e2e\test-dogs-post-with-console.spec.ts
- e2e\manual-admin-screenshots.spec.ts
- e2e\test-admin-login.spec.ts
- packages\admin\src\App.tsx(MODIFY)

Create a new Playwright test file for Task 1 that implements admin login, screenshot capture, and logout with console monitoring.

**Test Structure:**
- Use `test.describe()` block titled 'Task 1: Admin Login and Logout with Screenshots'
- Declare arrays at the top of the describe block to collect console messages: `consoleErrors`, `consoleWarnings`, and `consoleMessages`
- Implement a single test case: 'should login as kevin, take screenshot, and logout successfully'

**Environment Configuration:**
- Use `process.env.PLAYWRIGHT_BASE_URL` to determine the base URL, with fallback to 'http://localhost:3002' for local testing
- Support production testing by setting `PLAYWRIGHT_BASE_URL=https://kevinalthaus.com` environment variable
- Add a comment at the top explaining how to run against different environments

**Console Monitoring Setup:**
- Set up console monitoring using `page.on('console', (msg: ConsoleMessage) => {...})` pattern from `e2e/test-dogs-post-with-console.spec.ts`
- Capture console errors, warnings, and info/log messages in separate arrays
- Set up page error monitoring using `page.on('pageerror', (error) => {...})` to catch uncaught exceptions
- Import `ConsoleMessage` type from '@playwright/test'

**Login Flow:**
- Navigate to '/login' using relative path (relies on baseURL from config)
- Wait for the login form to be visible using `page.waitForSelector('input[name="identifier"]')`
- Fill credentials using `TEST_CREDENTIALS.ADMIN.username` and `TEST_CREDENTIALS.ADMIN.password` from `e2e/utils/auth.ts`
- Click the submit button using selector `button[type="submit"]`
- Wait for successful redirect to dashboard using `page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 })`
- Verify dashboard is visible by checking for `h1:has-text("Dashboard")` element
- Add a small delay (500-1000ms) to ensure the page is fully rendered before screenshot

**Screenshot After Login:**
- Take a full-page screenshot using `page.screenshot({ path: 'e2e/screenshots/task1-admin-logged-in.png', fullPage: true })`
- Use descriptive filename that clearly indicates this is from Task 1

**Logout Flow:**
- Click the logout button using the **recommended role-based selector**: `page.getByRole('button', { name: 'Logout' })` for semantic, accessible selection
- Fallback option (if button lacks accessible role): Use text-based selector `page.click('button:has-text("Logout")')` when the button doesn't have proper accessibility attributes
- Wait for redirect to login page using `page.waitForURL('**/login', { timeout: 5000 })`
- Verify we're on the login page by checking the URL or presence of login form

**Note:** The actual button in `packages/admin/src/App.tsx` doesn't have a `data-testid` attribute, so role-based or text-based selectors are required.

**Console Analysis:**
- After logout, log the count of console errors and warnings
- Use soft assertions or informational logging for console messages (don't fail the test unless critical errors occur)
- Consider that some warnings (React dev mode, etc.) are expected and acceptable
- Assert that critical console errors are minimal: `expect(consoleErrors.length).toBeLessThanOrEqual(5)`

**Imports Required:**
- `import { test, expect, ConsoleMessage } from '@playwright/test'`
- `import { TEST_CREDENTIALS } from './utils/auth'`

**Test Timeout:**
- Set test timeout to 60000ms (60 seconds) using `test.setTimeout(60000)` to account for potential network delays in production

**Documentation Comments:**
- Add comprehensive JSDoc comment at the top explaining:
  - What Task 1 accomplishes
  - How to run the test (see examples below)
  - Where screenshots are saved
  - That console monitoring is active throughout the test

**Running the test:**

```bash
# Local testing
npx playwright test e2e/task-admin-login-logout.spec.ts

# Production testing
PLAYWRIGHT_BASE_URL=https://kevinalthaus.com npx playwright test e2e/task-admin-login-logout.spec.ts
```

### e2e\utils\auth.ts(MODIFY)

References: 

- packages\admin\src\App.tsx(MODIFY)

**Optional Enhancement (Recommended but not required for Task 1):**

Update the `logout()` function (lines 143-151) to use a selector that matches the actual implementation in `packages/admin/src/App.tsx`.

**Current Issue:**
- The function uses `[data-testid="user-menu"]` and `[data-testid="logout-button"]` selectors
- The actual logout button in `packages/admin/src/App.tsx` (line 133) is a simple `<Button>` with text "Logout" and doesn't have these test IDs

**Recommended Changes:**
- Replace the selector approach with text-based or role-based selectors
- Use `page.getByRole('button', { name: 'Logout' })` or `page.click('button:has-text("Logout")')`
- Remove the user menu click step since the logout button is directly in the AppBar toolbar
- Update the function to be more resilient and match the actual UI structure

**Alternative Approach:**
- If you prefer to keep test IDs for stability, add `data-testid="logout-button"` to the logout button in `packages/admin/src/App.tsx` line 133
- This would make the existing `logout()` function work correctly

**Note:** For Task 1, you can implement the logout directly in the test file using the correct selector, and defer this utility function update to a later refactoring session.

### e2e\utils\selectors.ts(MODIFY)

References: 

- packages\admin\src\App.tsx(MODIFY)

**Optional Enhancement (Recommended but not required for Task 1):**

Update the navigation selectors (lines 150-159) to match the actual implementation.

**Current Issue:**
- Lines 157-158 define `userMenu: '[data-testid="user-menu"]'` and `logoutButton: '[data-testid="logout-button"]'`
- These selectors don't match the actual implementation in `packages/admin/src/App.tsx`

**Recommended Changes:**
- Update `logoutButton` selector to: `'button:has-text("Logout")'` or document that it requires a role-based selector
- Remove or update the `userMenu` selector since the logout button is directly in the toolbar, not in a dropdown menu
- Add a comment explaining that these selectors should be kept in sync with the actual UI implementation

**Alternative Approach:**
- Add the corresponding `data-testid` attributes to the components in `packages/admin/src/App.tsx` to match these selectors
- This provides more stable selectors that won't break if button text changes

**Note:** For Task 1, you can use inline selectors in the test file and defer this centralized selector update to a later refactoring session.

### packages\admin\src\App.tsx(MODIFY)

References: 

- e2e\utils\selectors.ts(MODIFY)
- e2e\utils\auth.ts(MODIFY)

**Optional Enhancement (Recommended for better test stability):**

Add `data-testid` attribute to the logout button for more reliable E2E testing.

**Location:** Line 133, the logout `<Button>` component in the `<Toolbar>`

**Recommended Change:**
- Add `data-testid="logout-button"` prop to the Button component
- This would make the button match the selector defined in `e2e/utils/selectors.ts` (line 158)
- Improves test stability by providing a selector that won't break if button text or styling changes

**Current Implementation:**
The button currently has: `color="inherit"`, `onClick={handleLogout}`, and `startIcon={<LogoutIcon />}` with text "Logout"

**Benefits:**
- Makes the existing `logout()` function in `e2e/utils/auth.ts` work correctly
- Aligns with the test ID pattern already defined in `e2e/utils/selectors.ts`
- Provides a stable selector for automated testing

**Note:** This is not required for Task 1 to work, as the test can use text-based selectors. However, it's a best practice for E2E testing and would prevent future test breakage if the button text is internationalized or changed.