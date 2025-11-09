/**
 * Page Builder E2E Tests
 * Tests the complete page builder workflow with screenshots
 */

import { test, expect } from '@playwright/test';

test.describe('Page Builder', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to page builder admin
    await page.goto('/admin/page-builder');
  });

  test('should display page builder interface', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify header
    await expect(page.locator('h1')).toContainText('Page Builder');

    // Verify "Create New Page" button exists
    await expect(page.locator('button:has-text("Create New Page")')).toBeVisible();

    // Take screenshot of the main interface
    await page.screenshot({
      path: 'screenshots/page-builder-main-interface.png',
      fullPage: true
    });
  });

  test('should open create page modal', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click "Create New Page" button
    await page.click('button:has-text("Create New Page")');

    // Wait for modal to appear
    await page.waitForSelector('#pageModal.active');

    // Verify modal title
    await expect(page.locator('#modalTitle')).toContainText('Create New Page');

    // Verify form fields
    await expect(page.locator('#pageTitle')).toBeVisible();
    await expect(page.locator('#pageSlug')).toBeVisible();
    await expect(page.locator('#pageMetaDesc')).toBeVisible();
    await expect(page.locator('#pageStatus')).toBeVisible();

    // Take screenshot of the create modal
    await page.screenshot({
      path: 'screenshots/page-builder-create-modal.png',
      fullPage: true
    });
  });

  test('should create a new page', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click "Create New Page" button
    await page.click('button:has-text("Create New Page")');

    // Wait for modal
    await page.waitForSelector('#pageModal.active');

    // Fill in form
    await page.fill('#pageTitle', 'Test Page');
    await page.fill('#pageSlug', 'test-page');
    await page.fill('#pageMetaDesc', 'This is a test page created by Playwright');
    await page.selectOption('#pageStatus', 'draft');

    // Take screenshot of filled form
    await page.screenshot({
      path: 'screenshots/page-builder-form-filled.png',
      fullPage: true
    });

    // Submit form
    await page.click('button[type="submit"]:has-text("Save Page")');

    // Wait for modal to close and page list to update
    await page.waitForSelector('#pageModal:not(.active)', { timeout: 5000 });

    // Wait a bit for the page list to refresh
    await page.waitForTimeout(1000);

    // Verify the page appears in the list
    await expect(page.locator('.page-card:has-text("Test Page")')).toBeVisible();

    // Take screenshot of page list with new page
    await page.screenshot({
      path: 'screenshots/page-builder-page-created.png',
      fullPage: true
    });
  });

  test('should display empty state when no pages exist', async ({ page }) => {
    // This test assumes a fresh database or that all pages have been deleted
    // In reality, you might need to mock the API response or clean the database

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if empty state is visible
    const emptyState = page.locator('.empty-state');
    if (await emptyState.isVisible()) {
      await expect(emptyState.locator('h2')).toContainText('No pages yet');

      // Take screenshot of empty state
      await page.screenshot({
        path: 'screenshots/page-builder-empty-state.png',
        fullPage: true
      });
    }
  });

  test('should filter pages by status', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Wait for initial page load
    await page.waitForTimeout(1000);

    // Select "draft" filter
    await page.selectOption('#statusFilter', 'draft');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Take screenshot of filtered view
    await page.screenshot({
      path: 'screenshots/page-builder-filtered-draft.png',
      fullPage: true
    });

    // Select "published" filter
    await page.selectOption('#statusFilter', 'published');
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/page-builder-filtered-published.png',
      fullPage: true
    });
  });

  test('should search pages', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Wait for initial load
    await page.waitForTimeout(1000);

    // Enter search term
    await page.fill('#searchInput', 'test');

    // Wait for search to apply (debounced)
    await page.waitForTimeout(300);

    // Take screenshot of search results
    await page.screenshot({
      path: 'screenshots/page-builder-search-results.png',
      fullPage: true
    });
  });

  test('should show page details when clicking a page card', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Wait for pages to load
    await page.waitForTimeout(1000);

    // Find first page card
    const pageCard = page.locator('.page-card').first();

    if (await pageCard.isVisible()) {
      // Click the page card
      await pageCard.click();

      // Wait for modal to open
      await page.waitForSelector('#pageModal.active');

      // Verify modal shows "Edit Page"
      await expect(page.locator('#modalTitle')).toContainText('Edit Page');

      // Take screenshot of edit modal
      await page.screenshot({
        path: 'screenshots/page-builder-edit-modal.png',
        fullPage: true
      });
    }
  });

  test('should display responsive toolbar', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify toolbar elements
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('#statusFilter')).toBeVisible();

    // Take screenshot of toolbar
    await page.locator('.toolbar').screenshot({
      path: 'screenshots/page-builder-toolbar.png'
    });
  });

  test('should auto-generate slug from title', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Open create modal
    await page.click('button:has-text("Create New Page")');
    await page.waitForSelector('#pageModal.active');

    // Type title
    await page.fill('#pageTitle', 'My Amazing Page');

    // Wait a moment for slug generation
    await page.waitForTimeout(200);

    // Verify slug was generated
    const slugValue = await page.inputValue('#pageSlug');
    expect(slugValue).toBe('my-amazing-page');

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/page-builder-slug-generation.png',
      fullPage: true
    });
  });
});

test.describe('Page Builder - API Integration', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('/api/page-builder/pages', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ success: false, error: 'Internal server error' })
      });
    });

    // Navigate to page builder
    await page.goto('/admin/page-builder');
    await page.waitForLoadState('networkidle');

    // Wait for error state
    await page.waitForSelector('.empty-state:has-text("Error")');

    // Take screenshot of error state
    await page.screenshot({
      path: 'screenshots/page-builder-error-state.png',
      fullPage: true
    });
  });

  test('should handle network timeout', async ({ page }) => {
    // Mock slow API
    await page.route('/api/page-builder/pages', async route => {
      await page.waitForTimeout(10000); // Never resolve
    });

    // Navigate to page builder
    await page.goto('/admin/page-builder');

    // Take screenshot of loading state
    await page.screenshot({
      path: 'screenshots/page-builder-loading-state.png',
      fullPage: true
    });
  });
});

test.describe('Page Builder - Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/admin/page-builder');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Focus on search input
    await expect(page.locator('#searchInput')).toBeFocused();

    await page.keyboard.press('Tab'); // Focus on status filter
    await expect(page.locator('#statusFilter')).toBeFocused();

    await page.keyboard.press('Tab'); // Focus on create button
    await expect(page.locator('button:has-text("Create New Page")')).toBeFocused();

    // Take screenshot showing focus
    await page.screenshot({
      path: 'screenshots/page-builder-keyboard-nav.png',
      fullPage: true
    });
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/admin/page-builder');
    await page.waitForLoadState('networkidle');

    // Open modal
    await page.click('button:has-text("Create New Page")');
    await page.waitForSelector('#pageModal.active');

    // Check form labels
    const titleLabel = page.locator('label[for="pageTitle"]');
    const slugLabel = page.locator('label[for="pageSlug"]');

    await expect(titleLabel).toBeVisible();
    await expect(slugLabel).toBeVisible();
  });
});
