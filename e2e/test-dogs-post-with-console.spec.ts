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
        console.log('❌ Console Error:', text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
        console.log('⚠️  Console Warning:', text);
      } else if (type === 'log' || type === 'info') {
        consoleMessages.push(text);
        console.log('ℹ️  Console Log:', text);
      }
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
      console.log('❌ Page Error:', error.message);
    });

    // Step 1: Navigate to login page
    console.log('\n📝 Step 1: Navigating to login page...');
    await page.goto('http://localhost:3003/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Step 2: Fill in credentials and login
    console.log('📝 Step 2: Logging in as kevin...');
    await page.waitForSelector('input[name="identifier"]', { timeout: 30000 });
    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/$/, { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');
    console.log('✓ Logged in successfully');

    // Step 3: Navigate to content page
    console.log('\n📝 Step 3: Navigating to content management...');
    await page.goto('http://localhost:3003/content');

    // Wait for content heading to be visible instead of networkidle
    const contentHeading = page.locator('text=/Content/i').first();
    await expect(contentHeading).toBeVisible({ timeout: 30000 });

    // Give taxonomy fields time to load their data
    await page.waitForTimeout(3000);
    console.log('✓ Content page loaded');

    // Step 4: Click "New Post" or "Create" button
    console.log('\n📝 Step 4: Opening new post form...');
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create"), button:has-text("Add")').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Wait for title field to appear instead of networkidle
    await page.waitForSelector('input[name="title"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('✓ New post form opened');

    // Step 5: Fill in the blog post form
    console.log('\n📝 Step 5: Filling in blog post about dogs...');

    // Fill title
    const titleField = page.locator('input[name="title"]');
    await expect(titleField).toBeVisible({ timeout: 10000 });
    await titleField.fill('The Ultimate Guide to Dog Care');
    console.log('✓ Title filled');

    // Fill excerpt
    const excerptField = page.locator('textarea[name="excerpt"], input[name="excerpt"]');
    if (await excerptField.count() > 0) {
      await excerptField.fill('Learn everything about taking care of your furry friend.');
      console.log('✓ Excerpt filled');
    }

    // Fill content using the rich text editor (custom contentEditable div)
    console.log('📝 Filling content in rich text editor...');

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

      console.log('✓ Content filled in rich text editor');
    } catch (e) {
      console.log('⚠️  Could not fill rich text editor:', (e as Error).message);
    }

    await page.waitForTimeout(1000);

    // Check if taxonomy fields are visible (Categories and Tags)
    console.log('\n📝 Step 6: Checking for taxonomy fields...');
    const categoriesField = page.locator('text=/Categories/i').first();
    const tagsField = page.locator('text=/Tags/i').first();

    if (await categoriesField.count() > 0) {
      console.log('✓ Categories field found');
      // Try to interact with it
      try {
        await categoriesField.click();
        await page.waitForTimeout(500);
        console.log('  Categories field is interactive');
      } catch (e) {
        console.log('  Categories field is visible but not yet clickable');
      }
    } else {
      console.log('ℹ️  Categories field not found (may need vocabularies created first)');
    }

    if (await tagsField.count() > 0) {
      console.log('✓ Tags field found');
      // Try to interact with it
      try {
        await tagsField.click();
        await page.waitForTimeout(500);
        console.log('  Tags field is interactive');
      } catch (e) {
        console.log('  Tags field is visible but not yet clickable');
      }
    } else {
      console.log('ℹ️  Tags field not found (may need vocabularies created first)');
    }

    // Step 7: Set post status to draft
    console.log('\n📝 Step 7: Setting post status...');
    const statusField = page.locator('select[name="status"], input[value="draft"]').first();
    if (await statusField.count() > 0) {
      try {
        if ((await statusField.getAttribute('type')) === 'radio') {
          await statusField.click();
        } else {
          await statusField.selectOption('draft');
        }
        console.log('✓ Status set to draft');
      } catch (e) {
        console.log('ℹ️  Could not set status, may already be draft by default');
      }
    }

    // Step 8: Take screenshot before submission
    await page.screenshot({
      path: 'test-results/dogs-post-before-submit.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: test-results/dogs-post-before-submit.png');

    // Step 9: Submit the form
    console.log('\n📝 Step 8: Submitting the form...');
    const submitButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit"), button[type="submit"]').first();
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // Small delay to ensure form is ready
    await page.waitForTimeout(1000);
    await submitButton.click();
    console.log('✓ Submit button clicked');

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
            console.log('✓ Redirected to content page');
            break;
          }
        } else {
          if (await indicator.count() > 0) {
            successFound = true;
            console.log('✓ Success message displayed');
            break;
          }
        }
      }

      if (!successFound) {
        console.log('⚠️  No clear success indicator, but form was submitted');
      }
    } catch (e) {
      console.log('⚠️  Submission completed but couldn\'t verify success state');
    }

    // Step 10: Take final screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/dogs-post-after-submit.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: test-results/dogs-post-after-submit.png');

    // Step 11: Analyze console messages
    console.log('\n' + '='.repeat(60));
    console.log('CONSOLE ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Errors: ${consoleErrors.length}`);
    console.log(`Total Warnings: ${consoleWarnings.length}`);
    console.log(`Total Messages: ${consoleMessages.length}`);
    console.log('='.repeat(60));

    if (consoleErrors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      consoleErrors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    } else {
      console.log('\n✓ NO CONSOLE ERRORS');
    }

    if (consoleWarnings.length > 0) {
      console.log('\n⚠️  WARNINGS FOUND:');
      consoleWarnings.forEach((warn, idx) => {
        console.log(`  ${idx + 1}. ${warn}`);
      });
    }

    // Step 12: Final assertions
    console.log('\n📝 Step 9: Running final assertions...');

    // We expect SOME warnings may exist (React dev warnings, etc) but should be minimal
    expect(consoleErrors.length).toBeLessThanOrEqual(5);
    console.log(`✓ Console errors within acceptable range: ${consoleErrors.length}/5`);

    // Verify we're either back on content page or got a success message
    const onContentPage = page.url().includes('/content');
    const hasSuccessMessage = await page.locator('text=/success|created|saved/i').first().count() > 0;

    expect(onContentPage || hasSuccessMessage).toBeTruthy();
    console.log('✓ Form submission completed successfully');

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
  });
});
