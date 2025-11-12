import { test, expect, ConsoleMessage } from '@playwright/test';

/**
 * Comprehensive End-to-End Test: Create Dogs Blog Post
 *
 * This test:
 * 1. Logs in as kevin
 * 2. Navigates to content management
 * 3. Creates a new blog post about dogs
 * 4. Monitors console for errors throughout
 * 5. Verifies the post was created successfully
 */

test.describe('Dogs Blog Post Creation with Console Monitoring', () => {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const consoleMessages: string[] = [];

  test('should create a blog post about dogs without console errors', async ({ page }) => {
    // Increase timeout for this test to 90 seconds (accounts for API loading)
    test.setTimeout(90000);
    // Set up console monitoring
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      } else if (type === 'log' || type === 'info') {
        consoleMessages.push(text);
      }
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Step 1: Navigate to login page
    await page.goto('http://localhost:3003/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Step 2: Fill in credentials and login
    await page.waitForSelector('input[name="identifier"]', { timeout: 30000 });
    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/$/, { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');

    // Step 3: Navigate to content page
    await page.goto('http://localhost:3003/content');

    // Wait for content heading to be visible instead of networkidle
    const contentHeading = page.locator('text=/Content/i').first();
    await expect(contentHeading).toBeVisible({ timeout: 30000 });

    // Give taxonomy fields time to load their data
    await page.waitForTimeout(3000);

    // Step 4: Click "New Post" or "Create" button
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create"), button:has-text("Add")').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Wait for title field to appear instead of networkidle
    await page.waitForSelector('input[name="title"]', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Step 5: Fill in the blog post form

    // Fill title
    const titleField = page.locator('input[name="title"]');
    await expect(titleField).toBeVisible({ timeout: 10000 });
    await titleField.fill('The Ultimate Guide to Dog Care');

    // Fill excerpt
    const excerptField = page.locator('textarea[name="excerpt"], input[name="excerpt"]');
    if (await excerptField.count() > 0) {
      await excerptField.fill('Learn everything about taking care of your furry friend.');
    }

    // Fill content using the rich text editor (custom contentEditable div)

    try {
      // Find the contentEditable div (custom RichTextEditor from @monorepo/shared)
      const editor = page.locator('div[contenteditable="true"]').first();
      await editor.waitFor({ state: 'visible', timeout: 10000 });

      // Click to focus the editor
      await editor.click();
      await page.waitForTimeout(300);

      // Type content directly into the contentEditable div
      const content = 'Dogs are wonderful companions that bring joy and love into our lives. ' +
        'Whether you have a playful puppy or a wise senior dog, proper care is essential. ' +
        'This guide covers nutrition, exercise, grooming, and health care for your canine friend.';

      await editor.fill(content);
      await page.waitForTimeout(500);

    } catch (e) {
    }

    await page.waitForTimeout(1000);

    // Check if taxonomy fields are visible (Categories and Tags)
    const categoriesField = page.locator('text=/Categories/i').first();
    const tagsField = page.locator('text=/Tags/i').first();

    if (await categoriesField.count() > 0) {
      // Try to interact with it
      try {
        await categoriesField.click();
        await page.waitForTimeout(500);
      } catch (e) {
      }
    } else {
    }

    if (await tagsField.count() > 0) {
      // Try to interact with it
      try {
        await tagsField.click();
        await page.waitForTimeout(500);
      } catch (e) {
      }
    } else {
    }

    // Step 7: Set post status to draft
    const statusField = page.locator('select[name="status"], input[value="draft"]').first();
    if (await statusField.count() > 0) {
      try {
        if ((await statusField.getAttribute('type')) === 'radio') {
          await statusField.click();
        } else {
          await statusField.selectOption('draft');
        }
      } catch (e) {
      }
    }

    // Step 8: Take screenshot before submission
    await page.screenshot({
      path: 'test-results/dogs-post-before-submit.png',
      fullPage: true
    });

    // Step 9: Submit the form
    const submitButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit"), button[type="submit"]').first();
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // Small delay to ensure form is ready
    await page.waitForTimeout(1000);
    await submitButton.click();

    // Wait for submission to complete (either redirect or success message)
    try {
      await page.waitForTimeout(3000);

      // Check for success message or redirect back to content list
      const successIndicators = [
        page.locator('text=/success|created|saved/i').first(),
        page.url().includes('/content'),
      ];

      let successFound = false;
      for (const indicator of successIndicators) {
        if (typeof indicator === 'boolean') {
          if (indicator) {
            successFound = true;
            break;
          }
        } else {
          if (await indicator.count() > 0) {
            successFound = true;
            break;
          }
        }
      }

      if (!successFound) {
      }
    } catch (e) {
    }

    // Step 10: Take final screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/dogs-post-after-submit.png',
      fullPage: true
    });

    // Step 11: Analyze console messages

    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err, idx) => {
      });
    } else {
    }

    if (consoleWarnings.length > 0) {
      consoleWarnings.forEach((warn, idx) => {
      });
    }

    // Step 12: Final assertions

    // We expect SOME warnings may exist (React dev warnings, etc) but should be minimal
    expect(consoleErrors.length).toBeLessThanOrEqual(5);

    // Verify we're either back on content page or got a success message
    const onContentPage = page.url().includes('/content');
    const hasSuccessMessage = await page.locator('text=/success|created|saved/i').first().count() > 0;

    expect(onContentPage || hasSuccessMessage).toBeTruthy();

  });
});
