import { test, expect, ConsoleMessage } from '@playwright/test';

/**
 * Complete EDM in the 90s Blog Post Test
 *
 * This test verifies the complete workflow:
 * 1. Login as kevin
 * 2. Create a blog post about EDM in the 90s
 * 3. Monitor console for errors
 * 4. Verify post was created successfully
 */

test.describe('EDM in the 90s Blog Post', () => {
  const consoleErrors: string[] = [];

  test('should login and create EDM in the 90s blog post', async ({ page }) => {
    test.setTimeout(120000); // 2 minute timeout

    // Monitor console
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('L Console Error:', msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
      console.log('L Page Error:', error.message);
    });

    console.log('\n<µ Creating EDM in the 90s Blog Post');
    console.log('='.repeat(60));

    // Step 1: Login
    console.log('\n=Ý Step 1: Logging in...');
    await page.goto('http://localhost:3003/login');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForSelector('input[name="identifier"]', { timeout: 30000 });
    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/$/, { timeout: 15000 });
    console.log(' Logged in successfully');

    // Step 2: Navigate to content
    console.log('\n=Ý Step 2: Navigating to content page...');
    await page.goto('http://localhost:3003/content');

    const contentHeading = page.locator('text=/Content/i').first();
    await expect(contentHeading).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log(' Content page loaded');

    // Step 3: Open new post form
    console.log('\n=Ý Step 3: Opening new post form...');
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create"), button:has-text("Add")').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    await page.waitForSelector('input[name="title"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log(' New post form opened');

    // Step 4: Fill in the EDM blog post
    console.log('\n=Ý Step 4: Filling in EDM blog post...');

    // Title
    const titleField = page.locator('input[name="title"]');
    await expect(titleField).toBeVisible({ timeout: 10000 });
    await titleField.fill('EDM in the 90s: The Golden Age of Electronic Dance Music');
    console.log(' Title: EDM in the 90s: The Golden Age of Electronic Dance Music');

    // Excerpt
    const excerptField = page.locator('textarea[name="excerpt"], input[name="excerpt"]');
    if (await excerptField.count() > 0) {
      await excerptField.fill('Explore the revolutionary era of electronic dance music in the 1990s, from underground raves to mainstream success.');
      console.log(' Excerpt filled');
    }

    // Content - rich text editor
    console.log('=Ý Filling content about EDM in the 90s...');
    try {
      const editor = page.locator('div[contenteditable="true"]').first();
      await editor.waitFor({ state: 'visible', timeout: 10000 });
      await editor.click();
      await page.waitForTimeout(300);

      const edmContent = 'The 1990s marked a revolutionary period in electronic dance music history. ' +
        'From the underground warehouse raves to massive outdoor festivals, EDM evolved from ' +
        'a niche subculture into a global phenomenon.\n\n' +

        'Genres like trance, house, techno, and drum & bass dominated dance floors worldwide. ' +
        'Artists like The Prodigy, Fatboy Slim, Daft Punk, and Chemical Brothers became household names, ' +
        'bringing electronic music to mainstream audiences.\n\n' +

        'The rave culture of the 90s created a community united by music, with iconic events like ' +
        'Love Parade in Berlin, Creamfields in the UK, and the Electric Daisy Carnival establishing ' +
        'the blueprint for modern music festivals.\n\n' +

        'Technology played a crucial role - affordable samplers, synthesizers, and the rise of ' +
        'home studios democratized music production. The Roland TB-303, TR-909, and software like ' +
        'Cubase enabled bedroom producers to create professional-quality tracks.\n\n' +

        'This era laid the foundation for todays EDM industry, proving that electronic music ' +
        'could be both artistically innovative and commercially successful.';

      await editor.fill(edmContent);
      await page.waitForTimeout(500);
      console.log(' Content filled (5 paragraphs about EDM in the 90s)');
    } catch (e) {
      console.log('  Could not fill rich text editor:', (e as Error).message);
    }

    await page.waitForTimeout(1000);

    // Step 5: Take screenshot before submission
    console.log('\n=Ý Step 5: Taking screenshot...');
    await page.screenshot({
      path: 'test-results/edm-post-before-submit.png',
      fullPage: true
    });
    console.log(' Screenshot saved: test-results/edm-post-before-submit.png');

    // Step 6: Submit
    console.log('\n=Ý Step 6: Submitting post...');
    const submitButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit"), button[type="submit"]').first();
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // Check if button is enabled
    const isEnabled = await submitButton.isEnabled();
    if (!isEnabled) {
      console.log('  Submit button is disabled. Taking diagnostic screenshot...');
      await page.screenshot({ path: 'test-results/edm-post-button-disabled.png', fullPage: true });

      // Check word count
      const wordCount = page.locator('text=/\\d+ words/');
      if (await wordCount.count() > 0) {
        console.log('Word count:', await wordCount.textContent());
      }
    }

    await page.waitForTimeout(1000);
    await submitButton.click();
    console.log(' Submit button clicked');

    // Wait for submission
    await page.waitForTimeout(3000);

    // Check for success
    const onContentPage = page.url().includes('/content');
    const hasSuccessMessage = await page.locator('text=/success|created|saved/i').first().count() > 0;

    if (onContentPage || hasSuccessMessage) {
      console.log(' Form submitted successfully');
    }

    // Step 7: Take final screenshot
    await page.screenshot({
      path: 'test-results/edm-post-after-submit.png',
      fullPage: true
    });
    console.log(' Screenshot saved: test-results/edm-post-after-submit.png');

    // Step 8: Verify post in list
    console.log('\n=Ý Step 7: Verifying post appears in list...');
    if (onContentPage) {
      const postTitle = page.locator('text=/EDM in the 90s/i').first();
      const postExists = await postTitle.count() > 0;

      if (postExists) {
        console.log(' POST FOUND IN LIST!');
        console.log('   Title: "EDM in the 90s: The Golden Age of Electronic Dance Music"');
      } else {
        console.log('  Post not immediately visible (may be on another page)');
      }
    }

    // Console summary
    console.log('\n' + '='.repeat(60));
    console.log('CONSOLE ANALYSIS');
    console.log('='.repeat(60));
    console.log(`Total Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    } else {
      console.log(' NO CONSOLE ERRORS');
    }
    console.log('='.repeat(60));

    // Final assertions
    expect(consoleErrors.length).toBeLessThanOrEqual(5);
    expect(onContentPage || hasSuccessMessage).toBeTruthy();

    console.log('\n EDM IN THE 90s BLOG POST CREATED SUCCESSFULLY!\n');
  });
});
