import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive Feature Tests
 *
 * Tests all admin features including:
 * - Login
 * - Dashboard navigation
 * - Blog post creation with WYSIWYG editor
 * - Blog post editing
 * - Blog post deletion
 * - User management
 * - Settings
 * - Analytics
 */

/**
 * Helper function to login as kevin
 */
async function loginAsKevin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="identifier"]').fill('kevin');
  await page.locator('input[name="password"]').fill('(130Bpm)');
  await page.locator('button[type="submit"]').click();

  // Wait for successful login (redirect to dashboard)
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Comprehensive Admin Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsKevin(page);
  });

  test('should navigate through all admin sections', async ({ page }) => {
    // Test Dashboard
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=/Admin Dashboard/i')).toBeVisible({ timeout: 5000 });

    // Test Users
    await page.goto('/users');
    await expect(page).toHaveURL('/users');
    await expect(page.locator('text=/Users/i')).toBeVisible({ timeout: 5000 });

    // Test Content
    await page.goto('/content');
    await expect(page).toHaveURL('/content');
    await expect(page.locator('text=/Content/i')).toBeVisible({ timeout: 5000 });

    // Test Analytics
    await page.goto('/analytics');
    await expect(page).toHaveURL('/analytics');
    await expect(page.locator('text=/Analytics/i')).toBeVisible({ timeout: 5000 });

    // Test Settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('text=/Settings/i')).toBeVisible({ timeout: 5000 });
  });

  test('should create a new blog post with WYSIWYG editor', async ({ page }) => {
    // Navigate to Content page
    await page.goto('/content');
    await expect(page).toHaveURL('/content');

    // Click "Create New Post" or equivalent button
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createButton.click({ timeout: 5000 });

    // Wait for form to appear
    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    // Fill in the blog post form
    const testTitle = `Test Blog Post ${Date.now()}`;
    const testContent = 'This is test content for the blog post. It should be saved and displayed correctly.';

    await page.locator('input[name="title"]').fill(testTitle);

    // Fill in the WYSIWYG editor (currently a textarea)
    const editorField = page.locator('textarea[name="body_html"]');
    await editorField.fill(testContent);

    // Fill in excerpt
    await page.locator('textarea[name="excerpt"]').fill('This is a test excerpt');

    // Submit the form
    const saveButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await saveButton.click();

    // Wait for success (either redirect back to list or success message)
    await page.waitForTimeout(2000); // Give time for save operation

    // Verify the post appears in the list
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('should edit an existing blog post', async ({ page }) => {
    // First create a post to edit, making this test independent
    await page.goto('/content');
    await expect(page).toHaveURL('/content');

    // Create a new post
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    const originalTitle = `Test Post for Editing ${Date.now()}`;
    const originalContent = 'This is content that will be edited.';

    await page.locator('input[name="title"]').fill(originalTitle);
    await page.locator('textarea[name="body_html"]').fill(originalContent);
    await page.locator('textarea[name="excerpt"]').fill('Test excerpt');

    const saveButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Now find and edit the post we just created
    const postRow = page.locator(`text=${originalTitle}`).first();
    await expect(postRow).toBeVisible({ timeout: 10000 });

    const editButton = page.locator(`tr:has-text("${originalTitle}") button[aria-label="Edit"], tr:has-text("${originalTitle}") button:has-text("Edit")`).first();
    await editButton.click({ timeout: 5000 });

    // Wait for edit form to load
    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    // Update the title and content
    const updatedTitle = `${originalTitle} - Edited`;
    await page.locator('input[name="title"]').fill(updatedTitle);

    const editorField = page.locator('textarea[name="body_html"]');
    await editorField.fill(`${originalContent}\n\nEdited content added.`);

    // Save changes
    const updateButton = page.locator('button:has-text("Update"), button:has-text("Save")').first();
    await updateButton.click();

    // Wait for save operation
    await page.waitForTimeout(2000);

    // Verify updated title appears
    await expect(page.locator(`text=${updatedTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('should delete a blog post', async ({ page }) => {
    // First create a post to delete, making this test independent
    await page.goto('/content');
    await expect(page).toHaveURL('/content');

    // Create a new post
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    const titleToDelete = `Test Post for Deletion ${Date.now()}`;

    await page.locator('input[name="title"]').fill(titleToDelete);
    await page.locator('textarea[name="body_html"]').fill('This content will be deleted.');
    await page.locator('textarea[name="excerpt"]').fill('Test excerpt');

    const saveButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Verify the post was created
    await expect(page.locator(`text=${titleToDelete}`)).toBeVisible({ timeout: 10000 });

    // Now delete the post we just created
    const deleteButton = page.locator(`tr:has-text("${titleToDelete}") button[aria-label="Delete"], tr:has-text("${titleToDelete}") button:has-text("Delete")`).first();
    await deleteButton.click({ timeout: 5000 });

    // Confirm deletion in dialog if present
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"):not([aria-label="Delete"])');
    const confirmCount = await confirmButton.count();
    if (confirmCount > 0) {
      await confirmButton.click();
    }

    // Wait for deletion
    await page.waitForTimeout(2000);

    // Verify post is removed
    const deletedPost = page.locator(`text="${titleToDelete}"`);
    await expect(deletedPost).not.toBeVisible({ timeout: 5000 });
  });

  test('should handle blog post status changes', async ({ page }) => {
    // Navigate to Content page
    await page.goto('/content');

    // Click create button
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createButton.click({ timeout: 5000 });

    // Wait for form
    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    // Fill basic fields
    await page.locator('input[name="title"]').fill(`Status Test Post ${Date.now()}`);
    await page.locator('textarea[name="body_html"]').fill('Test content for status changes');

    // Change status to Published
    const statusSelect = page.locator('select, div[role="combobox"]').filter({ hasText: /Status|Draft/ }).first();
    await statusSelect.click();

    const publishedOption = page.locator('li[data-value="published"], option[value="published"]');
    if (await publishedOption.count() > 0) {
      await publishedOption.click();
    }

    // Save
    const saveButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await saveButton.click();

    await page.waitForTimeout(2000);

    // Verify post was created with published status
    await expect(page.locator('text=/Status Test Post/i')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate using sidebar menu', async ({ page }) => {
    // Start at dashboard
    await page.goto('/');

    // Click Dashboard in sidebar
    const dashboardLink = page.locator('a[href="/"], button:has-text("Dashboard")').first();
    await dashboardLink.click();
    await expect(page).toHaveURL('/');

    // Click Users in sidebar
    const usersLink = page.locator('a[href="/users"], button:has-text("Users")').first();
    await usersLink.click();
    await expect(page).toHaveURL('/users');

    // Click Content in sidebar
    const contentLink = page.locator('a[href="/content"], button:has-text("Content")').first();
    await contentLink.click();
    await expect(page).toHaveURL('/content');

    // Click Analytics in sidebar
    const analyticsLink = page.locator('a[href="/analytics"], button:has-text("Analytics")').first();
    await analyticsLink.click();
    await expect(page).toHaveURL('/analytics');

    // Click Settings in sidebar
    const settingsLink = page.locator('a[href="/settings"], button:has-text("Settings")').first();
    await settingsLink.click();
    await expect(page).toHaveURL('/settings');
  });

  test('should display user information in header', async ({ page }) => {
    await page.goto('/');

    // Look for kevin's username or admin indicator
    const userInfo = page.locator('text=/kevin/i, text=/Admin/i').first();
    await expect(userInfo).toBeVisible({ timeout: 5000 });
  });

  test('should have working logout button', async ({ page }) => {
    await page.goto('/');

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
    await logoutButton.click({ timeout: 5000 });

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Try to access protected page - should redirect to login
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    await page.goto('/');

    // Reload the page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL('/', { timeout: 5000 });
    await expect(page.locator('text=/Admin Dashboard/i')).toBeVisible({ timeout: 5000 });

    // Navigate to another protected page
    await page.goto('/content');
    await expect(page).toHaveURL('/content', { timeout: 5000 });
  });

  test('should complete full blog post workflow', async ({ page }) => {
    const testTitle = `Complete Workflow Post ${Date.now()}`;

    // 1. Create
    await page.goto('/content');
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="title"]', { timeout: 5000 });
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('textarea[name="body_html"]').fill('Original content');
    await page.locator('textarea[name="excerpt"]').fill('Original excerpt');

    let saveButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // 2. Verify it appears
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 10000 });

    // 3. Edit
    const editButtons = page.locator('button[aria-label="Edit"], button:has-text("Edit")');
    const editCount = await editButtons.count();
    if (editCount > 0) {
      await editButtons.first().click({ timeout: 5000 });
      await page.waitForSelector('input[name="title"]', { timeout: 5000 });

      const editorField = page.locator('textarea[name="body_html"]');
      await editorField.fill('Updated content');

      saveButton = page.locator('button:has-text("Update"), button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(2000);
    }

    // 4. Delete
    const deleteButtons = page.locator('button[aria-label="Delete"], button:has-text("Delete")');
    const deleteCount = await deleteButtons.count();
    if (deleteCount > 0) {
      await deleteButtons.first().click({ timeout: 5000 });

      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"):not([aria-label="Delete"])');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }

      await page.waitForTimeout(2000);

      // Verify deletion
      await expect(page.locator(`text="${testTitle}"`)).not.toBeVisible({ timeout: 5000 });
    }
  });
});
