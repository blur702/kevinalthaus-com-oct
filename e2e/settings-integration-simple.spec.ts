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
    console.log('\n=== Testing Frontend Site Name Display ===\n');

    // Capture console logs from the browser
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('[Header]')) {
        console.log(`Browser console: ${text}`);
      }
    });

    // Capture network requests
    page.on('request', (request) => {
      if (request.url().includes('public-settings')) {
        console.log(`→ Network request: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('public-settings')) {
        console.log(`← Network response: ${response.status()} ${response.url()}`);
        try {
          const body = await response.text();
          console.log(`   Response body: ${body}`);
        } catch (e) {
          console.log(`   Could not read response body`);
        }
      }
    });

    // Step 1: Check the public settings API
    console.log('Step 1: Fetching from public settings API...');
    const apiResponse = await page.request.get('http://localhost:3000/api/public-settings');
    expect(apiResponse.ok()).toBeTruthy();

    const apiData = await apiResponse.json();
    console.log(`API returned site_name: "${apiData.site_name}"`);
    expect(apiData).toHaveProperty('site_name');

    // Step 2: Navigate to frontend
    console.log('\nStep 2: Loading frontend page...');
    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for header to be visible
    await page.locator('header').waitFor({ state: 'visible', timeout: 10000 });

    // Wait for the API call to complete (the site name is fetched in useEffect)
    await page.waitForTimeout(3000);

    console.log('✓ Frontend loaded');
    console.log('\nBrowser console logs:');
    consoleLogs.forEach(log => console.log(`  ${log}`));

    // Step 3: Verify the site name appears in the header
    console.log('\nStep 3: Verifying site name in header...');
    const headerTitle = page.locator('header a[href="/"]').first();
    await headerTitle.waitFor({ state: 'visible', timeout: 10000 });

    const displayedTitle = await headerTitle.textContent();
    console.log(`Displayed title: "${displayedTitle}"`);
    console.log(`Expected title: "${apiData.site_name}"`);

    expect(displayedTitle).toBe(String(apiData.site_name));

    // Take screenshot
    await page.screenshot({
      path: 'e2e/screenshots/simple-integration-frontend.png',
      fullPage: true
    });

    console.log('\n✓ Test Complete! Site name correctly displays on frontend\n');
  });

  test('Manual verification note', async () => {
    console.log('\n=== Manual Verification Instructions ===');
    console.log('To test changing the site title:');
    console.log('1. Navigate to http://localhost:3003/login in a browser');
    console.log('2. Login with username: kevin, password: (130Bpm)');
    console.log('3. Navigate to Settings');
    console.log('4. Change the "Site Name" field to a new value');
    console.log('5. Click "Save Site Settings"');
    console.log('6. Navigate to http://localhost:3002/ (frontend)');
    console.log('7. Verify the new site name appears in the header');
    console.log('=====================================\n');
  });
});
