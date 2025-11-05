/**
 * Comprehensive Blog Workflow Test
 *
 * Tests the complete user journey:
 * 1. Login as admin
 * 2. Navigate to content creation
 * 3. Create and publish blog post
 * 4. View post on frontend
 * 5. Verify content is correctly displayed
 *
 * This ensures the entire system works end-to-end.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3003';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3002';

// Test credentials
const TEST_USER = {
  email: 'kevin@example.com',
  password: 'password123',
};

// Test blog post data
const TEST_POST = {
  title: `E2E Test Post - ${Date.now()}`,
  slug: `e2e-test-post-${Date.now()}`,
  excerpt: 'This is a test post created by automated E2E test',
  content: 'This is the full content of the test blog post. It should be visible on the frontend after publishing.',
  category: 'Technology',
  tags: ['test', 'automation', 'e2e'],
};

/**
 * Helper: Login to admin panel
 */
async function loginAsAdmin(page: Page) {
  await page.goto(`${ADMIN_URL}/login`);

  // Wait for login form
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });

  // Fill credentials
  await page.fill('input[name="identifier"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(`${ADMIN_URL}/**`, { timeout: 10000 });

  // Verify we're logged in (dashboard should load)
  await expect(page).toHaveURL(new RegExp(`${ADMIN_URL}/(dashboard)?`));
}

/**
 * Helper: Create blog post
 */
async function createBlogPost(page: Page, postData: typeof TEST_POST) {
  // Navigate to blog/content creation
  await page.goto(`${ADMIN_URL}/content/posts/new`);

  // Wait for editor to load
  await page.waitForSelector('input[name="title"]', { timeout: 10000 });

  // Fill post details
  await page.fill('input[name="title"]', postData.title);
  await page.fill('input[name="slug"]', postData.slug);
  await page.fill('textarea[name="excerpt"]', postData.excerpt);

  // Fill content (editor - might be rich text or markdown)
  const contentField = page.locator('textarea[name="content"], div[contenteditable="true"]').first();
  await contentField.click();
  await contentField.fill(postData.content);

  // Add category if field exists
  const categoryField = page.locator('input[name="category"], select[name="category"]').first();
  if (await categoryField.count() > 0) {
    await categoryField.fill(postData.category);
  }

  // Add tags if field exists
  const tagsField = page.locator('input[name="tags"]').first();
  if (await tagsField.count() > 0) {
    await tagsField.fill(postData.tags.join(', '));
  }

  // Save as draft first
  const saveDraftButton = page.locator('button:has-text("Save Draft"), button:has-text("Save")').first();
  await saveDraftButton.click();

  // Wait for save confirmation
  await page.waitForSelector('text=/saved|success/i', { timeout: 5000 });

  return postData;
}

/**
 * Helper: Publish blog post
 */
async function publishBlogPost(page: Page) {
  // Click publish button
  const publishButton = page.locator('button:has-text("Publish"), button:has-text("Publish Post")').first();

  if (await publishButton.count() > 0) {
    await publishButton.click();

    // Wait for publish confirmation
    await page.waitForSelector('text=/published|success/i', { timeout: 5000 });
  } else {
    // If no publish button, change status to published
    const statusSelect = page.locator('select[name="status"]').first();
    if (await statusSelect.count() > 0) {
      await statusSelect.selectOption('published');

      // Save
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();

      await page.waitForSelector('text=/saved|success/i', { timeout: 5000 });
    }
  }
}

/**
 * Helper: Verify post on frontend
 */
async function verifyPostOnFrontend(page: Page, postData: typeof TEST_POST) {
  // Navigate to frontend blog page
  await page.goto(`${FRONTEND_URL}/blog/${postData.slug}`);

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Verify post title
  await expect(page.locator(`h1:has-text("${postData.title}")`)).toBeVisible({ timeout: 10000 });

  // Verify post content
  await expect(page.locator(`text=${postData.content}`)).toBeVisible();

  // Verify excerpt (might be in meta or summary)
  const pageContent = await page.content();
  expect(pageContent).toContain(postData.excerpt);

  return true;
}

test.describe('Comprehensive Blog Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for E2E tests
    test.setTimeout(60000);
  });

  test('Complete workflow: login → create post → publish → view frontend', async ({ page }) => {
    // Step 1: Login as admin
    await test.step('Login as admin', async () => {
      await loginAsAdmin(page);
    });

    // Step 2: Create blog post
    let createdPost: typeof TEST_POST;
    await test.step('Create blog post', async () => {
      createdPost = await createBlogPost(page, TEST_POST);
      expect(createdPost).toBeDefined();
    });

    // Step 3: Publish blog post
    await test.step('Publish blog post', async () => {
      await publishBlogPost(page);
    });

    // Step 4: Verify post appears on frontend
    await test.step('Verify post on frontend', async () => {
      const isVisible = await verifyPostOnFrontend(page, TEST_POST);
      expect(isVisible).toBe(true);
    });
  });

  test('Settings page loads without errors', async ({ page }) => {
    // Login first
    await loginAsAdmin(page);

    // Navigate to settings
    await page.goto(`${ADMIN_URL}/settings`);

    // Wait for page to load (should NOT show infinite spinner)
    await page.waitForLoadState('networkidle');

    // Check for error indicators
    const hasError = await page.locator('text=/error|failed/i').count() > 0;
    expect(hasError).toBe(false);

    // Verify settings tabs are visible
    const tabCount = await page.locator('[role="tab"]').count();
    expect(tabCount).toBeGreaterThan(0);

    // Click first tab and verify content loads
    await page.locator('[role="tab"]').first().click();
    await page.waitForTimeout(1000); // Wait for tab content to render

    // Should see form fields, not infinite spinner
    const hasInputs = await page.locator('input, textarea, select').count() > 0;
    expect(hasInputs).toBe(true);
  });

  test('API keys can be managed in settings', async ({ page }) => {
    // Login
    await loginAsAdmin(page);

    // Navigate to settings
    await page.goto(`${ADMIN_URL}/settings`);

    // Click API Keys tab (might be labeled "API Keys" or "Keys")
    const apiKeysTab = page.locator('[role="tab"]:has-text("API"), [role="tab"]:has-text("Keys")').first();

    if (await apiKeysTab.count() > 0) {
      await apiKeysTab.click();

      // Wait for API keys section to load
      await page.waitForTimeout(1000);

      // Verify we can see API key management UI
      const hasApiKeySection = await page.locator('text=/api key|create key|generate/i').count() > 0;
      expect(hasApiKeySection).toBe(true);

      // Look for "Create API Key" button
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Generate")').first();

      if (await createButton.count() > 0) {
        // Click create button
        await createButton.click();

        // Verify dialog/form opens
        await page.waitForSelector('dialog, [role="dialog"], form', { timeout: 3000 });

        // Verify we have fields for API key creation
        const hasNameField = await page.locator('input[name="name"], input[label*="name"]').count() > 0;
        expect(hasNameField).toBe(true);
      }
    }
  });

  test('Error handling: invalid login shows error message', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);

    // Try to login with wrong credentials
    await page.fill('input[name="identifier"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/invalid|error|failed/i')).toBeVisible({ timeout: 5000 });

    // Should NOT navigate away from login page
    await expect(page).toHaveURL(new RegExp(`${ADMIN_URL}/login`));
  });
});
