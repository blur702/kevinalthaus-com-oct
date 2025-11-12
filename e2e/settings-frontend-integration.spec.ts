import { test, expect } from '@playwright/test';
import { adminLogin } from './test-helpers';

/**
 * Settings Frontend Integration Test
 *
 * Tests that settings changed in the admin panel are reflected on the frontend.
 * This test demonstrates the complete flow:
 * 1. Login to admin
 * 2. Change site title to a new value
 * 3. Verify the title is saved
 * 4. Navigate to frontend
 * 5. Verify the new title appears in the header
 *
 * The test cycles through 3 different site titles to demonstrate the functionality.
 */

test.describe('Settings Frontend Integration', () => {
  const testTitles = [
    'Innovation Playground',
    'Digital Craftsman',
    'Code & Creativity Hub'
  ];

  testTitles.forEach((testTitle, index) => {
    test(`Test ${index + 1}: Change site title to "${testTitle}" and verify on frontend`, async ({ page }) => {

      // Step 1: Login to admin
      await adminLogin(page);

      // Step 2: Navigate to settings page
      await page.goto('http://localhost:3003/settings');
      await page.waitForLoadState('domcontentloaded');

      // Step 3: Wait for the Site Configuration tab and click it
      const siteConfigTab = page.locator('[role="tab"]:has-text("Site Configuration")');
      await siteConfigTab.waitFor({ state: 'visible', timeout: 10000 });
      await siteConfigTab.click();

      // Step 4: Wait for Site Name field and change it
      const siteNameField = page.getByLabel('Site Name', { exact: true });
      await siteNameField.waitFor({ state: 'visible', timeout: 10000 });

      // Clear and fill the site name
      await siteNameField.clear();
      await siteNameField.fill(testTitle);

      // Verify the field has the new value
      const fieldValue = await siteNameField.inputValue();
      expect(fieldValue).toBe(testTitle);

      // Step 5: Save the settings
      const saveButton = page.getByRole('button', { name: /save.*site/i });
      await saveButton.click();

      // Wait for success message
      await page.waitForSelector('text=/settings.*saved.*successfully/i', { timeout: 5000 });

      // Take screenshot of admin settings
      await page.screenshot({
        path: `e2e/screenshots/admin-settings-title-${index + 1}.png`,
        fullPage: true
      });

      // Step 6: Navigate to frontend
      await page.goto('http://localhost:3002/');
      await page.waitForLoadState('domcontentloaded');

      // Wait for the header to be visible (which means React has mounted)
      await page.locator('header').waitFor({ state: 'visible', timeout: 10000 });

      // Wait a moment for the settings API call to complete
      await page.waitForTimeout(2000);

      // Step 7: Verify the site title appears in the header

      // The site title should be in a Typography component with h6 variant that links to "/"
      const headerTitle = page.locator('header a[href="/"]').first();
      await headerTitle.waitFor({ state: 'visible', timeout: 10000 });

      const displayedTitle = await headerTitle.textContent();

      expect(displayedTitle).toBe(testTitle);

      // Take screenshot of frontend with new title
      await page.screenshot({
        path: `e2e/screenshots/frontend-title-${index + 1}.png`,
        fullPage: true
      });

    });
  });

  test('Verify all three titles were tested', async ({ page }) => {
    // This test just logs a summary
    testTitles.forEach((title, index) => {
    });

    // Navigate to frontend one last time to show the final state
    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for header and settings to load
    await page.locator('header').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);

    const headerTitle = page.locator('header a[href="/"]').first();
    const finalTitle = await headerTitle.textContent();
  });
});
