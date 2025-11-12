/**
 * Diagnostic test for content field typing issue
 *
 * This test specifically diagnoses why users cannot type in the content field
 */

import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

test.describe('Content Field Diagnostic', () => {
  test('Diagnose content field typing issue', async ({ page }) => {
    // Enable detailed console logging
    page.on('console', (msg) => {
    });

    // Enable page error logging
    page.on('pageerror', (error) => {
    });

    // Login
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

    // Navigate to content page
    await page.goto('/content');
    await page.waitForLoadState('domcontentloaded');

    // Click Create New Post
    const createButton = page.locator('button').filter({ hasText: /create new post/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });

    await createButton.click();

    // Wait for form to appear
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/content-field-form.png', fullPage: true });

    // Find the content field - try multiple selectors

    // Try to find by label
    let contentField = page.locator('textarea[name="body_html"]').first();
    let fieldFound = await contentField.count() > 0;

    if (!fieldFound) {
      // Try to find the MUI TextField multiline
      contentField = page.locator('label:has-text("Content")').locator('..').locator('textarea').first();
      fieldFound = await contentField.count() > 0;
    }

    if (!fieldFound) {
      // Try any textarea
      const allTextareas = page.locator('textarea');
      const textareaCount = await allTextareas.count();

      if (textareaCount > 0) {
        contentField = allTextareas.first();
        fieldFound = true;
      }
    }

    if (!fieldFound) {

      // Dump the page HTML for debugging
      const html = await page.content();

      throw new Error('Content field not found on page');
    }


    // Check if field is visible
    const isVisible = await contentField.isVisible();

    // Check if field is enabled
    const isEnabled = await contentField.isEnabled();

    // Check if field is editable
    const isEditable = await contentField.isEditable();

    // Get initial value
    const initialValue = await contentField.inputValue();

    // Check for any readonly/disabled attributes
    const hasReadonly = await contentField.getAttribute('readonly');
    const hasDisabled = await contentField.getAttribute('disabled');

    // Try to focus the field
    try {
      await contentField.focus();
    } catch (error: any) {
    }

    // Take screenshot after focus
    await page.screenshot({ path: 'test-results/content-field-focused.png', fullPage: true });

    // Try to type
    const testText = 'This is a test of the content field';

    try {
      await contentField.fill(testText);
    } catch (error: any) {
    }

    // Wait a bit for React to update
    await page.waitForTimeout(500);

    // Check the value after typing
    const afterValue = await contentField.inputValue();

    // Take screenshot after typing
    await page.screenshot({ path: 'test-results/content-field-after-type.png', fullPage: true });

    // Try alternative typing method
    if (afterValue !== testText) {
      await contentField.clear();
      await contentField.type('Alternative typing test', { delay: 50 });
      await page.waitForTimeout(500);

      const afterType = await contentField.inputValue();
    }

    // Check React component state in the browser
    const reactState = await page.evaluate(() => {
      // Try to find the textarea element
      const textarea = document.querySelector('textarea');
      if (!textarea) {return { error: 'No textarea found in DOM' };}

      return {
        value: textarea.value,
        disabled: textarea.disabled,
        readOnly: textarea.readOnly,
        style: {
          display: window.getComputedStyle(textarea).display,
          pointerEvents: window.getComputedStyle(textarea).pointerEvents,
          opacity: window.getComputedStyle(textarea).opacity,
        },
        parent: {
          tagName: textarea.parentElement?.tagName,
          className: textarea.parentElement?.className,
        },
      };
    });

    // Summary

    // Assertions
    expect(fieldFound, 'Content field should be found').toBe(true);
    expect(isVisible, 'Content field should be visible').toBe(true);
    expect(isEnabled, 'Content field should be enabled').toBe(true);
    expect(isEditable, 'Content field should be editable').toBe(true);
    expect(afterValue, 'Content should update after typing').toBe(testText);
  });
});
