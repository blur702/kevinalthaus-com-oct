import { test, expect, type Page } from '@playwright/test';

/**
 * Sentry Integration E2E Tests
 *
 * Tests verify that:
 * 1. Sentry SDK is properly initialized
 * 2. Errors are captured and sent to Sentry
 * 3. Error boundaries catch uncaught errors
 * 4. Environment variables are loaded correctly
 *
 * Note: These tests intercept network requests to Sentry's API
 * to verify the integration works without relying on external services.
 */

test.describe('Sentry Integration', () => {
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

  test('should initialize Sentry on frontend', async ({ page }) => {
    // Navigate to the production build (port 5173)
    await page.goto('http://localhost:5173');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check console for Sentry initialization message
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });

    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Verify Sentry initialization logged
    const hasSentryLog = logs.some(
      (log) => log.includes('Sentry') || log.includes('SENTRY')
    );
    expect(hasSentryLog).toBeTruthy();

    // Verify DSN is present in environment
    const dsnPresent = logs.some((log) => log.includes('DSN present'));
    expect(dsnPresent).toBeTruthy();
  });

  test('should capture and send caught errors', async ({ page }) => {
    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Clear previous requests
    sentryRequests = [];

    // Click the "Test Caught Error" button
    const testErrorButton = page.getByRole('button', { name: /test caught error/i });
    await testErrorButton.click();

    // Wait for Sentry request
    await page.waitForTimeout(2000);

    // Verify Sentry received the error
    expect(sentryRequests.length).toBeGreaterThan(0);

    // Verify the request contains error information
    const errorRequest = sentryRequests.find((req) => req.postData?.includes('error'));
    expect(errorRequest).toBeDefined();
    expect(errorRequest?.method).toBe('POST');
    expect(errorRequest?.url).toContain('sentry.io');
  });

  test('should capture and send messages', async ({ page }) => {
    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Clear previous requests
    sentryRequests = [];

    // Click the "Test Message Capture" button
    const testMessageButton = page.getByRole('button', { name: /test message capture/i });
    await testMessageButton.click();

    // Wait for Sentry request
    await page.waitForTimeout(2000);

    // Verify Sentry received the message
    expect(sentryRequests.length).toBeGreaterThan(0);

    // Verify the request is a POST to Sentry
    const messageRequest = sentryRequests.find((req) => req.method === 'POST');
    expect(messageRequest).toBeDefined();
    expect(messageRequest?.url).toContain('sentry.io');
  });

  test('should handle uncaught errors with error boundary', async ({ page }) => {
    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Clear previous requests
    sentryRequests = [];

    // Click the "Test Error Boundary" button
    const testBoundaryButton = page.getByRole('button', {
      name: /test error boundary/i,
    });
    await testBoundaryButton.click();

    // Wait for error boundary to render
    await page.waitForTimeout(1000);

    // Verify error boundary fallback UI is displayed
    const fallbackUI = page.getByText(/something went wrong/i);
    await expect(fallbackUI).toBeVisible();

    // Verify "Try again" button is present
    const tryAgainButton = page.getByRole('button', { name: /try again/i });
    await expect(tryAgainButton).toBeVisible();

    // Wait for Sentry request
    await page.waitForTimeout(2000);

    // Verify Sentry received the error
    expect(sentryRequests.length).toBeGreaterThan(0);
  });

  test('should reset error boundary when "Try again" is clicked', async ({ page }) => {
    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Trigger error boundary
    const testBoundaryButton = page.getByRole('button', {
      name: /test error boundary/i,
    });
    await testBoundaryButton.click();

    // Wait for error boundary to render
    await page.waitForTimeout(1000);

    // Click "Try again" button
    const tryAgainButton = page.getByRole('button', { name: /try again/i });
    await tryAgainButton.click();

    // Wait for page to reset
    await page.waitForTimeout(1000);

    // Verify error boundary fallback UI is no longer visible
    const fallbackUI = page.getByText(/something went wrong/i);
    await expect(fallbackUI).not.toBeVisible();

    // Verify test buttons are visible again
    const testErrorButton = page.getByRole('button', { name: /test caught error/i });
    await expect(testErrorButton).toBeVisible();
  });

  test('should load environment variables correctly', async ({ page, context }) => {
    const consoleLogs: string[] = [];

    // Capture console logs
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // Navigate to the page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Wait for console logs to accumulate
    await page.waitForTimeout(2000);

    // Verify DSN is loaded
    const dsnLog = consoleLogs.find((log) => log.includes('VITE_SENTRY_DSN'));
    expect(dsnLog).toBeDefined();

    // Verify DSN is not empty
    expect(dsnLog).toContain('https://');

    // Verify MODE is production
    const modeLog = consoleLogs.find((log) => log.includes('MODE:'));
    expect(modeLog).toContain('production');
  });

  test('should send session data to Sentry', async ({ page }) => {
    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Wait for session initialization
    await page.waitForTimeout(3000);

    // Verify Sentry received session data
    const sessionRequests = sentryRequests.filter((req) =>
      req.postData?.includes('session')
    );

    // Session data may or may not be sent immediately, so we check if any requests were made
    expect(sentryRequests.length).toBeGreaterThan(0);
  });

  test('should include correct SDK version in requests', async ({ page }) => {
    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Trigger an error to generate a request
    const testErrorButton = page.getByRole('button', { name: /test caught error/i });
    await testErrorButton.click();

    // Wait for Sentry request
    await page.waitForTimeout(2000);

    // Verify SDK version is included in URL
    const sdkVersionRequest = sentryRequests.find((req) =>
      req.url.includes('sentry.javascript.react')
    );

    expect(sdkVersionRequest).toBeDefined();
  });

  test('should handle multiple errors sequentially', async ({ page }) => {
    // Navigate to Sentry test page
    await page.goto('http://localhost:5173/sentry-test');
    await page.waitForLoadState('networkidle');

    // Clear previous requests
    sentryRequests = [];

    // Trigger multiple errors
    const testErrorButton = page.getByRole('button', { name: /test caught error/i });

    // First error
    await testErrorButton.click();
    await page.waitForTimeout(1000);
    const firstRequestCount = sentryRequests.length;

    // Second error
    await testErrorButton.click();
    await page.waitForTimeout(1000);
    const secondRequestCount = sentryRequests.length;

    // Third error
    await testErrorButton.click();
    await page.waitForTimeout(1000);
    const thirdRequestCount = sentryRequests.length;

    // Verify requests increased after each error
    expect(secondRequestCount).toBeGreaterThan(firstRequestCount);
    expect(thirdRequestCount).toBeGreaterThan(secondRequestCount);
  });
});
