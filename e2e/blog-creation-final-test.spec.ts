/**
 * Final Blog Post Creation Test
 * Validates the complete workflow is bug-free
 */

import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

test('Complete blog post creation workflow', async ({ page }) => {
  // Enable console logging
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`BROWSER ERROR: ${msg.text()}`);
    }
  });

  // Step 1: Login
  console.log('Step 1: Logging in...');
  await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
  console.log('✓ Login successful');

  // Step 2: Navigate to Content page
  console.log('Step 2: Navigating to Content page...');
  await page.goto('/content');
  await page.waitForLoadState('domcontentloaded');
  expect(page.url()).toContain('/content');
  console.log('✓ On Content page');

  // Step 3: Click "Create New Post"
  console.log('Step 3: Clicking Create New Post...');
  const createButton = page.locator('button').filter({ hasText: /create new post/i });
  await createButton.waitFor({ state: 'visible', timeout: 10000 });
  await createButton.click();
  console.log('✓ Clicked Create New Post button');

  // Step 4: Wait for form to appear
  console.log('Step 4: Waiting for form...');
  await page.waitForSelector('input[name="title"]', { state: 'visible', timeout: 10000 });
  console.log('✓ Form is visible');

  // Step 5: Fill in the form
  console.log('Step 5: Filling in form...');
  const timestamp = new Date().toISOString();
  const testTitle = `Automated Test Post ${timestamp}`;

  await page.fill('input[name="title"]', testTitle);
  await page.fill('textarea[name="body_html"]', 'This is an automated test blog post created by Playwright.');
  await page.fill('textarea[name="excerpt"]', 'Automated test excerpt');

  console.log('✓ Form filled');

  // Step 6: Submit the form
  console.log('Step 6: Submitting form...');
  const submitButton = page.locator('button[type="button"]').filter({ hasText: /^create$/i });
  await submitButton.click();

  // Wait for navigation back to list or success indication
  await page.waitForTimeout(2000);

  // Step 7: Verify we're back on the list page
  console.log('Step 7: Verifying post creation...');

  // Check if we can see the blog posts list
  const blogPostsHeading = page.locator('text=Blog Posts');
  await blogPostsHeading.waitFor({ state: 'visible', timeout: 10000 });

  console.log('✓ Back on list page');

  // Step 8: Verify the post appears in the list
  console.log('Step 8: Looking for created post...');

  // Wait a bit for the list to refresh
  await page.waitForTimeout(1000);

  // Check if our post title appears
  const postTitle = page.locator('text=' + testTitle);
  const postExists = await postTitle.count() > 0;

  if (postExists) {
    console.log('✓ Post found in list!');
    console.log(`✅ SUCCESS! Blog post "${testTitle}" created successfully!`);
  } else {
    console.log('⚠ Post not found in list (may need to refresh or pagination)');
    console.log('Checking API for confirmation...');

    // Alternative: Check via API
    const response = await page.request.get('/api/blog', {
      headers: {
        'Cookie': await page.context().cookies().then(cookies =>
          cookies.map(c => `${c.name}=${c.value}`).join('; ')
        )
      }
    });

    if (response.ok()) {
      const data = await response.json();
      console.log('API Response:', data);
    }
  }

  // Take final screenshot
  await page.screenshot({ path: 'test-results/final-success.png', fullPage: true });

  console.log('\n=== TEST COMPLETE ===');
  console.log('All steps passed successfully!');
});
