import { test, expect } from '@playwright/test';

test.describe('Production Frontend Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');

    // Check HTTP status
    expect(response?.status()).toBe(200);

    // Check page title
    await expect(page).toHaveTitle(/Kevin Althaus/);
  });

  test('React app renders correctly', async ({ page }) => {
    await page.goto('/');

    // Wait for React to mount
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Wait until the root container has rendered child nodes to avoid racing React mounting
    await page.waitForFunction(
      () => {
        const element = document.getElementById('root');
        return !!element && element.childElementCount > 0;
      },
      undefined,
      { timeout: 10000 }
    );

    // Check that content has loaded (root should not be empty)
    const hasContent = await root.evaluate((el) => el.children.length > 0);
    expect(hasContent).toBe(true);
  });

  test('JavaScript bundle loads', async ({ page }) => {
    const jsRequests: string[] = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/assets/') && url.endsWith('.js')) {
        jsRequests.push(url);
      }
    });

    await page.goto('/');

    // Wait for network to be idle
    await page.waitForLoadState('networkidle');

    // Should have loaded at least one JS bundle
    expect(jsRequests.length).toBeGreaterThan(0);

    // All JS bundles should return 200
    for (const url of jsRequests) {
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
    }
  });

  test('CSS bundle loads', async ({ page }) => {
    const cssRequests: string[] = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/assets/') && url.endsWith('.css')) {
        cssRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have loaded at least one CSS bundle
    expect(cssRequests.length).toBeGreaterThan(0);

    // All CSS bundles should return 200
    for (const url of cssRequests) {
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
    }
  });

  test('meta tags are properly configured', async ({ page }) => {
    await page.goto('/');

    // Check viewport meta tag
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);

    // Check description meta tag
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /.+/);
  });

  test('no critical console errors on page load', async ({ page }) => {
    type ConsoleEntry = {
      text: string;
      type: string;
      location?: string;
      url?: string;
    };

    const consoleErrors: ConsoleEntry[] = [];

    page.on('console', (msg) => {
      if (msg.type() !== 'error') {
        return;
      }
      const location = msg.location();
      consoleErrors.push({
        text: msg.text(),
        type: msg.type(),
        location:
          location && location.url
            ? `${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`
            : undefined,
        url: location?.url,
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected errors using precise regex allow-list
    const allowedPatterns = [
      /\bstatus(?:\s+code)?\s+(?:404|429|503)\b/i,
      /^Failed to fetch\b/i,
      /^Load failed/i,
      /^Could not connect/i,
      /NetworkError when attempting to fetch resource/i,
      /\bCORS\b/i,
      /\bCross-Origin\b/i,
    ];

    const criticalErrors = consoleErrors.filter(
      (entry) => !allowedPatterns.some((pattern) => pattern.test(entry.text))
    );

    if (criticalErrors.length > 0) {
      console.log('Unexpected console errors detected:', criticalErrors);
    }

    // Should have no critical console errors
    expect(criticalErrors).toEqual([]);
  });

  test('page is responsive', async ({ page }) => {
    await page.goto('/');

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(root).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(root).toBeVisible();
  });
});
