import { test, expect } from '@playwright/test';

/**
 * Quick verification test for login and blog post creation workflow
 */

test.describe('Blog Workflow Verification', () => {
  test('should login as kevin and navigate to blog post creation', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');

    // Verify we're on the login page
    await expect(page).toHaveURL(/\/login/);

    // Step 2: Fill in credentials
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');

    // Step 3: Submit login form
    await page.locator('button[type="submit"]').click();

    // Step 4: Wait for redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Step 5: Navigate to Content page
    await page.goto('/content');
    await expect(page).toHaveURL('/content', { timeout: 5000 });

    // Step 6: Click "Create New Post" button
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();

    // Wait for the button to be visible
    await createButton.waitFor({ state: 'visible', timeout: 10000 });

    await createButton.click();

    // Step 7: Verify blog post form is displayed
    await page.waitForSelector('input[name="title"]', { timeout: 10000 });

    await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });

    // Verify we can interact with the form
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toBeEditable();

    const contentEditor = page.locator('div[contenteditable="true"]').first();
    await expect(contentEditor).toBeVisible();
    await expect(contentEditor).toBeEditable();

    // Step 8: Fill in a test blog post
    const testTitle = `Test Post ${Date.now()}`;
    const testContent = 'This is a test blog post to verify the workflow.';

    await titleInput.fill(testTitle);

    await contentEditor.click();
    await page.waitForTimeout(300);
    await contentEditor.fill(testContent);

    // Find the create/save button
    const saveButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();

    // Success!
  });

  test('should be able to fill and view blog post form fields', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Navigate to create post
    await page.goto('/content');
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createButton.click({ timeout: 10000 });

    // Wait for form
    await page.waitForSelector('input[name="title"]', { timeout: 10000 });

    // Test all form fields
    const testData = {
      title: `Comprehensive Test Post ${Date.now()}`,
      content: 'This is comprehensive test content with multiple paragraphs.\n\nParagraph 2 here.\n\nParagraph 3 here.',
      excerpt: 'This is a test excerpt for the blog post.',
    };


    // Fill title
    await page.locator('input[name="title"]').fill(testData.title);

    // Fill content (rich text editor)
    const editor = page.locator('div[contenteditable="true"]').first();
    await editor.click();
    await page.waitForTimeout(300);
    await editor.fill(testData.content);

    // Fill excerpt if visible
    const excerptField = page.locator('textarea[name="excerpt"]');
    const excerptCount = await excerptField.count();
    if (excerptCount > 0) {
      await excerptField.fill(testData.excerpt);
    }

    // Verify values were set
    await expect(page.locator('input[name="title"]')).toHaveValue(testData.title);
    // Note: contenteditable divs use textContent, not value
    const editorText = await editor.textContent();
    expect(editorText).toContain('This is comprehensive test content');

  });
});
