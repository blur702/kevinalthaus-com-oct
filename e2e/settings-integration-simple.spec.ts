import { test, expect } from '@playwright/test';

/**
 * Simple Settings Integration Test
 *
 * This test demonstrates that:
 * 1. The public settings API works (no auth required)
 * 2. The frontend fetches and displays the site name
 * 3. Videos are recorded automatically
 */

test.describe('Settings Integration - Simple', () => {
  test('Frontend displays site name from API', async ({ page }) => {

    // Capture console logs from the browser
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('[Header]')) {
      }
    });

    // Capture network requests
    page.on('request', (request) => {
      if (request.url().includes('public-settings')) {
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('public-settings')) {
        try {
          const body = await response.text();
        } catch (e) {
        }
      }
    });

    // Step 1: Check the public settings API
    const apiResponse = await page.request.get('http://localhost:3000/api/public-settings');
    expect(apiResponse.ok()).toBeTruthy();

    const apiData = await apiResponse.json();
    expect(apiData).toHaveProperty('site_name');

    // Step 2: Navigate to frontend
    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for header to be visible
    await page.locator('header').waitFor({ state: 'visible', timeout: 10000 });

    // Wait for the API call to complete (the site name is fetched in useEffect)
    await page.waitForTimeout(3000);

    consoleLogs.forEach(log => console.log(`  ${log}`));

    // Step 3: Verify the site name appears in the header
    const headerTitle = page.locator('header a[href="/"]').first();
    await headerTitle.waitFor({ state: 'visible', timeout: 10000 });

    const displayedTitle = await headerTitle.textContent();

    expect(displayedTitle).toBe(String(apiData.site_name));

    // Take screenshot
    await page.screenshot({
      path: 'e2e/screenshots/simple-integration-frontend.png',
      fullPage: true
    });

  });

  test('Manual verification note', async () => {
  });
});
