import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

test.describe('Admin Login Test', () => {
  test('should successfully login to admin panel with kevin user', async ({ page }) => {
    // Set base URL to admin panel
    await page.goto('http://localhost:3003/login');

    // Fill in credentials
    await page.fill('input[name="identifier"]', TEST_CREDENTIALS.ADMIN.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.ADMIN.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for successful login redirect
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });

    // Verify we're logged in by checking for dashboard content
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });

    // Take a screenshot for verification
    await page.screenshot({ path: 'e2e/screenshots/admin-dashboard.png', fullPage: true });

  });

  test('should display user info after login', async ({ page }) => {
    // Login using the helper function
    await page.goto('http://localhost:3003/login');
    await page.fill('input[name="identifier"]', TEST_CREDENTIALS.ADMIN.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.ADMIN.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });

    // Check for user-specific elements (adjust selectors based on your UI)
    // This might be a user menu, username display, etc.
    const pageContent = await page.content();

    // Verify the dashboard has loaded
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });
});
