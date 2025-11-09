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

    console.log('No auth state found; logging in...');
    await page.fill('input[name="identifier"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/);
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  }

  // Step 2: Dashboard
  console.log('Step 2: Capturing Dashboard...');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/01-dashboard.png', fullPage: true });
  console.log('✓ Saved: 01-dashboard.png');

  // Step 3: Users
  console.log('Step 3: Capturing Users page...');
  await page.goto('/users');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/02-users.png', fullPage: true });
  console.log('✓ Saved: 02-users.png');

  // Step 4: Content
  console.log('Step 4: Capturing Content page...');
  await page.goto('/content');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/03-content.png', fullPage: true });
  console.log('✓ Saved: 03-content.png');

  // Step 5: Taxonomy
  console.log('Step 5: Capturing Taxonomy page...');
  await page.goto('/taxonomy');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/04-taxonomy.png', fullPage: true });
  console.log('✓ Saved: 04-taxonomy.png');

  // Step 6: Files
  console.log('Step 6: Capturing Files page...');
  await page.goto('/files');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/05-files.png', fullPage: true });
  console.log('✓ Saved: 05-files.png');

  // Step 7: Analytics
  console.log('Step 7: Capturing Analytics page...');
  await page.goto('/analytics');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/06-analytics.png', fullPage: true });
  console.log('✓ Saved: 06-analytics.png');

  // Step 8: Settings
  console.log('Step 8: Capturing Settings page...');
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/07-settings.png', fullPage: true });
  console.log('✓ Saved: 07-settings.png');

  // Step 9: Editor Test
  console.log('Step 9: Capturing Editor Test page...');
  await page.goto('/editor-test');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/08-editor-test.png', fullPage: true });
  console.log('✓ Saved: 08-editor-test.png');

  console.log('\n✅ All admin page screenshots captured successfully!');
});

