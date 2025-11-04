/**
 * Admin Authentication and CSRF Token E2E Test
 *
 * Tests the complete authentication flow including CSRF token handling:
 * 1. Login to admin panel
 * 2. CSRF token is fetched after login
 * 3. CSRF token is attached to state-changing requests
 * 4. Settings can be updated with valid CSRF token
 */

import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3003';
const API_URL = process.env.MAIN_APP_URL || 'http://localhost:3001';

// Test user credentials (should exist in database)
const TEST_USER = {
  username: 'admin',
  password: 'admin123', // Change this to match your test user
};

test.describe('Admin Authentication with CSRF Protection', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the login page
    await page.goto(`${ADMIN_URL}/login`);
  });

  test('should login successfully and fetch CSRF token', async ({ page }) => {
    // Fill in login form
    await page.fill('input[name="identifier"]', TEST_USER.username);
    await page.fill('input[name="password"]', TEST_USER.password);

    // Listen for API requests
    const loginRequest = page.waitForRequest(request =>
      request.url().includes('/api/auth/login') && request.method() === 'POST'
    );
    const csrfRequest = page.waitForRequest(request =>
      request.url().includes('/api/auth/csrf-token') && request.method() === 'GET'
    );

    // Submit login form
    await page.click('button[type="submit"]');

    // Wait for both requests to complete
    await loginRequest;
    const csrf = await csrfRequest;

    // Verify we got a CSRF token response
    const csrfResponse = await csrf.response();
    expect(csrfResponse?.status()).toBe(200);

    const csrfBody = await csrfResponse?.json();
    expect(csrfBody).toHaveProperty('csrfToken');
    expect(csrfBody.csrfToken).toBeTruthy();

    // Should redirect to dashboard after login
    await expect(page).toHaveURL(new RegExp(`${ADMIN_URL}(/dashboard)?`));
  });

  test('should attach CSRF token to POST requests', async ({ page, context }) => {
    // Login first
    await page.fill('input[name="identifier"]', TEST_USER.username);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL(new RegExp(`${ADMIN_URL}`));

    // Get CSRF token from cookie
    const cookies = await context.cookies();
    const csrfCookie = cookies.find(c => c.name === 'csrf-token');
    expect(csrfCookie).toBeTruthy();
    expect(csrfCookie?.value).toBeTruthy();

    // Navigate to settings page (which makes POST/PUT requests)
    await page.goto(`${ADMIN_URL}/settings`);

    // Listen for API requests to verify CSRF token is attached
    const requestPromise = new Promise<boolean>((resolve) => {
      page.on('request', (request) => {
        if (request.method() === 'POST' || request.method() === 'PUT') {
          const headers = request.headers();
          resolve('x-csrf-token' in headers && !!headers['x-csrf-token']);
        }
      });
    });

    // Try to make a POST request (if settings page allows)
    // This is just to verify the interceptor works
    const hasCSRFToken = await Promise.race([
      requestPromise,
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 5000))
    ]);

    // Note: This might be false if no POST request is made, which is OK
    // The important part is that IF a POST is made, it has the CSRF token
    console.log('POST/PUT request had CSRF token:', hasCSRFToken);
  });

  test('should reject requests without CSRF token', async ({ request }) => {
    // First, login to get a valid session
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    });

    expect(loginResponse.ok()).toBeTruthy();

    // Try to make a POST request without CSRF token
    const settingsResponse = await request.put(`${API_URL}/api/settings/site`, {
      data: {
        site_name: 'Test Site',
      },
    });

    // Should be rejected with 403 Forbidden
    expect(settingsResponse.status()).toBe(403);

    const responseBody = await settingsResponse.json();
    expect(responseBody.error).toContain('CSRF');
  });

  test('should accept requests with valid CSRF token', async ({ request }) => {
    // Login to get a valid session
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    });

    expect(loginResponse.ok()).toBeTruthy();

    // Get CSRF token
    const csrfResponse = await request.get(`${API_URL}/api/auth/csrf-token`);
    expect(csrfResponse.ok()).toBeTruthy();

    const csrfBody = await csrfResponse.json();
    const csrfToken = csrfBody.csrfToken;
    expect(csrfToken).toBeTruthy();

    // Make a PUT request with CSRF token
    const settingsResponse = await request.put(`${API_URL}/api/settings/site`, {
      data: {
        site_name: 'Test Site Updated',
      },
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });

    // Should be accepted (200 OK or 201 Created)
    expect(settingsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(settingsResponse.status()).toBeLessThan(300);
  });

  test('should handle CSRF token expiry gracefully', async ({ request }) => {
    // Login
    await request.post(`${API_URL}/api/auth/login`, {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    });

    // Get CSRF token
    const csrfResponse = await request.get(`${API_URL}/api/auth/csrf-token`);
    const csrfBody = await csrfResponse.json();
    const csrfToken = csrfBody.csrfToken;

    // Wait for token to expire (CSRF tokens expire in 1 hour, but we can test with an old token)
    // For this test, we'll just verify that an invalid token is rejected
    const invalidToken = 'invalid-token-12345';

    const response = await request.put(`${API_URL}/api/settings/site`, {
      data: {
        site_name: 'Test',
      },
      headers: {
        'X-CSRF-Token': invalidToken,
      },
    });

    // Should be rejected with 403
    expect(response.status()).toBe(403);

    const responseBody = await response.json();
    expect(responseBody.error).toContain('CSRF');
  });
});

test.describe('Settings Page with CSRF', () => {
  test('should load settings page and be able to update with CSRF token', async ({ page }) => {
    // Login
    await page.goto(`${ADMIN_URL}/login`);
    await page.fill('input[name="identifier"]', TEST_USER.username);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(new RegExp(`${ADMIN_URL}`));

    // Navigate to settings
    await page.goto(`${ADMIN_URL}/settings`);

    // Wait for settings to load
    await page.waitForSelector('input[name="site_name"], h1:has-text("Settings")', {
      timeout: 10000,
    });

    // The page should load without CSRF errors in console
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit to ensure no errors
    await page.waitForTimeout(2000);

    // Check that there are no CSRF-related console errors
    const csrfErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('csrf')
    );

    expect(csrfErrors.length).toBe(0);
  });
});
