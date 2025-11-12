/**
 * E2E tests for the custom WYSIWYG editor
 */

import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:3003';
const EDITOR_TEST_URL = `${ADMIN_URL}/editor-test`;

// Login helper
async function login(page: any) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.fill('input[name="identifier"]', 'kevin@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${ADMIN_URL}/`, { timeout: 30000 });
}

test.describe('Editor Test Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(EDITOR_TEST_URL);
  });

  test('should load the editor test page', async ({ page }) => {
    await expect(page.getByTestId('editor-test-title')).toBeVisible();
    await expect(page.getByTestId('editor-test-title')).toHaveText('Editor Test Page');
  });

  test('should render the editor with toolbar', async ({ page }) => {
    // Check if editor container exists
    await expect(page.getByTestId('editor-container')).toBeVisible();

    // Check if toolbar exists
    const toolbar = page.locator('.editor-toolbar');
    await expect(toolbar).toBeVisible();

    // Check if editor core exists
    const editorCore = page.locator('.editor-core');
    await expect(editorCore).toBeVisible();
  });

  test('should have all toolbar buttons', async ({ page }) => {
    const toolbar = page.locator('.editor-toolbar');

    // Check for bold button
    const boldButton = toolbar.locator('button[aria-label="Bold"]');
    await expect(boldButton).toBeVisible();

    // Check for italic button
    const italicButton = toolbar.locator('button[aria-label="Italic"]');
    await expect(italicButton).toBeVisible();

    // Check for heading button
    const h1Button = toolbar.locator('button[aria-label="Heading 1"]');
    await expect(h1Button).toBeVisible();

    // Check for link button
    const linkButton = toolbar.locator('button[aria-label="Link"]');
    await expect(linkButton).toBeVisible();

    // Check for image button
    const imageButton = toolbar.locator('button[aria-label="Image"]');
    await expect(imageButton).toBeVisible();
  });
});

test.describe('Editor Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(EDITOR_TEST_URL);
  });

  test('should allow typing text', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Click into editor
    await editorCore.click();

    // Type some text
    await page.keyboard.type('Hello world!');

    // Verify text was entered
    await expect(editorCore).toContainText('Hello world!');
  });

  test('should clear content when clear button is clicked', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Type some text
    await editorCore.click();
    await page.keyboard.type('Test content');

    // Click clear button
    await page.getByTestId('clear-button').click();

    // Verify content is cleared
    const content = await editorCore.textContent();
    expect(content?.trim()).toBe('');
  });

  test('should load sample content', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Click load sample button
    await page.getByTestId('load-sample-button').click();

    // Wait for content to load
    await page.waitForTimeout(500);

    // Verify sample content loaded
    await expect(editorCore).toContainText('Welcome to the Editor');
  });

  test('should toggle HTML view', async ({ page }) => {
    // Initially HTML output should not be visible
    await expect(page.getByTestId('html-output')).not.toBeVisible();

    // Click toggle button
    await page.getByTestId('toggle-html-button').click();

    // HTML output should now be visible
    await expect(page.getByTestId('html-output')).toBeVisible();

    // Click toggle button again
    await page.getByTestId('toggle-html-button').click();

    // HTML output should be hidden again
    await expect(page.getByTestId('html-output')).not.toBeVisible();
  });
});

test.describe('Editor Formatting', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(EDITOR_TEST_URL);
  });

  test('should apply bold formatting', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Type some text
    await editorCore.click();
    await page.keyboard.type('Bold text');

    // Select all text
    await page.keyboard.press('Control+A');

    // Click bold button
    const boldButton = page.locator('button[aria-label="Bold"]');
    await boldButton.click();

    // Verify bold was applied
    const boldElement = editorCore.locator('strong, b');
    await expect(boldElement).toBeVisible();
    await expect(boldElement).toContainText('Bold text');

    // Verify button is active
    await expect(boldButton).toHaveClass(/active/);
  });

  test('should apply italic formatting', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Type some text
    await editorCore.click();
    await page.keyboard.type('Italic text');

    // Select all text
    await page.keyboard.press('Control+A');

    // Click italic button
    const italicButton = page.locator('button[aria-label="Italic"]');
    await italicButton.click();

    // Verify italic was applied
    const italicElement = editorCore.locator('em, i');
    await expect(italicElement).toBeVisible();
    await expect(italicElement).toContainText('Italic text');

    // Verify button is active
    await expect(italicButton).toHaveClass(/active/);
  });

  test('should apply heading 1 format', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Type some text
    await editorCore.click();
    await page.keyboard.type('Heading text');

    // Click H1 button
    const h1Button = page.locator('button[aria-label="Heading 1"]');
    await h1Button.click();

    // Verify H1 was applied
    const h1Element = editorCore.locator('h1');
    await expect(h1Element).toBeVisible();
    await expect(h1Element).toContainText('Heading text');

    // Verify button is active
    await expect(h1Button).toHaveClass(/active/);
  });
});

test.describe('Editor Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page, browserName }) => {
    /**
     * Skip keyboard shortcut tests in Firefox due to browser-specific limitation.
     *
     * Firefox has known issues with execCommand when triggered via keyboard shortcuts
     * in automated testing environments. This is a browser implementation detail, not
     * a test interdependency issue.
     *
     * The toolbar button tests in "Editor Formatting" describe block verify the same
     * functionality works in Firefox when triggered via UI clicks.
     *
     * See: https://bugzilla.mozilla.org/show_bug.cgi?id=1490323
     */
    test.skip(browserName === 'firefox', 'Firefox does not support execCommand via keyboard shortcuts in automated testing');

    await login(page);
    await page.goto(EDITOR_TEST_URL);
  });

  test('should apply bold with Ctrl+B', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Type some text
    await editorCore.click();
    await page.keyboard.type('Bold with shortcut');

    // Select all text
    await page.keyboard.press('Control+A');

    // Press Ctrl+B
    await page.keyboard.press('Control+B');

    // Verify bold was applied
    const boldElement = editorCore.locator('strong, b');
    await expect(boldElement).toBeVisible();
    await expect(boldElement).toContainText('Bold with shortcut');
  });

  test('should apply italic with Ctrl+I', async ({ page }) => {
    const editorCore = page.locator('.editor-core');

    // Type some text
    await editorCore.click();
    await page.keyboard.type('Italic with shortcut');

    // Select all text
    await page.keyboard.press('Control+A');

    // Press Ctrl+I
    await page.keyboard.press('Control+I');

    // Verify italic was applied
    const italicElement = editorCore.locator('em, i');
    await expect(italicElement).toBeVisible();
    await expect(italicElement).toContainText('Italic with shortcut');
  });
});

test.describe('Editor Content Preview', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(EDITOR_TEST_URL);
  });

  test('should update preview when content changes', async ({ page }) => {
    const editorCore = page.locator('.editor-core');
    const preview = page.getByTestId('content-preview');

    // Type some text
    await editorCore.click();
    await page.keyboard.type('Preview test');

    // Wait for update
    await page.waitForTimeout(300);

    // Verify preview updated
    await expect(preview).toContainText('Preview test');
  });
});
