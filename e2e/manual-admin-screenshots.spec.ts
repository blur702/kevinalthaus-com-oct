import { test, expect } from '@playwright/test';

/**
 * Manual Admin Screenshots Test
 * This test logs in once and captures screenshots of all admin pages
 */

test('Capture screenshots of all admin pages', async ({ page }) => {
  // Attempt to use existing authenticated state; if redirected to login, perform login with env vars
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForLoadState('networkidle');

  if (page.url().includes('/login')) {
    const username = process.env.TEST_ADMIN_USERNAME;
    const password = process.env.TEST_ADMIN_PASSWORD;
    if (!username || !password) {
      throw new Error('TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD must be set to run this test');
    }

    await page.fill('input[name="identifier"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/);
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  }

  // Step 2: Dashboard
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/01-dashboard.png', fullPage: true });

  // Step 3: Users
  await page.goto('/users');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/02-users.png', fullPage: true });

  // Step 4: Content
  await page.goto('/content');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/03-content.png', fullPage: true });

  // Step 5: Taxonomy
  await page.goto('/taxonomy');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/04-taxonomy.png', fullPage: true });

  // Step 6: Files
  await page.goto('/files');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/05-files.png', fullPage: true });

  // Step 7: Analytics
  await page.goto('/analytics');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/06-analytics.png', fullPage: true });

  // Step 8: Settings
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/07-settings.png', fullPage: true });

  // Step 9: Editor Test
  await page.goto('/editor-test');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/08-editor-test.png', fullPage: true });

});

