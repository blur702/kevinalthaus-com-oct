import { test, expect } from '@playwright/test';

test.describe('Cookie Diagnostics', () => {
  test('should diagnose login and cookie flow', async ({ page, context }) => {
    // Enable detailed logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    // Navigate to login page
    await page.goto('http://localhost:3005/login');
    await page.waitForLoadState('networkidle');

    // Check initial cookies
    const initialCookies = await context.cookies();

    // Fill login form
    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');

    // Monitor network requests
    const loginRequest = page.waitForResponse(resp =>
      resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'
    );

    // Submit login
    await page.click('button[type="submit"]');

    // Wait for login response
    const loginResponse = await loginRequest;
    const loginStatus = loginResponse.status();

    // Check response headers
    const responseHeaders = loginResponse.headers();

    // Get response body
    const loginBody = await loginResponse.json();

    // Check cookies after login
    const cookiesAfterLogin = await context.cookies();

    cookiesAfterLogin.forEach(cookie => {
    });

    // Wait for CSRF token request
    const csrfRequest = page.waitForResponse(resp =>
      resp.url().includes('/api/auth/csrf-token')
    );

    // Get CSRF response
    const csrfResponse = await csrfRequest;
    const csrfStatus = csrfResponse.status();

    // Check request headers sent
    const csrfRequestHeaders = csrfResponse.request().headers();

    if (csrfStatus !== 200) {
      const csrfBody = await csrfResponse.text();
    }

    // Try to manually make a request with cookies
    const allCookies = await context.cookies();
    const cookieHeader = allCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');


    // Make a test request to validate endpoint
    const validateResponse = await page.request.get('http://localhost:3005/api/auth/validate');

    const validateHeaders = validateResponse.headers();

    if (validateResponse.status() !== 200) {
      const body = await validateResponse.text();
    }

    // Final check: are we on the dashboard?
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    // Summary
  });
});
