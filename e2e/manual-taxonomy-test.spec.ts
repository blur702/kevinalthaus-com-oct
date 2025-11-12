import { test, expect } from '@playwright/test';

/**
 * Manual Taxonomy Verification Test
 *
 * This test manually verifies the taxonomy system works by:
 * 1. Logging in to the admin panel
 * 2. Navigating to the Taxonomy page
 * 3. Verifying the page loads and is accessible
 */

test.describe('Manual Taxonomy Verification', () => {
  test('should verify taxonomy page is accessible', async ({ page }) => {
    // Step 1: Go to login page
    await page.goto('/login');

    // Wait for React app to load (check for the root div and wait for network idle)
    await page.waitForLoadState('networkidle');

    // Wait for the login form to appear (with longer timeout)
    await page.waitForSelector('input[name="identifier"]', { timeout: 30000 });

    // Fill in credentials
    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL(/\/$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Taxonomy page
    await page.goto('/taxonomy');
    await page.waitForLoadState('networkidle');

    // Verify taxonomy page loaded
    const taxonomyHeading = page.locator('text=/Taxonomy/i').first();
    await expect(taxonomyHeading).toBeVisible({ timeout: 10000 });


    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/taxonomy-page-screenshot.png', fullPage: true });
  });

  test('should verify blog content page is accessible', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[name="identifier"]', { timeout: 30000 });

    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Verify content page loaded
    const contentHeading = page.locator('text=/Content/i').first();
    await expect(contentHeading).toBeVisible({ timeout: 10000 });


    // Take a screenshot
    await page.screenshot({ path: 'test-results/content-page-screenshot.png', fullPage: true });
  });

  test('should verify blog post creation form loads', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[name="identifier"]', { timeout: 30000 });

    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Click "Create" or "New Post" button
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create"), button:has-text("Add")').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Wait for form to load
    await page.waitForLoadState('networkidle');

    // Verify form fields are present
    const titleField = page.locator('input[name="title"]');
    await expect(titleField).toBeVisible({ timeout: 10000 });


    // Take a screenshot
    await page.screenshot({ path: 'test-results/blog-form-screenshot.png', fullPage: true });
  });
});
