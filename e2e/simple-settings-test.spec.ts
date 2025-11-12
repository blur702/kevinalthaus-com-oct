import { test, expect } from '@playwright/test';
import { adminLogin } from './test-helpers';

/**
 * Simple Settings Test - Quick verification that settings page loads
 */

test.describe('Simple Settings Test', () => {
  test('Login and navigate to settings', async ({ page }) => {

    // Login as admin
    await adminLogin(page);

    // Navigate to settings page
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');

    // Wait for the Settings heading to be visible
    await page.waitForSelector('h1:has-text("Settings")', { timeout: 10000 });

    // Wait for Site Configuration tab to be visible
    await page.waitForSelector('[role="tab"]:has-text("Site Configuration")', { timeout: 10000 });

    // Wait for Site Name field to be visible
    const siteNameField = page.locator('input[name="site_name"], input[id*="site_name"], input[placeholder*="site"]').first();
    await siteNameField.waitFor({ state: 'visible', timeout: 10000 });

    // Get the value
    const siteNameValue = await siteNameField.inputValue();

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/simple-settings-test.png', fullPage: true });

  });
});
