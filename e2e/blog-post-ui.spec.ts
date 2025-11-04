import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

/**
 * Blog Post UI Test
 * Tests blog post creation through the admin UI
 */

test.describe('Blog Post UI', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure backend is up before attempting login
    for (let i = 0; i < 30; i++) {
      try {
        const res = await page.request.get('http://127.0.0.1:3000/health');
        if (res.ok()) break;
      } catch {}
      await page.waitForTimeout(1000);
    }
    await login(
      page,
      TEST_CREDENTIALS.ADMIN.username,
      TEST_CREDENTIALS.ADMIN.password
    );
  });

  test('should create a blog post via UI', async ({ page }) => {
    // Navigate to content management page
    await page.goto('/content');

    // Wait for a reliable UI element instead of networkidle
    await page.waitForSelector('text=Create New Post', { timeout: 20000 });

    // Click Create New Post
    await page.getByRole('button', { name: /create new post/i }).click();

    // Wait for the form to appear
    await page.waitForSelector('input[name="title"]', { timeout: 10000 });

    // Fill in the blog post form
    await page.fill('input[name="title"]', 'Test Blog Post from UI');

    // Fill the WYSIWYG via hidden textarea
    await page.fill('textarea[name="body_html"]', 'This is a test post created through the UI.');

    // Optional excerpt
    const excerptField = page.locator('textarea[name="excerpt"], input[name="excerpt"]').first();
    if (await excerptField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await excerptField.fill('A test post from UI');
    }

    // Submit the form
    // Ensure CSRF token cookie is fresh in the browser context before submit
    await page.evaluate(async () => {
      try {
        await fetch('/api/auth/csrf-token', { credentials: 'include' });
      } catch {}
    });
    await page.locator('button', { hasText: /create|save|publish/i }).first().click();

    // Verify we returned to list view
    await page.waitForSelector('text=Blog Posts', { timeout: 20000 });
    const created = await page.locator('text=Test Blog Post from UI').isVisible({ timeout: 5000 }).catch(() => false);
    expect(created).toBeTruthy();
  });
});
