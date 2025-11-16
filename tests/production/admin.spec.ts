import { test, expect } from '@playwright/test';

test.describe('Production Admin Dashboard Tests', () => {
  test('admin dashboard loads successfully', async ({ page }) => {
    const response = await page.goto('/admin');

    // Check HTTP status
    expect(response?.status()).toBe(200);

    // Check page title
    await expect(page).toHaveTitle(/Admin Dashboard/);
  });

  test('React app renders correctly', async ({ page }) => {
    await page.goto('/admin');

    // Wait for React to mount
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Check that content has loaded
    const hasContent = await root.evaluate(el => el.children.length > 0);
    expect(hasContent).toBe(true);
  });

  test('JavaScript bundle loads via nginx proxy', async ({ page }) => {
    const jsRequests: Array<{ url: string; status: number }> = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/admin/assets/') && url.endsWith('.js')) {
        jsRequests.push({
          url,
          status: response.status(),
        });
      }
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should have loaded at least one JS bundle
    expect(jsRequests.length).toBeGreaterThan(0);

    // All JS bundles should return 200 (this was the bug we fixed!)
    for (const request of jsRequests) {
      expect(request.status).toBe(200);
    }
  });

  test('CSS bundle loads via nginx proxy', async ({ page }) => {
    const cssRequests: Array<{ url: string; status: number }> = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/admin/assets/') && url.endsWith('.css')) {
        cssRequests.push({
          url,
          status: response.status(),
        });
      }
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should have loaded at least one CSS bundle
    expect(cssRequests.length).toBeGreaterThan(0);

    // All CSS bundles should return 200
    for (const request of cssRequests) {
      expect(request.status).toBe(200);
    }
  });

  test('admin has SEO protection (noindex)', async ({ page }) => {
    await page.goto('/admin');

    // Check for noindex meta tag
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });

  test('admin favicon is configured', async ({ page }) => {
    await page.goto('/admin');

    // Check for admin-specific favicon
    const favicon = page.locator('link[rel="icon"]');
    const href = await favicon.getAttribute('href');
    expect(href).toContain('favicon-admin');
  });

  test('no 404 errors for critical assets', async ({ page }) => {
    const failedRequests: Array<{ url: string; status: number }> = [];

    page.on('response', response => {
      if (response.status() === 404) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Filter out optional resources (like theme overrides with onerror handlers)
    const criticalFailures = failedRequests.filter(
      req =>
        !req.url.includes('theme-overrides.css') &&
        !req.url.includes('favicon') &&
        !req.url.includes('apple-touch-icon')
    );

    // Should have no 404 errors for critical assets
    expect(criticalFailures).toEqual([]);
  });

  test('no critical console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Filter out expected errors (API failures, auth errors, missing optional resources)
    const criticalErrors = consoleErrors.filter(
      error =>
        !error.includes('401') &&
        !error.includes('404') &&
        !error.includes('503') &&
        !error.includes('429') &&
        !error.includes('Unauthorized') &&
        !error.includes('Failed to fetch') &&
        !error.includes('Could not connect') &&
        !error.includes('Load failed') &&
        !error.toLowerCase().includes('failed to load resource')
    );

    // Should have no critical console errors
    expect(criticalErrors).toEqual([]);
  });

  test('admin assets have correct content-type headers', async ({ page }) => {
    const assetResponses: Array<{
      url: string;
      contentType: string | null;
    }> = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/admin/assets/')) {
        assetResponses.push({
          url,
          contentType: response.headers()['content-type'],
        });
      }
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Check JS files have correct content-type
    const jsFiles = assetResponses.filter(r => r.url.endsWith('.js'));
    for (const file of jsFiles) {
      expect(file.contentType).toMatch(/javascript|text\/javascript|application\/javascript/);
    }

    // Check CSS files have correct content-type
    const cssFiles = assetResponses.filter(r => r.url.endsWith('.css'));
    for (const file of cssFiles) {
      expect(file.contentType).toMatch(/css|text\/css/);
    }
  });
});
