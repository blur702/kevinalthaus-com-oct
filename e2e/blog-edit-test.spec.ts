/**
 * Blog Post Edit Test
 * Tests editing an existing blog post
 */

import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

test('Edit existing blog post', async ({ page }) => {
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

  // Step 3: Wait for blog posts list to load
  console.log('Step 3: Waiting for blog posts list...');
  await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
  console.log('✓ Blog posts list loaded');

  // Step 4: Find the first post and click its edit button
  console.log('Step 4: Finding first blog post...');

  // Wait for the three-dot menu button in the table
  // The button is in the last cell of each table row
  const firstMenuButton = page.locator('tbody tr').first().locator('button').last();
  await firstMenuButton.waitFor({ state: 'visible', timeout: 10000 });

  // Click the menu button
  console.log('Clicking menu button...');
  await firstMenuButton.click();

  // Wait for the menu to appear and click Edit
  console.log('Waiting for Edit option...');
  const editMenuItem = page.locator('li').filter({ hasText: /^Edit$/i });
  await editMenuItem.waitFor({ state: 'visible', timeout: 5000 });
  await editMenuItem.click();
  console.log('✓ Clicked Edit');

  // Step 5: Wait for edit form to appear
  console.log('Step 5: Waiting for edit form...');
  await page.waitForSelector('input[name="title"]', { state: 'visible', timeout: 10000 });
  console.log('✓ Edit form visible');

  // Step 6: Change the content
  console.log('Step 6: Changing content...');
  await page.fill('textarea[name="body_html"]', 'THIS has been EDITED');
  console.log('✓ Content changed to "THIS has been EDITED"');

  // Step 7: Submit the form
  console.log('Step 7: Submitting form...');
  const updateButton = page.locator('button[type="button"]').filter({ hasText: /^Update$/i });
  await updateButton.click();

  // Wait for navigation back to list or success indication
  await page.waitForTimeout(2000);

  // Step 8: Verify we're back on the list page
  console.log('Step 8: Verifying update...');
  const blogPostsHeading = page.locator('text=Blog Posts');
  await blogPostsHeading.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Back on list page');

  // Step 9: Verify the edit by re-opening the post
  console.log('Step 9: Verifying the edit...');

  // Click menu button again
  await firstMenuButton.click();

  // Click Edit again
  const editMenuItem2 = page.locator('li').filter({ hasText: /^Edit$/i });
  await editMenuItem2.waitFor({ state: 'visible', timeout: 5000 });
  await editMenuItem2.click();

  // Wait for form
  await page.waitForSelector('textarea[name="body_html"]', { state: 'visible', timeout: 10000 });

  // Verify content
  const contentValue = await page.locator('textarea[name="body_html"]').inputValue();
  console.log(`Content value: ${contentValue}`);

  expect(contentValue).toBe('THIS has been EDITED');
  console.log('✓ Edit verified!');

  // Take final screenshot
  await page.screenshot({ path: 'test-results/edit-success.png', fullPage: true });

  console.log('\n=== TEST COMPLETE ===');
  console.log('✅ Blog post successfully edited!');
});
