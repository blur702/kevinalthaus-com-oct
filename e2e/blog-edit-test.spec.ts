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
    }
  });

  // Step 1: Login
  await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

  // Step 2: Navigate to Content page
  await page.goto('/content');
  await page.waitForLoadState('domcontentloaded');
  expect(page.url()).toContain('/content');

  // Step 3: Wait for blog posts list to load
  await page.waitForSelector('table', { state: 'visible', timeout: 10000 });

  // Step 4: Find the first post and click its edit button

  // Wait for the three-dot menu button in the table
  // The button is in the last cell of each table row
  const firstMenuButton = page.locator('tbody tr').first().locator('button').last();
  await firstMenuButton.waitFor({ state: 'visible', timeout: 10000 });

  // Click the menu button
  await firstMenuButton.click();

  // Wait for the menu to appear and click Edit
  const editMenuItem = page.locator('li').filter({ hasText: /^Edit$/i });
  await editMenuItem.waitFor({ state: 'visible', timeout: 5000 });
  await editMenuItem.click();

  // Step 5: Wait for edit form to appear
  await page.waitForSelector('input[name="title"]', { state: 'visible', timeout: 10000 });

  // Step 6: Change the content
  await page.fill('textarea[name="body_html"]', 'THIS has been EDITED');

  // Step 7: Submit the form
  const updateButton = page.locator('button[type="button"]').filter({ hasText: /^Update$/i });
  await updateButton.click();

  // Wait for navigation back to list or success indication
  await page.waitForTimeout(2000);

  // Step 8: Verify we're back on the list page
  const blogPostsHeading = page.locator('text=Blog Posts');
  await blogPostsHeading.waitFor({ state: 'visible', timeout: 10000 });

  // Step 9: Verify the edit by re-opening the post

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

  expect(contentValue).toBe('THIS has been EDITED');

  // Take final screenshot
  await page.screenshot({ path: 'test-results/edit-success.png', fullPage: true });

});
