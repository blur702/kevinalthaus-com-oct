import { test, expect } from '@playwright/test';
import { adminLogin } from './test-helpers';

/**
 * Simple Settings Test - Quick verification that settings page loads
 */

test.describe('Simple Settings Test', () => {
  test('Login and navigate to settings', async ({ page }) => {
    console.log('\n=== Simple Settings Test ===\n');

    // Login as admin
    await adminLogin(page);
    console.log('✓ Login successful');

    // Navigate to settings page
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');
    console.log('✓ Settings page loaded');

    // Wait for the Settings heading to be visible
    await page.waitForSelector('h1:has-text("Settings")', { timeout: 10000 });
    console.log('✓ Settings heading found');

    // Wait for Site Configuration tab to be visible
    await page.waitForSelector('[role="tab"]:has-text("Site Configuration")', { timeout: 10000 });
    console.log('✓ Site Configuration tab found');

    // Wait for Site Name field to be visible
    const siteNameField = page.locator('input[name="site_name"], input[id*="site_name"], input[placeholder*="site"]').first();
    await siteNameField.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Site Name field is visible');

    // Get the value
    const siteNameValue = await siteNameField.inputValue();
    console.log(`Current Site Name value: "${siteNameValue}"`);

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/simple-settings-test.png', fullPage: true });
    console.log('✓ Screenshot captured');

    console.log('\n✓ Simple Settings Test Complete!\n');
  });
});
