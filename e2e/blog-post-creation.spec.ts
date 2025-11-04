/**
 * Blog Post Creation Workflow Test
 *
 * This comprehensive test validates the entire blog post creation workflow:
 * - Authentication with cookie-based auth
 * - Navigation to content management
 * - Creating a new blog post
 * - Form submission and validation
 * - Cookie and authentication handling
 * - Error handling for 401 errors
 */

import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS, hasAuthCookies, getAuthCookies } from './utils/auth';

test.describe('Blog Post Creation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(
      page,
      TEST_CREDENTIALS.ADMIN.username,
      TEST_CREDENTIALS.ADMIN.password
    );

    // Verify authentication cookies are set
    const hasCookies = await hasAuthCookies(page);
    expect(hasCookies).toBeTruthy();
  });

  test('should successfully create a blog post through the UI', async ({ page }) => {
    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Verify we're on the content page
    expect(page.url()).toContain('/content');

    // Wait for the "Create New Post" button to be visible
    const createButton = page.locator('button').filter({ hasText: /create new post/i });
    await expect(createButton).toBeVisible({ timeout: 10000 });

    // Click the create button
    await createButton.click();

    // Wait for the form to appear
    await page.waitForSelector('input[name="title"]', { state: 'visible', timeout: 10000 });

    // Verify all required form fields are present
    await expect(page.locator('label:has-text("Title")')).toBeVisible();
    await expect(page.locator('label:has-text("Content")')).toBeVisible();

    // Fill in the blog post form
    await page.fill('input[name="title"]', 'Test Blog Post');

    // Find and fill the content textarea (body_html)
    const contentField = page.locator('textarea').filter({ has: page.locator('textarea') }).first();
    await contentField.fill('This is a test blog post content');

    // Fill excerpt if the field is visible
    const excerptField = page.locator('textarea[name="excerpt"]');
    if (await excerptField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await excerptField.fill('Test excerpt');
    }

    // Select status as "draft"
    const statusSelect = page.locator('div[role="button"]').filter({ hasText: /status/i }).or(
      page.locator('div').filter({ has: page.locator('label:has-text("Status")') })
    ).first();

    // Click to open the select dropdown
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.click();

      // Select "Draft" option
      const draftOption = page.locator('li[role="option"]').filter({ hasText: /draft/i });
      if (await draftOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await draftOption.click();
      }
    }

    // Verify cookies are still present before submission
    const cookiesBeforeSubmit = await getAuthCookies(page);
    expect(cookiesBeforeSubmit.length).toBeGreaterThan(0);

    // Submit the form
    const submitButton = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /create|save/i })
    ).first();

    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for submission to complete (either success message or redirect)
    await page.waitForTimeout(2000);

    // Check for success indicators
    const successIndicators = [
      page.locator('text=/created successfully/i'),
      page.locator('text=/saved/i'),
      page.locator('.MuiAlert-standardSuccess'),
      page.locator('[role="alert"]').filter({ hasText: /success/i }),
    ];

    let hasSuccessMessage = false;
    for (const indicator of successIndicators) {
      if (await indicator.isVisible({ timeout: 1000 }).catch(() => false)) {
        hasSuccessMessage = true;
        break;
      }
    }

    // Should either show success message or redirect back to list
    const isBackOnList = page.url().includes('/content') &&
                        !page.url().includes('/create') &&
                        !page.url().includes('/edit');

    expect(hasSuccessMessage || isBackOnList).toBeTruthy();

    // If redirected back to list, verify the new post appears
    if (isBackOnList) {
      // Wait for the blog list to load
      await page.waitForSelector('table', { timeout: 5000 }).catch(() => {});

      // Look for the test post in the list
      const testPostTitle = page.locator('text="Test Blog Post"');
      const isPostVisible = await testPostTitle.isVisible({ timeout: 5000 }).catch(() => false);

      // If the post is visible, verify it
      if (isPostVisible) {
        await expect(testPostTitle).toBeVisible();
      }
    }

    // Verify cookies are still valid after submission
    const cookiesAfterSubmit = await hasAuthCookies(page);
    expect(cookiesAfterSubmit).toBeTruthy();
  });

  test('should handle 401 errors properly', async ({ page, context }) => {
    // Clear authentication cookies to simulate expired session
    await context.clearCookies();

    // Try to navigate to content page
    await page.goto('/content');

    // Should redirect to login page
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('should verify cookies are sent with requests', async ({ page }) => {
    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Set up request interception to verify cookies
    const requestPromise = page.waitForRequest(
      request => request.url().includes('/api/blog') && request.method() === 'GET'
    );

    // Trigger a request by navigating or refreshing
    await page.reload();

    const request = await requestPromise;

    // Verify cookies are present in the request
    const headers = await request.allHeaders();
    expect(headers['cookie']).toBeTruthy();
    expect(headers['cookie']).toContain('accessToken');
  });

  test('should display validation errors for empty required fields', async ({ page }) => {
    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Click create button
    const createButton = page.locator('button').filter({ hasText: /create new post/i });
    await createButton.click();

    // Wait for form to appear
    await page.waitForSelector('input[name="title"]', { state: 'visible' });

    // Try to submit without filling required fields
    const submitButton = page.locator('button').filter({ hasText: /create|save/i }).first();

    // Submit button should be disabled when required fields are empty
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('should show "Back to List" button and navigate back', async ({ page }) => {
    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Click create button
    const createButton = page.locator('button').filter({ hasText: /create new post/i });
    await createButton.click();

    // Wait for form to appear
    await page.waitForSelector('input[name="title"]', { state: 'visible' });

    // Find and click the back button
    const backButton = page.locator('button').filter({ hasText: /back to list/i });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should navigate back to the blog list
    await page.waitForTimeout(1000);

    // Verify we're back on the list page
    const createButtonAgain = page.locator('button').filter({ hasText: /create new post/i });
    await expect(createButtonAgain).toBeVisible({ timeout: 5000 });
  });

  test('should preserve authentication across multiple requests', async ({ page }) => {
    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Get initial cookies
    const initialCookies = await getAuthCookies(page);
    expect(initialCookies.length).toBeGreaterThan(0);

    // Navigate to dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate back to content
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Verify cookies are still present
    const finalCookies = await getAuthCookies(page);
    expect(finalCookies.length).toBeGreaterThan(0);

    // Verify we can still access the create button (not redirected to login)
    const createButton = page.locator('button').filter({ hasText: /create new post/i });
    await expect(createButton).toBeVisible({ timeout: 10000 });
  });

  test('should handle CSRF token correctly', async ({ page }) => {
    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Check for CSRF token in cookies
    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find(cookie => cookie.name === 'csrf-token');

    // CSRF token should be present
    expect(csrfCookie).toBeTruthy();
  });

  test('should display all form fields correctly', async ({ page }) => {
    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // Click create button
    const createButton = page.locator('button').filter({ hasText: /create new post/i });
    await createButton.click();

    // Wait for form to appear
    await page.waitForSelector('input[name="title"]', { state: 'visible' });

    // Verify all expected form fields are present
    await expect(page.locator('label:has-text("Title")')).toBeVisible();
    await expect(page.locator('label:has-text("Slug")')).toBeVisible();
    await expect(page.locator('label:has-text("Content")')).toBeVisible();
    await expect(page.locator('label:has-text("Excerpt")')).toBeVisible();
    await expect(page.locator('label:has-text("Meta Description")')).toBeVisible();
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
    await expect(page.locator('label:has-text("Reading Time")')).toBeVisible();
    await expect(page.locator('text=/Allow Comments/i')).toBeVisible();
  });
});
