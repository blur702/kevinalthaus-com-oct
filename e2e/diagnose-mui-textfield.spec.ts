/**
 * Deep diagnostic test for MUI TextField multiline rendering
 */

import { test } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

test('Deep dive: MUI TextField structure', async ({ page }) => {
  // Login
  await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

  // Navigate to content page
  await page.goto('/content');
  await page.waitForLoadState('domcontentloaded');

  // Click Create New Post
  const createButton = page.locator('button').filter({ hasText: /create new post/i });
  await createButton.waitFor({ state: 'visible' });
  await createButton.click();
  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/mui-structure.png', fullPage: true });

  // Get ALL textareas on the page
  console.log('\n========== ALL TEXTAREAS ==========');
  const allTextareas = await page.evaluate(() => {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    return textareas.map((ta, index) => {
      const styles = window.getComputedStyle(ta);
      return {
        index,
        name: ta.getAttribute('name'),
        id: ta.id,
        value: ta.value,
        className: ta.className,
        visible: styles.display !== 'none' && styles.visibility !== 'hidden',
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        width: styles.width,
        height: styles.height,
        top: styles.top,
        left: styles.left,
        boundingBox: ta.getBoundingClientRect(),
      };
    });
  });

  allTextareas.forEach((ta) => {
    console.log(`\nTextarea #${ta.index}:`);
    console.log(`  Name: ${ta.name}`);
    console.log(`  ID: ${ta.id}`);
    console.log(`  Class: ${ta.className}`);
    console.log(`  Visible: ${ta.visible}`);
    console.log(`  Opacity: ${ta.opacity}`);
    console.log(`  Position: ${ta.position}`);
    console.log(`  Z-Index: ${ta.zIndex}`);
    console.log(`  Size: ${ta.width} x ${ta.height}`);
    console.log(`  Location: top=${ta.top}, left=${ta.left}`);
    console.log(`  BoundingBox:`, ta.boundingBox);
  });

  // Check if there's a shadow input or hidden div
  console.log('\n========== MUI TEXTFIELD STRUCTURE ==========');
  const muiStructure = await page.evaluate(() => {
    // Find the Content label
    const labels = Array.from(document.querySelectorAll('label'));
    const contentLabel = labels.find((l) => l.textContent?.includes('Content'));

    if (!contentLabel) {return { error: 'Content label not found' };}

    // Get the parent MUI TextField
    const textField = contentLabel.closest('.MuiFormControl-root');
    if (!textField) {return { error: 'MuiFormControl not found' };}

    // Get all children
    const children = Array.from(textField.querySelectorAll('*')).map((el) => {
      const styles = window.getComputedStyle(el);
      return {
        tagName: el.tagName,
        className: el.className,
        opacity: styles.opacity,
        display: styles.display,
        position: styles.position,
        hasText: el.textContent?.length || 0,
      };
    });

    return { children };
  });

  console.log('MUI Structure:', JSON.stringify(muiStructure, null, 2));

  // Try clicking where the user would click
  console.log('\n========== CLICK TEST ==========');
  const contentLabel = page.locator('label:has-text("Content")');
  const boundingBox = await contentLabel.boundingBox();

  if (boundingBox) {
    // Click below the label (where the input should be)
    const clickX = boundingBox.x + 100;
    const clickY = boundingBox.y + boundingBox.height + 50;

    console.log(`Clicking at coordinates: (${clickX}, ${clickY})`);
    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(500);

    // Check what element is focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) {return { error: 'No focused element' };}

      const styles = window.getComputedStyle(el);
      return {
        tagName: el.tagName,
        name: (el as any).name,
        className: el.className,
        opacity: styles.opacity,
        display: styles.display,
        isFocused: document.activeElement === el,
      };
    });

    console.log('Focused element after click:', JSON.stringify(focusedElement, null, 2));

    // Take screenshot after click
    await page.screenshot({ path: 'test-results/after-click.png', fullPage: true });

    // Try typing
    await page.keyboard.type('Test typing');
    await page.waitForTimeout(500);

    // Check textarea value
    const textareaValue = await page.locator('textarea').first().inputValue();
    console.log(`Textarea value after typing: "${textareaValue}"`);

    // Take final screenshot
    await page.screenshot({ path: 'test-results/after-typing.png', fullPage: true });
  }
});
