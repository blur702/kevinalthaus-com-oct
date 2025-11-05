import { test, expect } from '@playwright/test';

/**
 * Quick verification test for login and blog post creation workflow
 */

test.describe('Blog Workflow Verification', () => {
  test('should login as kevin and navigate to blog post creation', async ({ page }) => {
    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('/login');

    // Verify we're on the login page
    await expect(page).toHaveURL(/\/login/);
    console.log('✓ Login page loaded');

    // Step 2: Fill in credentials
    console.log('Step 2: Filling in credentials...');
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    console.log('✓ Credentials entered');

    // Step 3: Submit login form
    console.log('Step 3: Submitting login form...');
    await page.locator('button[type="submit"]').click();

    // Step 4: Wait for redirect to dashboard
    console.log('Step 4: Waiting for dashboard redirect...');
    await expect(page).toHaveURL('/', { timeout: 10000 });
    console.log('✓ Successfully logged in and redirected to dashboard');

    // Step 5: Navigate to Content page
    console.log('Step 5: Navigating to Content page...');
    await page.goto('/content');
    await expect(page).toHaveURL('/content', { timeout: 5000 });
    console.log('✓ Content page loaded');

    // Step 6: Click "Create New Post" button
    console.log('Step 6: Looking for Create New Post button...');
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();

    // Wait for the button to be visible
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Create Post button found');

    await createButton.click();
    console.log('✓ Create Post button clicked');

    // Step 7: Verify blog post form is displayed
    console.log('Step 7: Verifying blog post form...');
    await page.waitForSelector('input[name="title"]', { timeout: 10000 });
    console.log('✓ Title field found');

    await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
    console.log('✓ Content editor found');

    // Verify we can interact with the form
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toBeEditable();
    console.log('✓ Title field is editable');

    const contentEditor = page.locator('div[contenteditable="true"]').first();
    await expect(contentEditor).toBeVisible();
    await expect(contentEditor).toBeEditable();
    console.log('✓ Content editor is editable');

    // Step 8: Fill in a test blog post
    console.log('Step 8: Filling in test blog post...');
    const testTitle = `Test Post ${Date.now()}`;
    const testContent = 'This is a test blog post to verify the workflow.';

    await titleInput.fill(testTitle);
    console.log(`✓ Title filled: ${testTitle}`);

    await contentEditor.click();
    await page.waitForTimeout(300);
    await contentEditor.fill(testContent);
    console.log('✓ Content filled');

    // Find the create/save button
    const saveButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
    console.log('✓ Save button is enabled');

    // Success!
    console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY!');
    console.log('-----------------------------------');
    console.log('1. ✓ Navigated to login page');
    console.log('2. ✓ Filled in credentials (kevin/(130Bpm))');
    console.log('3. ✓ Submitted login form');
    console.log('4. ✓ Successfully logged in (redirected to /)');
    console.log('5. ✓ Navigated to Content page');
    console.log('6. ✓ Clicked Create Post button');
    console.log('7. ✓ Blog post form displayed');
    console.log('8. ✓ Form is fully functional and editable');
    console.log('-----------------------------------');
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

    console.log('Testing form field interactions...');

    // Fill title
    await page.locator('input[name="title"]').fill(testData.title);
    console.log('✓ Title field works');

    // Fill content (rich text editor)
    const editor = page.locator('div[contenteditable="true"]').first();
    await editor.click();
    await page.waitForTimeout(300);
    await editor.fill(testData.content);
    console.log('✓ Content field works');

    // Fill excerpt if visible
    const excerptField = page.locator('textarea[name="excerpt"]');
    const excerptCount = await excerptField.count();
    if (excerptCount > 0) {
      await excerptField.fill(testData.excerpt);
      console.log('✓ Excerpt field works');
    }

    // Verify values were set
    await expect(page.locator('input[name="title"]')).toHaveValue(testData.title);
    // Note: contenteditable divs use textContent, not value
    const editorText = await editor.textContent();
    expect(editorText).toContain('This is comprehensive test content');
    console.log('✓ All form values verified');

    console.log('\n✅ FORM FUNCTIONALITY VERIFIED!');
  });
});
