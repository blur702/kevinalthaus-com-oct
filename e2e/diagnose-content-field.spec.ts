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
      console.log(`[BROWSER ${msg.type().toUpperCase()}]: ${msg.text()}`);
    });

    // Enable page error logging
    page.on('pageerror', (error) => {
      console.error(`[PAGE ERROR]: ${error.message}\n${error.stack}`);
    });

    // Login
    console.log('Step 1: Logging in...');
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
    console.log('✓ Login successful');

    // Navigate to content page
    console.log('Step 2: Navigating to content page...');
    await page.goto('/content');
    await page.waitForLoadState('domcontentloaded');
    console.log('✓ Content page loaded');

    // Click Create New Post
    console.log('Step 3: Looking for Create New Post button...');
    const createButton = page.locator('button').filter({ hasText: /create new post/i });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Create button found');

    await createButton.click();
    console.log('✓ Create button clicked');

    // Wait for form to appear
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/content-field-form.png', fullPage: true });

    // Find the content field - try multiple selectors
    console.log('Step 4: Finding content field...');

    // Try to find by label
    let contentField = page.locator('textarea[name="body_html"]').first();
    let fieldFound = await contentField.count() > 0;
    console.log(`  - textarea[name="body_html"]: ${fieldFound ? 'FOUND' : 'NOT FOUND'}`);

    if (!fieldFound) {
      // Try to find the MUI TextField multiline
      contentField = page.locator('label:has-text("Content")').locator('..').locator('textarea').first();
      fieldFound = await contentField.count() > 0;
      console.log(`  - Via "Content" label: ${fieldFound ? 'FOUND' : 'NOT FOUND'}`);
    }

    if (!fieldFound) {
      // Try any textarea
      const allTextareas = page.locator('textarea');
      const textareaCount = await allTextareas.count();
      console.log(`  - Total textareas on page: ${textareaCount}`);

      if (textareaCount > 0) {
        contentField = allTextareas.first();
        fieldFound = true;
        console.log(`  - Using first textarea`);
      }
    }

    if (!fieldFound) {
      console.error('❌ FAILED: Could not find content field!');

      // Dump the page HTML for debugging
      const html = await page.content();
      console.log('Page HTML (first 2000 chars):', html.substring(0, 2000));

      throw new Error('Content field not found on page');
    }

    console.log('✓ Content field found');

    // Check if field is visible
    const isVisible = await contentField.isVisible();
    console.log(`  - Field visible: ${isVisible}`);

    // Check if field is enabled
    const isEnabled = await contentField.isEnabled();
    console.log(`  - Field enabled: ${isEnabled}`);

    // Check if field is editable
    const isEditable = await contentField.isEditable();
    console.log(`  - Field editable: ${isEditable}`);

    // Get initial value
    const initialValue = await contentField.inputValue();
    console.log(`  - Initial value: "${initialValue}"`);

    // Check for any readonly/disabled attributes
    const hasReadonly = await contentField.getAttribute('readonly');
    const hasDisabled = await contentField.getAttribute('disabled');
    console.log(`  - Readonly attribute: ${hasReadonly}`);
    console.log(`  - Disabled attribute: ${hasDisabled}`);

    // Try to focus the field
    console.log('Step 5: Attempting to focus and type...');
    try {
      await contentField.focus();
      console.log('✓ Field focused successfully');
    } catch (error: any) {
      console.error(`❌ Focus failed: ${error.message}`);
    }

    // Take screenshot after focus
    await page.screenshot({ path: 'test-results/content-field-focused.png', fullPage: true });

    // Try to type
    const testText = 'This is a test of the content field';
    console.log(`  - Attempting to type: "${testText}"`);

    try {
      await contentField.fill(testText);
      console.log('✓ Fill command executed');
    } catch (error: any) {
      console.error(`❌ Fill failed: ${error.message}`);
    }

    // Wait a bit for React to update
    await page.waitForTimeout(500);

    // Check the value after typing
    const afterValue = await contentField.inputValue();
    console.log(`  - Value after fill: "${afterValue}"`);

    // Take screenshot after typing
    await page.screenshot({ path: 'test-results/content-field-after-type.png', fullPage: true });

    // Try alternative typing method
    if (afterValue !== testText) {
      console.log('Step 6: Trying alternative typing method (type instead of fill)...');
      await contentField.clear();
      await contentField.type('Alternative typing test', { delay: 50 });
      await page.waitForTimeout(500);

      const afterType = await contentField.inputValue();
      console.log(`  - Value after type: "${afterType}"`);
    }

    // Check React component state in the browser
    console.log('Step 7: Checking React component state...');
    const reactState = await page.evaluate(() => {
      // Try to find the textarea element
      const textarea = document.querySelector('textarea');
      if (!textarea) return { error: 'No textarea found in DOM' };

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
    console.log('React state:', JSON.stringify(reactState, null, 2));

    // Summary
    console.log('\n========== DIAGNOSTIC SUMMARY ==========');
    console.log(`Content field found: ${fieldFound}`);
    console.log(`Visible: ${isVisible}`);
    console.log(`Enabled: ${isEnabled}`);
    console.log(`Editable: ${isEditable}`);
    console.log(`Initial value: "${initialValue}"`);
    console.log(`After fill: "${afterValue}"`);
    console.log(`Fill successful: ${afterValue === testText}`);
    console.log('=========================================\n');

    // Assertions
    expect(fieldFound, 'Content field should be found').toBe(true);
    expect(isVisible, 'Content field should be visible').toBe(true);
    expect(isEnabled, 'Content field should be enabled').toBe(true);
    expect(isEditable, 'Content field should be editable').toBe(true);
    expect(afterValue, 'Content should update after typing').toBe(testText);
  });
});
