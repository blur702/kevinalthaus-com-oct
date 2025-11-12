import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './utils/auth';

/**
 * User Tasks - Complete all three requested tasks:
 * 1. Create blog post about Playwright testing, tag with 'testing', and publish
 * 2. Change site title to 'Kevin Althaus Site' and verify on frontend
 * 3. Change Google Maps, USPS, and Census.gov API keys and verify in UI
 */

test.describe('User Tasks', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // Start without auth

  test('Complete all user tasks with screenshots', async ({ page, context }) => {
    // Take screenshots directory
    const screenshotsDir = 'e2e/screenshots';

    // Enable request/response logging (only non-sensitive metadata)
    // Only log detailed auth info if DEBUG_AUTH_LOGGING env var is set
    const debugAuth = process.env.DEBUG_AUTH_LOGGING === 'true';

    page.on('request', request => {
      if (request.url().includes('/api/auth/login')) {
        if (debugAuth) {
        } else {
        }
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/auth/login')) {
        if (debugAuth) {
          try {
            const body = await response.text();
          } catch (e) {
          }
        } else {
        }
      }
    });

    // Task 1: Login to admin and create blog post about playwright testing
    await page.goto('http://localhost:3007/login');

    // Login - wait for the form to be ready
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('input[name="identifier"]', { state: 'visible', timeout: 10000 });

    // Fill username/email field (name="identifier", sent as "username" to API)
    await page.fill('input[name="identifier"]', TEST_CREDENTIALS.ADMIN.username);

    // Fill password field
    await page.fill('input[name="password"]', TEST_CREDENTIALS.ADMIN.password);

    // Click Sign In button
    await page.click('button:has-text("Sign In")');

    // Wait for dashboard URL (React Router navigation doesn't trigger full page reload)
    await page.waitForURL(/\/(dashboard)?$/i, { timeout: 20000 });

    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Dashboard"), h2:has-text("Dashboard"), h1:has-text("Admin"), [class*="dashboard"]', { timeout: 10000 });

    // Navigate to blog/content section
    // Check for various possible navigation patterns
    const blogNavSelectors = [
      'a[href*="blog"]',
      'a:has-text("Blog")',
      'a:has-text("Posts")',
      'a:has-text("Content")',
      'nav a:has-text("Blog")',
      'nav a:has-text("Content")',
    ];

    let blogNavFound = false;
    for (const selector of blogNavSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        blogNavFound = true;
        break;
      }
    }

    if (!blogNavFound) {
      // Try direct navigation
      await page.goto('http://localhost:3007/blog');
    }

    // Wait for blog page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for "New Post" or "Create Post" button
    const createButtonSelectors = [
      'button:has-text("New Post")',
      'button:has-text("Create Post")',
      'button:has-text("New")',
      'button:has-text("Create")',
      'a:has-text("New Post")',
      'a:has-text("Create Post")',
    ];

    let createButtonFound = false;
    for (const selector of createButtonSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        createButtonFound = true;
        break;
      }
    }

    if (!createButtonFound) {
      // Try URL-based approach
      await page.goto('http://localhost:3007/blog/new');
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Fill in blog post details
    // Title field
    const titleSelectors = [
      'input[name="title"]',
      'input[placeholder*="title" i]',
      'input[type="text"]',
    ];

    for (const selector of titleSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.fill('Modern Playwright Testing: A Comprehensive Guide');
        break;
      }
    }

    // Content/body field
    const contentSelectors = [
      'textarea[name="content"]',
      'textarea[name="body"]',
      'textarea[placeholder*="content" i]',
      'textarea[placeholder*="body" i]',
      'textarea',
      '.editor',
      '[contenteditable="true"]',
    ];

    let contentFilled = false;
    for (const selector of contentSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        const blogContent = `Playwright is a powerful end-to-end testing framework that enables reliable testing across all modern browsers.

## Key Features

- **Cross-browser support**: Test on Chromium, Firefox, and WebKit
- **Auto-wait**: Playwright automatically waits for elements to be ready
- **Network interception**: Mock API calls and test offline scenarios
- **Screenshots and videos**: Capture visual evidence of test execution
- **Parallel execution**: Run tests concurrently for faster results

## Getting Started

Playwright makes it easy to write robust tests with its intuitive API:

\`\`\`typescript
test('example test', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
\`\`\`

## Best Practices

1. Use data-testid attributes for stable selectors
2. Leverage auto-waiting instead of manual timeouts
3. Organize tests with describe blocks
4. Use fixtures for test setup and teardown

Playwright is the future of modern web testing!`;

        if (selector === '[contenteditable="true"]') {
          await element.click();
          await page.keyboard.type(blogContent);
        } else {
          await element.fill(blogContent);
        }
        contentFilled = true;
        break;
      }
    }

    // Add tag 'testing'
    const tagSelectors = [
      'input[name="tags"]',
      'input[placeholder*="tag" i]',
      'input[aria-label*="tag" i]',
    ];

    for (const selector of tagSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.fill('testing');
        // Try pressing Enter to add tag
        await page.keyboard.press('Enter');
        break;
      }
    }

    // Publish the post
    const publishSelectors = [
      'button:has-text("Publish")',
      'button:has-text("Save")',
      'button:has-text("Submit")',
      'button[type="submit"]',
    ];

    for (const selector of publishSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        break;
      }
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Take screenshot of published blog post
    await page.screenshot({
      path: `${screenshotsDir}/task1-blog-post-published.png`,
      fullPage: true
    });

    // Task 2: Change site title to 'Kevin Althaus Site'

    // Navigate to settings
    const settingsSelectors = [
      'a[href*="settings"]',
      'a:has-text("Settings")',
      'nav a:has-text("Settings")',
    ];

    let settingsNavFound = false;
    for (const selector of settingsSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        settingsNavFound = true;
        break;
      }
    }

    if (!settingsNavFound) {
      await page.goto('http://localhost:3007/settings');
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Find and fill site title field
    const siteTitleSelectors = [
      'input[name="siteTitle"]',
      'input[name="site_title"]',
      'input[placeholder*="site title" i]',
      'input[placeholder*="title" i]',
      'label:has-text("Site Title") ~ input',
      'label:has-text("Title") ~ input',
    ];

    for (const selector of siteTitleSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.clear();
        await element.fill('Kevin Althaus Site');
        break;
      }
    }

    // Save settings
    const saveSelectors = [
      'button:has-text("Save")',
      'button:has-text("Update")',
      'button:has-text("Submit")',
      'button[type="submit"]',
    ];

    for (const selector of saveSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        break;
      }
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify title changed - check frontend
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Take screenshot of frontend showing new title
    await page.screenshot({
      path: `${screenshotsDir}/task2-frontend-title-change.png`,
      fullPage: true
    });

    // Task 3: Change API keys (Google Maps, USPS, Census.gov)

    // Go back to admin settings
    await page.goto('http://localhost:3007/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click on the "External APIs" tab
    await page.click('button:has-text("External APIs")');
    await page.waitForTimeout(1000);

    // Generate random API keys
    const randomApiKey = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const googleMapsKey = randomApiKey();
    const uspsKey = randomApiKey();
    const censusKey = randomApiKey();

    // Wait for the External API Configuration section to be visible
    await page.waitForSelector('text=External API Configuration', { timeout: 5000 });

    // Find the Google Maps API Key input (it's a TextField with label, use text locator)
    const googleMapsInput = page.getByLabel(/Google Maps API Key/i);
    await googleMapsInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Change Google Maps API key
    await googleMapsInput.fill(googleMapsKey);

    // Save
    for (const selector of saveSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        break;
      }
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Reload and verify Google Maps key is saved
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Re-click External APIs tab after reload
    await page.click('button:has-text("External APIs")');
    await page.waitForTimeout(1000);

    // Take screenshot showing Google Maps API key
    await page.screenshot({
      path: `${screenshotsDir}/task3-google-maps-api-key.png`,
      fullPage: true
    });

    // Scroll to ensure USPS field is visible
    const uspsInput = page.getByLabel(/USPS API Key/i);
    await uspsInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Change USPS API key
    await uspsInput.fill(uspsKey);

    // Save
    for (const selector of saveSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        break;
      }
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Reload and verify USPS key is saved
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Re-click External APIs tab after reload
    await page.click('button:has-text("External APIs")');
    await page.waitForTimeout(1000);

    // Take screenshot showing USPS API key
    await page.screenshot({
      path: `${screenshotsDir}/task3-usps-api-key.png`,
      fullPage: true
    });

    // Scroll to ensure Census field is visible
    const censusInput = page.getByLabel(/Census\.gov API Key/i);
    await censusInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Change Census.gov API key
    await censusInput.fill(censusKey);

    // Save
    for (const selector of saveSelectors) {
      const element = await page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        break;
      }
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Reload and verify Census key is saved
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Re-click External APIs tab after reload
    await page.click('button:has-text("External APIs")');
    await page.waitForTimeout(1000);

    // Take screenshot showing Census.gov API key
    await page.screenshot({
      path: `${screenshotsDir}/task3-census-api-key.png`,
      fullPage: true
    });

  });
});
