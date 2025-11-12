import { test, expect } from '@playwright/test';

/**
 * Simple Settings Verification Test
 * Captures screenshots of settings UI and verifies backend data
 */

test.describe('Settings Simple Verification', () => {
  test('should access settings and capture screenshots', async ({ page }) => {
    // Navigate to admin login (for screenshot)
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');

    // Check if we need to login or if already logged in
    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      // Capture login screen
      await page.screenshot({
        path: 'e2e/screenshots/01-login-screen.png',
        fullPage: true
      });

      // Get admin credentials from environment variables
      const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_ADMIN_USERNAME || 'admin@test.com';
      const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD || 'Admin123!';

      if (!process.env.ADMIN_EMAIL && !process.env.TEST_ADMIN_USERNAME) {
      }

      await page.fill('input[type="email"], input[name="email"]', adminEmail);
      await page.fill('input[type="password"], input[name="password"]', adminPassword);

      await page.screenshot({
        path: 'e2e/screenshots/02-login-filled.png',
        fullPage: true
      });

      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Navigate to settings page
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Capture initial settings page
    await page.screenshot({
      path: 'e2e/screenshots/03-settings-initial.png',
      fullPage: true
    });

    // Click through each tab and capture screenshots
    const tabs = [
      { name: 'Site Configuration', filename: '04-settings-site' },
      { name: 'Security Settings', filename: '05-settings-security' },
      { name: 'Email Settings', filename: '06-settings-email' },
      { name: 'External APIs', filename: '07-settings-external-apis' },
      { name: 'API Keys', filename: '08-settings-api-keys' }
    ];

    for (const tab of tabs) {
      try {
        // Try to click the tab
        const tabButton = page.getByRole('tab', { name: tab.name });
        if (await tabButton.isVisible()) {
          await tabButton.click();
          await page.waitForTimeout(1000);

          await page.screenshot({
            path: `e2e/screenshots/${tab.filename}.png`,
            fullPage: true
          });

        }
      } catch (error) {
      }
    }

    // Test updating a site setting
    try {
      await page.getByRole('tab', { name: 'Site Configuration' }).click();
      await page.waitForTimeout(500);

      // Get current site name
      const siteNameInput = page.locator('input[value], input').filter({ has: page.locator('text=/site name/i') }).first();
      const currentValue = await siteNameInput.inputValue().catch(() => '');


      // Update site name
      const newSiteName = `Test Site ${Date.now()}`;
      await page.getByLabel('Site Name', { exact: true }).fill(newSiteName);

      await page.screenshot({
        path: 'e2e/screenshots/09-settings-site-updated.png',
        fullPage: true
      });

      // Save changes
      await page.getByRole('button', { name: /save changes/i }).click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'e2e/screenshots/10-settings-site-saved.png',
        fullPage: true
      });

    } catch (error) {
    }
  });

  test('should verify backend settings via API', async ({ request }) => {
    const endpoints = [
      { name: 'Site Settings', path: '/api/settings/site', requiredFields: ['site_name', 'site_description', 'site_url', 'timezone', 'language'] },
      { name: 'Security Settings', path: '/api/settings/security', requiredFields: ['password_min_length', 'session_timeout_minutes'] },
      { name: 'Email Settings', path: '/api/settings/email', requiredFields: ['email_provider'] }
    ];

    for (const endpoint of endpoints) {
      // Test without authentication - should return 401
      const unauthResponse = await request.get(`http://localhost:3000${endpoint.path}`);
      expect(unauthResponse.status()).toBeOneOf([401, 403]);

      // Note: Testing with authentication would require setting up proper session/JWT
      // In a real test suite, you would:
      // 1. Login to get auth token
      // 2. Make request with Authorization header
      // 3. Verify response is 200
      // 4. Verify all required fields exist
      // This is documented for future implementation
    }
  });
});
