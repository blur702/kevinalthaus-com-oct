/**
 * Page Builder E2E Tests with Authentication
 * Complete workflow: Login -> Create Page -> View Frontend
 */

import { test, expect } from '@playwright/test';

test.describe('Page Builder - Full Workflow with Auth', () => {
  test('should login, create page, and view on frontend', async ({ page }) => {
    // Step 1: Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await page.screenshot({
      path: 'screenshots/01-login-page.png',
      fullPage: true
    });

    // Step 2: Perform login

    // Check if already logged in
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/admin')) {
    } else {
      // Wait for login form
      await page.waitForSelector('input[name="identifier"], input[name="username"], input[name="email"]', { timeout: 5000 });

      // Try to login with test credentials
      const identifierInput = await page.locator('input[name="identifier"], input[name="username"], input[name="email"]').first();
      const passwordInput = await page.locator('input[name="password"]').first();

      await identifierInput.fill('testadmin');
      await passwordInput.fill('TestPassword123!');

      // Screenshot before submit
      await page.screenshot({
        path: 'screenshots/02-login-filled.png',
        fullPage: true
      });

      // Submit login
      await page.click('button[type="submit"]');

      // Wait for redirect (dashboard or admin)
      await page.waitForTimeout(2000);

      // Take screenshot after login
      await page.screenshot({
        path: 'screenshots/03-after-login.png',
        fullPage: true
      });
    }

    // Step 3: Navigate to Page Builder
    await page.goto('/admin/page-builder');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot of page builder interface
    await page.screenshot({
      path: 'screenshots/04-page-builder-loaded.png',
      fullPage: true
    });

    // Step 4: Create a new page

    // Click Create New Page button
    await page.click('button:has-text("Create New Page")');
    await page.waitForSelector('#pageModal.active', { timeout: 5000 });

    // Fill in page details
    const timestamp = Date.now();
    const pageTitle = `Test Page ${timestamp}`;
    const pageSlug = `test-page-${timestamp}`;

    await page.fill('#pageTitle', pageTitle);
    await page.fill('#pageSlug', pageSlug);
    await page.fill('#pageMetaDesc', 'This is a test page created via Playwright E2E testing with full authentication flow.');
    await page.selectOption('#pageStatus', 'published'); // Set to published so we can view it

    // Take screenshot of filled form
    await page.screenshot({
      path: 'screenshots/05-create-page-form.png',
      fullPage: true
    });

    // Submit the form
    await page.click('button[type="submit"]:has-text("Save Page")');

    // Wait for modal to close
    await page.waitForSelector('#pageModal:not(.active)', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for page list to refresh

    // Take screenshot showing created page in list
    await page.screenshot({
      path: 'screenshots/06-page-created-in-list.png',
      fullPage: true
    });

    // Verify the page appears in the list
    const pageCard = page.locator(`.page-card:has-text("${pageTitle}")`);
    await expect(pageCard).toBeVisible({ timeout: 5000 });

    // Step 6: Click on the page to edit it
    await pageCard.click();
    await page.waitForSelector('#pageModal.active', { timeout: 5000 });

    // Verify we're in edit mode
    await expect(page.locator('#modalTitle')).toContainText('Edit Page');

    // Take screenshot of edit modal
    await page.screenshot({
      path: 'screenshots/07-page-edit-modal.png',
      fullPage: true
    });

    // Close the modal
    await page.click('button:has-text("Cancel")');
    await page.waitForSelector('#pageModal:not(.active)');

    // Step 7: View the page on the frontend

    // Navigate to the public rendering endpoint
    await page.goto(`/api/page-builder/render/${pageSlug}`);
    await page.waitForLoadState('networkidle');

    // Take screenshot of the frontend view (JSON response for now)
    await page.screenshot({
      path: 'screenshots/08-page-frontend-json.png',
      fullPage: true
    });

    // Verify the page data is returned
    const content = await page.content();
    expect(content).toContain(pageTitle);
    expect(content).toContain(pageSlug);

    // Step 8: Final verification - go back to page builder and verify page is still there
    await page.goto('/admin/page-builder');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify page is still in the list
    await expect(page.locator(`.page-card:has-text("${pageTitle}")`)).toBeVisible();

    // Take final screenshot
    await page.screenshot({
      path: 'screenshots/09-final-verification.png',
      fullPage: true
    });

  });

  test('should handle page with custom layout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Try to login if not already authenticated
    try {
      await page.fill('input[name="identifier"], input[name="username"]', 'testadmin', { timeout: 2000 });
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (e) {
      // Already logged in or login not needed
    }

    // Navigate to Page Builder
    await page.goto('/admin/page-builder');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Create a page with custom widgets in the layout
    await page.click('button:has-text("Create New Page")');
    await page.waitForSelector('#pageModal.active');

    const timestamp = Date.now();
    await page.fill('#pageTitle', `Layout Test ${timestamp}`);
    await page.fill('#pageSlug', `layout-test-${timestamp}`);
    await page.fill('#pageMetaDesc', 'Testing custom layout with widgets');
    await page.selectOption('#pageStatus', 'draft');

    // Take screenshot before submitting
    await page.screenshot({
      path: 'screenshots/10-layout-test-form.png',
      fullPage: true
    });

    await page.click('button[type="submit"]:has-text("Save Page")');
    await page.waitForSelector('#pageModal:not(.active)', { timeout: 10000 });

  });
});
