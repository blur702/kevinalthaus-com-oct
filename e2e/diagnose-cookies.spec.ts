import { test, expect } from '@playwright/test';

test.describe('Cookie Diagnostics', () => {
  test('should diagnose login and cookie flow', async ({ page, context }) => {
    // Enable detailed logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    // Navigate to login page
    console.log('\n=== 1. Navigating to login page ===');
    await page.goto('http://localhost:3005/login');
    await page.waitForLoadState('networkidle');

    // Check initial cookies
    console.log('\n=== 2. Initial cookies (before login) ===');
    const initialCookies = await context.cookies();
    console.log(`Found ${initialCookies.length} cookies:`, JSON.stringify(initialCookies, null, 2));

    // Fill login form
    console.log('\n=== 3. Filling login form ===');
    await page.fill('input[name="identifier"]', 'kevin');
    await page.fill('input[name="password"]', '(130Bpm)');

    // Monitor network requests
    const loginRequest = page.waitForResponse(resp =>
      resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'
    );

    // Submit login
    console.log('\n=== 4. Submitting login ===');
    await page.click('button[type="submit"]');

    // Wait for login response
    const loginResponse = await loginRequest;
    const loginStatus = loginResponse.status();
    console.log(`Login response status: ${loginStatus}`);

    // Check response headers
    const responseHeaders = loginResponse.headers();
    console.log('\n=== 5. Login response headers ===');
    console.log('set-cookie:', responseHeaders['set-cookie'] || 'NONE');

    // Get response body
    const loginBody = await loginResponse.json();
    console.log('\n=== 6. Login response body ===');
    console.log(JSON.stringify(loginBody, null, 2));

    // Check cookies after login
    console.log('\n=== 7. Cookies after login ===');
    const cookiesAfterLogin = await context.cookies();
    console.log(`Found ${cookiesAfterLogin.length} cookies:`);

    cookiesAfterLogin.forEach(cookie => {
      console.log(`\nCookie: ${cookie.name}`);
      console.log(`  Value: ${cookie.value.substring(0, 50)}...`);
      console.log(`  Domain: ${cookie.domain}`);
      console.log(`  Path: ${cookie.path}`);
      console.log(`  Secure: ${cookie.secure}`);
      console.log(`  HttpOnly: ${cookie.httpOnly}`);
      console.log(`  SameSite: ${cookie.sameSite}`);
    });

    // Wait for CSRF token request
    console.log('\n=== 8. Waiting for CSRF token request ===');
    const csrfRequest = page.waitForResponse(resp =>
      resp.url().includes('/api/auth/csrf-token')
    );

    // Get CSRF response
    const csrfResponse = await csrfRequest;
    const csrfStatus = csrfResponse.status();
    console.log(`CSRF token response status: ${csrfStatus}`);

    // Check request headers sent
    const csrfRequestHeaders = csrfResponse.request().headers();
    console.log('\n=== 9. CSRF request headers ===');
    console.log('cookie:', csrfRequestHeaders['cookie'] || 'NONE');

    if (csrfStatus !== 200) {
      const csrfBody = await csrfResponse.text();
      console.log('CSRF response body:', csrfBody);
    }

    // Try to manually make a request with cookies
    console.log('\n=== 10. Testing manual request with cookies ===');
    const allCookies = await context.cookies();
    const cookieHeader = allCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    console.log('Cookie header to send:', cookieHeader);

    // Make a test request to validate endpoint
    const validateResponse = await page.request.get('http://localhost:3005/api/auth/validate');
    console.log(`\nValidate endpoint status: ${validateResponse.status()}`);

    const validateHeaders = validateResponse.headers();
    console.log('Validate request headers sent:');
    console.log('  cookie:', validateHeaders['cookie'] || 'NONE');

    if (validateResponse.status() !== 200) {
      const body = await validateResponse.text();
      console.log('Validate response body:', body);
    }

    // Final check: are we on the dashboard?
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log(`\n=== 11. Final URL: ${currentUrl} ===`);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Login status: ${loginStatus}`);
    console.log(`CSRF status: ${csrfStatus}`);
    console.log(`Validate status: ${validateResponse.status()}`);
    console.log(`Cookies set: ${cookiesAfterLogin.length}`);
    console.log(`Current page: ${currentUrl}`);
  });
});
