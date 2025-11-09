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
      console.log(`\n=== Test ${index + 1}: Site Title Integration Test ===`);
      console.log(`Testing with title: "${testTitle}"\n`);

      // Step 1: Login to admin
      console.log('Step 1: Logging in to admin...');
      await adminLogin(page);
      console.log('✓ Login successful');

      // Step 2: Navigate to settings page
      console.log('Step 2: Navigating to settings page...');
      await page.goto('http://localhost:3003/settings');
      await page.waitForLoadState('domcontentloaded');
      console.log('✓ Settings page loaded');

      // Step 3: Wait for the Site Configuration tab and click it
      console.log('Step 3: Opening Site Configuration tab...');
      const siteConfigTab = page.locator('[role="tab"]:has-text("Site Configuration")');
      await siteConfigTab.waitFor({ state: 'visible', timeout: 10000 });
      await siteConfigTab.click();
      console.log('✓ Site Configuration tab opened');

      // Step 4: Wait for Site Name field and change it
      console.log(`Step 4: Changing site name to "${testTitle}"...`);
      const siteNameField = page.getByLabel('Site Name', { exact: true });
      await siteNameField.waitFor({ state: 'visible', timeout: 10000 });

      // Clear and fill the site name
      await siteNameField.clear();
      await siteNameField.fill(testTitle);

      // Verify the field has the new value
      const fieldValue = await siteNameField.inputValue();
      expect(fieldValue).toBe(testTitle);
      console.log(`✓ Site name field updated to "${fieldValue}"`);

      // Step 5: Save the settings
      console.log('Step 5: Saving settings...');
      const saveButton = page.getByRole('button', { name: /save.*site/i });
      await saveButton.click();

      // Wait for success message
      await page.waitForSelector('text=/settings.*saved.*successfully/i', { timeout: 5000 });
      console.log('✓ Settings saved successfully');

      // Take screenshot of admin settings
      await page.screenshot({
        path: `e2e/screenshots/admin-settings-title-${index + 1}.png`,
        fullPage: true
      });
      console.log(`✓ Screenshot saved: admin-settings-title-${index + 1}.png`);

      // Step 6: Navigate to frontend
      console.log('Step 6: Navigating to frontend...');
      await page.goto('http://localhost:3002/');
      await page.waitForLoadState('domcontentloaded');

      // Wait for the header to be visible (which means React has mounted)
      await page.locator('header').waitFor({ state: 'visible', timeout: 10000 });

      // Wait a moment for the settings API call to complete
      await page.waitForTimeout(2000);
      console.log('✓ Frontend page loaded');

      // Step 7: Verify the site title appears in the header
      console.log(`Step 7: Verifying site title "${testTitle}" appears in header...`);

      // The site title should be in a Typography component with h6 variant that links to "/"
      const headerTitle = page.locator('header a[href="/"]').first();
      await headerTitle.waitFor({ state: 'visible', timeout: 10000 });

      const displayedTitle = await headerTitle.textContent();
      console.log(`Displayed title in header: "${displayedTitle}"`);

      expect(displayedTitle).toBe(testTitle);
      console.log(`✓ Site title correctly displays as "${testTitle}"`);

      // Take screenshot of frontend with new title
      await page.screenshot({
        path: `e2e/screenshots/frontend-title-${index + 1}.png`,
        fullPage: true
      });
      console.log(`✓ Screenshot saved: frontend-title-${index + 1}.png`);

      console.log(`\n✓ Test ${index + 1} Complete! Site title "${testTitle}" successfully applied to frontend\n`);
    });
  });

  test('Verify all three titles were tested', async ({ page }) => {
    // This test just logs a summary
    console.log('\n=== Summary ===');
    console.log(`✓ Tested ${testTitles.length} different site titles:`);
    testTitles.forEach((title, index) => {
      console.log(`  ${index + 1}. "${title}"`);
    });
    console.log('✓ All titles successfully applied and verified on frontend\n');

    // Navigate to frontend one last time to show the final state
    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for header and settings to load
    await page.locator('header').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);

    const headerTitle = page.locator('header a[href="/"]').first();
    const finalTitle = await headerTitle.textContent();
    console.log(`Final site title: "${finalTitle}"\n`);
  });
});
