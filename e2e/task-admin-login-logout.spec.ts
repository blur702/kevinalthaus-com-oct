import { test, expect, ConsoleMessage } from '@playwright/test';
import { TEST_CREDENTIALS } from './utils/auth';

/**
 * Task 1: Admin login + logout workflow with screenshot capture and console monitoring.
 *
 * Run locally:
 *   npx playwright test e2e/task-admin-login-logout.spec.ts
 *
 * Run against production:
 *   PLAYWRIGHT_BASE_URL=https://kevinalthaus.com npx playwright test e2e/task-admin-login-logout.spec.ts
 *
 * Screenshots are written to e2e/screenshots and the test watches the browser console
 * for errors/warnings throughout the flow.
 */
test.describe('Task 1: Admin Login and Logout with Screenshots', () => {
  test('should login as kevin, take screenshot, and logout successfully', async ({ page }) => {
    test.setTimeout(60000);

    // Test-level console collectors to ensure test isolation
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const consoleMessages: string[] = [];

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002';
    console.log(`[Task 1] Using base URL ${baseUrl}`);

    // Register console listeners at test scope
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      const type = msg.type();

      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      } else if (type === 'log' || type === 'info') {
        consoleMessages.push(text);
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="identifier"]', { state: 'visible', timeout: 15000 });

    await page.fill('input[name="identifier"]', TEST_CREDENTIALS.ADMIN.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.ADMIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(dashboard)?\/?$/, { timeout: 10000 });
    const dashboardHeading = page.locator('h1:has-text("Dashboard")');
    await expect(dashboardHeading).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(750);
    await page.screenshot({
      path: 'e2e/screenshots/task1-admin-logged-in.png',
      fullPage: true,
    });

    const logoutButton = page.getByRole('button', { name: 'Logout' });
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
    await logoutButton.click();

    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page.locator('input[name="identifier"]')).toBeVisible({ timeout: 5000 });

    console.log(`[Task 1] Console errors: ${consoleErrors.length}`);
    console.log(`[Task 1] Console warnings: ${consoleWarnings.length}`);
    console.log(`[Task 1] Console info/log messages: ${consoleMessages.length}`);

    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err) => console.log(`[Task 1] console.error -> ${err}`));
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });
});
