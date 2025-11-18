/**
 * End-to-end tests for Blog Plugin CSRF Protection
 * Tests publish, unpublish, delete, and create/update operations
 */

import { test, expect } from '@playwright/test';

// Test configuration - require TEST_URL or default to localhost for safety
const BASE_URL = process.env.TEST_URL || 'http://localhost:4000';
const ADMIN_URL = `${BASE_URL}/admin`;
const API_URL = `${BASE_URL}/api`;

// Credentials from environment variables (required)
const TEST_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error(
    'TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables are required. ' +
    'Please set them in your .env file or CI configuration.'
  );
}

test.describe('Blog Plugin CSRF Protection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin login
    await page.goto(`${ADMIN_URL}/login`);

    // Login with test credentials from environment variables
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for login to complete and redirect to dashboard
    await page.waitForURL(/.*admin.*/);

    // Navigate to Blog section
    await page.goto(`${ADMIN_URL}/content`);
    await page.waitForLoadState('networkidle');
  });

  test('should successfully publish a draft blog post', async ({ page }) => {
    // Find a draft post (if one exists)
    const draftPosts = page.locator('tr:has-text("draft")');
    const count = await draftPosts.count();

    if (count === 0) {
      test.fail(true, 'No draft posts found - test data is missing. Please ensure at least one draft post exists before running this test.');
      return;
    }

    // Listen for the publish API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/blog/') && response.url().includes('/publish')
    );

    // Click the actions menu on the first draft
    await draftPosts.first().locator('button[aria-label="more"]').click();

    // Click publish button
    await page.click('text=Publish');

    // Wait for the API response
    const response = await responsePromise;

    // Verify the response is successful (not 403 Forbidden)
    expect(response.status()).toBe(200);

    // Verify success message or status change
    await expect(page.locator('text=published')).toBeVisible({ timeout: 5000 });
  });

  test('should successfully unpublish a published blog post', async ({ page }) => {
    // Find a published post
    const publishedPosts = page.locator('tr:has-text("published")');
    const count = await publishedPosts.count();

    if (count === 0) {
      test.fail(true, 'No published posts found - test data is missing. Please ensure at least one published post exists before running this test.');
      return;
    }

    // Listen for the unpublish API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/blog/') && response.url().includes('/unpublish')
    );

    // Click the actions menu on the first published post
    await publishedPosts.first().locator('button[aria-label="more"]').click();

    // Click unpublish button
    await page.click('text=Unpublish');

    // Wait for the API response
    const response = await responsePromise;

    // Verify the response is successful (not 403 Forbidden)
    expect(response.status()).toBe(200);

    // Verify status changed to draft
    await expect(page.locator('text=draft')).toBeVisible({ timeout: 5000 });
  });

  test('should successfully delete a blog post', async ({ page }) => {
    // Create a test post first (or find existing one)
    const allPosts = page.locator('tbody tr');
    const count = await allPosts.count();

    if (count === 0) {
      test.fail(true, 'No posts found - test data is missing. Please ensure at least one post exists before running this test.');
      return;
    }

    // Get the post title to verify deletion
    const postTitle = await allPosts.first().locator('td:first-child').textContent();

    // Listen for the delete API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/blog/') && response.request().method() === 'DELETE'
    );

    // Mock the confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Click the actions menu
    await allPosts.first().locator('button[aria-label="more"]').click();

    // Click delete button
    await page.click('text=Delete');

    // Wait for the API response
    const response = await responsePromise;

    // Verify the response is successful (not 403 Forbidden)
    expect(response.status()).toBe(200);

    // Verify the post is removed from the list
    await expect(page.locator(`text=${postTitle}`)).not.toBeVisible({ timeout: 5000 });
  });

  test('should successfully create a new blog post', async ({ page }) => {
    // Click "Create New Post" button
    await page.click('button:has-text("Create New Post")');

    // Fill in the form
    await page.fill('input[name="title"]', 'Test Post - CSRF Automated Test');
    await page.fill('textarea[name="body_html"]', '<p>This is a test post created by automated testing.</p>');
    await page.fill('textarea[name="excerpt"]', 'Test excerpt');

    // Listen for the create API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/blog') && response.request().method() === 'POST'
    );

    // Submit the form
    await page.click('button:has-text("Create")');

    // Wait for the API response
    const response = await responsePromise;

    // Verify the response is successful (not 403 Forbidden)
    expect(response.status()).toBe(200);

    // Verify the post appears in the list
    await expect(page.locator('text=Test Post - CSRF Automated Test')).toBeVisible({ timeout: 5000 });
  });

  test('should include CSRF token in all state-changing requests', async ({ page }) => {
    // Intercept all requests to check for CSRF token
    const requests: any[] = [];

    page.on('request', request => {
      if (
        request.url().includes('/api/blog') &&
        ['POST', 'PUT', 'DELETE'].includes(request.method())
      ) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
        });
      }
    });

    // Trigger a state-changing operation (create a post)
    await page.click('button:has-text("Create New Post")');
    await page.fill('input[name="title"]', 'CSRF Token Test Post');
    await page.fill('textarea[name="body_html"]', '<p>Testing CSRF token presence.</p>');
    await page.click('button:has-text("Create")');

    // Wait for the request to complete
    await page.waitForTimeout(2000);

    // Verify at least one request was made
    expect(requests.length).toBeGreaterThan(0);

    // Verify all requests include the CSRF token header
    for (const req of requests) {
      expect(req.headers['x-csrf-token']).toBeDefined();
      expect(req.headers['x-csrf-token']).not.toBe('');
    }
  });
});
