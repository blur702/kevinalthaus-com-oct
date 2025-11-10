import { test, expect } from '@playwright/test';

test.describe('Sentry Integration', () => {
  test('should initialize Sentry on admin panel', async ({ page }) => {
    // Navigate to admin panel (port 3004)
    await page.goto('http://localhost:3004');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await page.screenshot({ path: 'screenshots/sentry-01-admin-login.png' });

    // Check console for Sentry initialization
    const sentryLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Sentry') || text.includes('sentry')) {
        sentryLogs.push(text);
        console.log('Sentry log:', text);
      }
    });

    // Reload to capture Sentry initialization logs
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if Sentry is available in window object
    const sentryInitialized = await page.evaluate(() => {
      return typeof (window as any).Sentry !== 'undefined';
    });

    console.log('Sentry initialized:', sentryInitialized);
    console.log('Sentry logs captured:', sentryLogs);

    // Validate required environment variables
    if (!process.env.TEST_ADMIN_USERNAME || !process.env.TEST_ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD environment variables are required');
    }

    // Login to test authenticated pages
    await page.fill('input[name="identifier"]', process.env.TEST_ADMIN_USERNAME);
    await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD);
    await page.screenshot({ path: 'screenshots/sentry-02-login-filled.png' });

    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL(/dashboard|\/$/);
    await page.screenshot({ path: 'screenshots/sentry-03-dashboard.png' });

    // Check Sentry on authenticated page
    const sentryStillActive = await page.evaluate(() => {
      return typeof (window as any).Sentry !== 'undefined';
    });

    console.log('Sentry active after login:', sentryStillActive);

    // Test error capture by triggering a test error
    await page.evaluate(() => {
      if ((window as any).Sentry) {
        console.log('Sentry is available - capturing test message');
        (window as any).Sentry.captureMessage('Test Sentry integration from Playwright');
      }
    });

    await page.screenshot({ path: 'screenshots/sentry-04-test-complete.png' });

    // Verify Sentry is initialized - both must be true for reliable Sentry operation
    expect(sentryInitialized && sentryStillActive).toBeTruthy();
  });

  test('should initialize Sentry on frontend', async ({ page }) => {
    // Navigate to frontend (port 3002)
    await page.goto('http://localhost:3002');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'screenshots/sentry-05-frontend.png' });

    // Check if Sentry is available
    const sentryInitialized = await page.evaluate(() => {
      return typeof (window as any).Sentry !== 'undefined';
    });

    console.log('Frontend Sentry initialized:', sentryInitialized);

    // Test error capture
    await page.evaluate(() => {
      if ((window as any).Sentry) {
        console.log('Frontend Sentry is available');
        (window as any).Sentry.captureMessage('Test frontend Sentry integration');
      }
    });

    await page.screenshot({ path: 'screenshots/sentry-06-frontend-complete.png' });

    expect(sentryInitialized).toBeTruthy();
  });
});
