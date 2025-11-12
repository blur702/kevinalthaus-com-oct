import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

test('Create blog post via WYSIWYG: Here, there, and Codex', async ({ page }) => {
  // Log console and request failures for monitoring
  page.on('console', (msg) => console.log(`BROWSER ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.log(`PAGEERROR: ${err.message}`));
  page.on('requestfailed', (req) => console.log(`REQUEST FAILED: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`));

  // Ensure backend health before login
  for (let i = 0; i < 40; i++) {
    try {
      const res = await page.request.get('http://localhost:3001/health');
      if (res.ok()) {break;}
    } catch (error) {
      // Intentionally silent - health check retries expected during backend startup
    }
    await page.waitForTimeout(1000);
  }

  // Try login; if it fails, attempt registration then login again
  await page.goto('/login');
  await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  await page.fill('input[name="identifier"]', TEST_CREDENTIALS.ADMIN.username);
  await page.fill('input[name="password"]', TEST_CREDENTIALS.ADMIN.password);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 8000 });
  } catch {
    // Fallback: register the user, then login
    await page.goto('/register');
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', TEST_CREDENTIALS.ADMIN.username);
    await page.fill('input[name="email"]', `${TEST_CREDENTIALS.ADMIN.username}@example.com`);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.ADMIN.password);
    await page.click('button[type="submit"]');
    // Ignore duplicate user errors; proceed to login again
    await page.goto('/login');
    await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
    await page.fill('input[name="identifier"]', TEST_CREDENTIALS.ADMIN.username);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.ADMIN.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });
  }

  // Navigate to Content
  await page.goto('/content');
  await page.waitForSelector('text=Create New Post', { timeout: 20000 });
  await page.getByRole('button', { name: /create new post/i }).click();

  // Fill form
  await page.waitForSelector('input[name="title"]', { timeout: 10000 });
  const title = 'Here, there, and Codex';
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="body_html"]', 'This post was created via Playwright using the WYSIWYG editor.');

  // Ensure CSRF is fresh before submit
  await page.evaluate(async () => {
    try {
      await fetch('/api/auth/csrf-token', { credentials: 'include' });
    } catch (error) {
      // Intentionally silent - CSRF token fetch is best-effort before submit
    }
  });

  // Submit
  await page.locator('button', { hasText: /create|save|publish/i }).first().click();

  // Verify back on list and the title exists
  await page.waitForSelector('text=Blog Posts', { timeout: 20000 });
  const created = await page.locator(`text=${title}`).isVisible({ timeout: 5000 }).catch(() => false);
  expect(created).toBeTruthy();
});

