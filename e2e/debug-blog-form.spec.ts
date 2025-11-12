/**
 * Debug test to diagnose blog form rendering issue
 */

import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

test('Debug: Click Create New Post and see what happens', async ({ page }) => {
  // Enable console logging
  page.on('console', (msg) => {
  });

  // Enable page error logging
  page.on('pageerror', (error) => {
  });

  // Login
  await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

  // Navigate to content page (without waiting for networkidle)
  await page.goto('/content');
  await page.waitForLoadState('domcontentloaded');

  // Take screenshot of list view
  await page.screenshot({ path: 'test-results/debug-list-view.png', fullPage: true });

  // Wait for the Create New Post button
  const createButton = page.locator('button').filter({ hasText: /create new post/i });
  await createButton.waitFor({ state: 'visible', timeout: 10000 });


  // Click the button
  await createButton.click();


  // Wait a bit for any state changes
  await page.waitForTimeout(2000);

  // Take screenshot after click
  await page.screenshot({ path: 'test-results/debug-after-click.png', fullPage: true });

  // Check if form appeared
  const titleInput = page.locator('input[name="title"]');
  const formVisible = await titleInput.isVisible().catch(() => false);


  // Check what's on the page
  const bodyText = await page.textContent('body');

  // Take another screenshot
  await page.screenshot({ path: 'test-results/debug-final.png', fullPage: true });

  // Check for any React errors
  const reactErrors = await page.locator('[class*="error"]').count();
});
