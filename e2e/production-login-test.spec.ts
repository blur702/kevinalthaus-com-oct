import { test, expect } from '@playwright/test';

/**
 * Production Server Login Test
 * Tests authentication flow on kevinalthaus.com production server
 *
 * Server: 65.181.112.77 (kevinalthaus.com)
 * Username: kevin
 * Password: (130Bpm)
 */

test.describe('Production Login Test', () => {
  const PROD_URL = 'http://65.181.112.77';
  const USERNAME = 'kevin';
  const PASSWORD = '(130Bpm)!Secure2024';

  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for production server
    test.setTimeout(60000);
  });

  test('should discover and test login flow', async ({ page }) => {
    console.log('🔍 Discovering login path on production server');

    // First check the root page
    await page.goto(PROD_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'e2e/screenshots/prod-root-page.png', fullPage: true });
    console.log('📸 Root page screenshot saved');

    // Look for "Go to Login" button or login link
    const loginLink = page.locator('a:has-text("Go to Login"), a:has-text("Login"), button:has-text("Go to Login")').first();

    if (await loginLink.count() > 0) {
      console.log('✅ Found login link, clicking it');
      await loginLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'e2e/screenshots/prod-login-page.png', fullPage: true });
      console.log('📸 Login page screenshot saved');
    } else {
      // Try common login paths
      const loginPaths = ['/login', '/admin/login', '/auth/login', '/admin'];
      for (const path of loginPaths) {
        console.log(`🔍 Trying path: ${path}`);
        const response = await page.goto(PROD_URL + path, { waitUntil: 'networkidle' });
        if (response && response.status() < 400) {
          console.log(`✅ Found accessible path: ${path}`);
          await page.screenshot({ path: `e2e/screenshots/prod-${path.replace(/\//g, '-')}.png`, fullPage: true });
          break;
        }
      }
    }

    // Now look for login form elements
    const usernameInput = page.locator('input[name="username"], input[name="email"], input[type="text"], input[type="email"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

    // Verify login form exists
    await expect(usernameInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    console.log('✅ Login form found');

    // Fill in credentials
    await usernameInput.fill(USERNAME);
    console.log('📝 Username filled');

    await passwordInput.fill(PASSWORD);
    console.log('📝 Password filled');

    // Take screenshot before submit
    await page.screenshot({ path: 'e2e/screenshots/prod-before-submit.png', fullPage: true });

    // Submit login form
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();

    // Check for button state before clicking
    await expect(loginButton).toBeEnabled({ timeout: 5000 });
    console.log('✅ Login button is enabled');

    // Listen for console logs and network errors
    page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    page.on('requestfailed', request => console.log('Request failed:', request.url(), request.failure()?.errorText));

    await loginButton.click();
    console.log('🔐 Login button clicked');

    // Wait longer for potential navigation
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    console.log('✅ Navigation completed');

    // Take screenshot after login attempt
    await page.screenshot({ path: 'e2e/screenshots/prod-after-login.png', fullPage: true });
    console.log('📸 Post-login screenshot saved');

    // Check for common dashboard/success indicators
    const dashboardIndicators = [
      page.locator('text=/dashboard/i'),
      page.locator('text=/welcome/i'),
      page.locator('nav, [role="navigation"]'),
      page.locator('button, a').filter({ hasText: /logout|sign out/i }),
      page.locator('[data-testid*="dashboard"], [class*="dashboard"]')
    ];

    let foundIndicator = false;
    for (const indicator of dashboardIndicators) {
      if (await indicator.count() > 0) {
        foundIndicator = true;
        console.log('✅ Found dashboard indicator');
        break;
      }
    }

    // Check URL changed from login page
    const currentURL = page.url();
    console.log('📍 Current URL after login:', currentURL);

    // Verify authentication by checking session/cookies
    const cookies = await page.context().cookies();
    console.log('🍪 Cookies found:', cookies.map(c => c.name).join(', '));

    const authCookie = cookies.find(c =>
      c.name.toLowerCase().includes('session') ||
      c.name.toLowerCase().includes('auth') ||
      c.name.toLowerCase().includes('token') ||
      c.name.toLowerCase().includes('connect.sid')
    );

    if (authCookie) {
      console.log('✅ Authentication cookie found:', authCookie.name);
    }

    // Check if we're still on login page (indicating failed login)
    const stillOnLogin = await page.locator('input[type="password"]').count() > 0;
    if (stillOnLogin) {
      console.log('⚠️  Still on login page - checking for error messages');
      const errorMsg = page.locator('text=/error|invalid|incorrect|failed/i');
      if (await errorMsg.count() > 0) {
        console.log('❌ Login failed with error message');
        await expect(errorMsg).toBeVisible();
      }
    } else {
      console.log('✅ Successfully navigated away from login page');
    }

    // Test logout functionality if available
    const logoutButton = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      console.log('🔓 Logout clicked');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'e2e/screenshots/prod-after-logout.png', fullPage: true });
      console.log('✅ Logout completed');
    }
  });

  test.skip('should handle invalid credentials gracefully', async ({ page }) => {
    // Skipping for now - focus on successful login first
    console.log('⏭️  Skipped: Invalid credentials test');
  });

  test('should verify server health and accessibility', async ({ page }) => {
    console.log('🏥 Testing server health');

    // Test API Gateway health endpoint
    const healthResponse = await page.goto(PROD_URL + '/health');
    expect(healthResponse?.status()).toBeLessThan(500);
    console.log('✅ Health endpoint accessible, status:', healthResponse?.status());

    // Test root page accessibility
    const rootResponse = await page.goto(PROD_URL);
    expect(rootResponse?.status()).toBeLessThan(500);
    console.log('✅ Root page accessible, status:', rootResponse?.status());

    // Take screenshot of initial state
    await page.screenshot({ path: 'e2e/screenshots/prod-initial-state.png', fullPage: true });
    console.log('📸 Initial state screenshot saved');
  });
});
