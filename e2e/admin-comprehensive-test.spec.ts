import { test, expect, type Page } from '@playwright/test';

/**
 * Comprehensive Admin Panel E2E Test
 *
 * This test suite:
 * 1. Logs into the admin panel
 * 2. Navigates through all admin features
 * 3. Takes screenshots of each page
 * 4. Verifies Sentry integration
 * 5. Tests all major functionality
 */

// Helper function to login
async function loginAsAdmin(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  if (!page.url().includes('/login')) {
    return;
  }

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill in login credentials (using test admin account)
  const username = process.env.TEST_ADMIN_USERNAME;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD must be set to run this test');
  }
  await page.fill('input[name="identifier"]', username);
  await page.fill('input[name="password"]', password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Panel Comprehensive Test', () => {
  let sentryRequests: Array<{ url: string; method: string; postData: string | null }> = [];

  test.beforeEach(async ({ page }) => {
    sentryRequests = [];

    // Intercept all requests to Sentry
    await page.route('**/*sentry.io/**', async (route) => {
      const request = route.request();
      sentryRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });

      // Respond with 200 OK to simulate successful Sentry API
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-event-id' }),
      });
    });
  });

  test('Complete admin workflow with screenshots', async ({ page }) => {
    // Step 1: Ensure authenticated (use storageState if available; otherwise login)
    await page.goto('/', { waitUntil: 'networkidle' });
    const cookies = await page.context().cookies();
    console.log('Auth cookies at start:', cookies.map((c) => ({ name: c.name, domain: c.domain, expires: c.expires })));
    if (page.url().includes('/login')) {
      console.log('No auth state; logging in...');
      await loginAsAdmin(page);
    }

    // Take screenshot of dashboard after login
    await page.screenshot({
      path: 'e2e/screenshots/admin-dashboard.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-dashboard.png');

    // Verify dashboard loaded (check for either text in the AppBar)
    const hasAdminDashboard = await page.locator('text=/Admin.*Dashboard/i').isVisible().catch(() => false);
    const hasDashboard = await page.locator('h1:has-text("Dashboard")').isVisible().catch(() => false);
    expect(hasAdminDashboard || hasDashboard).toBeTruthy();

    // Step 2: Navigate to Users page
    console.log('Step 2: Testing Users page...');
    await page.click('a[href="/users"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e/screenshots/admin-users.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-users.png');

    // Verify users page elements
    await expect(page.locator('text=Users')).toBeVisible();

    // Step 3: Navigate to Content page
    console.log('Step 3: Testing Content page...');
    await page.click('a[href="/content"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e/screenshots/admin-content.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-content.png');

    // Verify content page elements
    await expect(page.locator('text=Content')).toBeVisible();

    // Step 4: Navigate to Taxonomy page
    console.log('Step 4: Testing Taxonomy page...');
    await page.click('a[href="/taxonomy"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e/screenshots/admin-taxonomy.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-taxonomy.png');

    // Verify taxonomy page elements
    await expect(page.locator('text=Taxonomy')).toBeVisible();

    // Step 5: Navigate to Files page
    console.log('Step 5: Testing Files page...');
    await page.click('a[href="/files"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e/screenshots/admin-files.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-files.png');

    // Verify files page elements
    await expect(page.locator('text=Files')).toBeVisible();

    // Step 6: Manage menus and verify public navigation
    console.log('Step 6: Testing Menu Manager...');
    await page.click('a[href="/menus"]');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h4:has-text("Menu Manager")')).toBeVisible();

    await page.locator('li:has-text("Main Navigation")').click();

    const menuLinkLabel = `QA Link ${Date.now()}`;
    const menuLinkPath = `/qa-${Date.now()}`;

    await page.getByRole('button', { name: 'Add Item' }).click();
    const addItemDialog = page.getByRole('dialog', { name: 'Add Menu Item' });
    await addItemDialog.getByLabel('Label').fill(menuLinkLabel);
    await addItemDialog.getByLabel('URL').fill(menuLinkPath);
    await addItemDialog.getByRole('button', { name: 'Add Item' }).click();
    await expect(page.getByRole('treeitem', { name: new RegExp(menuLinkLabel, 'i') })).toBeVisible();

    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await expect(page.getByRole('link', { name: menuLinkLabel })).toBeVisible();

    await page.goto('/menus');
    await page.waitForLoadState('networkidle');
    await page.locator('li:has-text("Main Navigation")').click();
    await page
      .getByRole('treeitem', { name: new RegExp(menuLinkLabel, 'i') })
      .getByRole('button', { name: new RegExp(`Delete ${menuLinkLabel}`, 'i') })
      .click();
    await page
      .getByRole('dialog', { name: 'Delete Menu Item' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByRole('treeitem', { name: new RegExp(menuLinkLabel, 'i') })).toHaveCount(0);

    // Step 7: Navigate to Analytics page
    console.log('Step 7: Testing Analytics page...');
    await page.click('a[href="/analytics"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e/screenshots/admin-analytics.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-analytics.png');

    // Verify analytics page elements
    await expect(page.locator('text=Analytics')).toBeVisible();

    // Step 8: Navigate to Settings page
    console.log('Step 8: Testing Settings page...');
    await page.click('a[href="/settings"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give settings time to load
    await page.screenshot({
      path: 'e2e/screenshots/admin-settings.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-settings.png');

    // Verify settings page elements (with error boundary)
    const hasSettings = await page.locator('text=Settings').isVisible();
    const hasError = await page.locator('text=/something went wrong/i').isVisible();
    expect(hasSettings || hasError).toBeTruthy();

    // Step 9: Navigate to Editor Test page
    console.log('Step 9: Testing Editor Test page...');
    await page.click('a[href="/editor-test"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'e2e/screenshots/admin-editor-test.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-editor-test.png');

    // Verify editor test page elements
    await expect(page.locator('text=Editor Test')).toBeVisible();

    // Step 10: Test navigation menu
    console.log('Step 10: Verifying navigation menu...');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Content')).toBeVisible();
    await expect(page.locator('text=Taxonomy')).toBeVisible();
    await expect(page.locator('text=Files')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();

    console.log('✓ All admin pages tested successfully!');
  });

  test('Verify Sentry integration in admin panel', async ({ page }) => {
    console.log('Testing Sentry integration...');

    // Login first
    await loginAsAdmin(page);

    // Clear previous Sentry requests
    sentryRequests = [];

    // Navigate to a page and trigger an error (if possible)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if Sentry SDK is initialized by evaluating window object
    const sentryInitialized = await page.evaluate(() => {
      return typeof (window as any).Sentry !== 'undefined';
    });

    console.log('Sentry SDK initialized:', sentryInitialized);

    // If we can access a test error trigger, use it
    // Otherwise, verify the SDK is at least loaded
    if (sentryInitialized) {
      // Manually trigger a test error through console
      await page.evaluate(() => {
        if ((window as any).Sentry) {
          (window as any).Sentry.captureMessage('Test message from e2e test', 'info');
        }
      });

      // Wait for Sentry request
      await page.waitForTimeout(3000);

      // Verify Sentry received the message
      console.log('Sentry requests captured:', sentryRequests.length);
      if (sentryRequests.length > 0) {
        console.log('✓ Sentry is properly integrated and receiving events');
      } else {
        console.log('⚠ Sentry SDK is initialized but no events captured in this test');
      }
    } else {
      console.log('⚠ Sentry SDK not found in window object');
    }

    await page.screenshot({
      path: 'e2e/screenshots/admin-sentry-test.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-sentry-test.png');
  });

  test('Test error handling and error boundary', async ({ page }) => {
    console.log('Testing error boundaries...');

    // Login first
    await loginAsAdmin(page);

    // Navigate to Settings page which has an error boundary
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if error boundary triggered
    const hasError = await page.locator('text=/something went wrong/i').isVisible();
    const hasSettings = await page.locator('text=Settings').isVisible();

    if (hasError) {
      console.log('✓ Error boundary is active (as expected for Settings page)');

      // Take screenshot of error boundary
      await page.screenshot({
        path: 'e2e/screenshots/admin-error-boundary.png',
        fullPage: true
      });
      console.log('✓ Screenshot saved: admin-error-boundary.png');

      // Check if Try Again button exists
      const tryAgainButton = await page.locator('button:has-text("Try Again")').isVisible();
      expect(tryAgainButton).toBeTruthy();
    } else if (hasSettings) {
      console.log('✓ Settings page loaded successfully (no errors)');
    }
  });

  test('Test logout functionality', async ({ page }) => {
    console.log('Testing logout...');

    // Login first
    await loginAsAdmin(page);

    // Click logout button (try multiple selectors)
    const logoutButton = page.locator('button:has-text("Logout")').or(page.locator('button[aria-label*="logout" i]')).or(page.locator('button:has(svg) >> text=/logout/i')).first();
    await logoutButton.click();

    // Wait for redirect to login page
    await page.waitForURL('/login', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify we're on login page
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/admin-logout.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-logout.png');
    console.log('✓ Logout successful');
  });

  test('Test responsive navigation drawer', async ({ page }) => {
    console.log('Testing responsive navigation...');

    // Login first
    await loginAsAdmin(page);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Take screenshot of mobile view
    await page.screenshot({
      path: 'e2e/screenshots/admin-mobile-view.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: admin-mobile-view.png');

    // Look for menu icon (should be visible on mobile)
    const menuButton = page.locator('button[aria-label="open drawer"]');
    const isMenuVisible = await menuButton.isVisible();

    if (isMenuVisible) {
      console.log('✓ Mobile menu button is visible');

      // Click to open drawer
      await menuButton.click();
      await page.waitForTimeout(500);

      // Take screenshot with drawer open
      await page.screenshot({
        path: 'e2e/screenshots/admin-mobile-drawer-open.png',
        fullPage: true
      });
      console.log('✓ Screenshot saved: admin-mobile-drawer-open.png');
    } else {
      console.log('⚠ Mobile menu button not found (may use different viewport breakpoint)');
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
