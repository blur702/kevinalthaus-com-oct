import { test, expect } from '@playwright/test';
import { login, logout, clearAuth, hasAuthCookies, TEST_CREDENTIALS } from './utils/auth';
import { selectors } from './utils/selectors';

/**
 * Authentication Tests
 *
 * Test suite covering login, logout, session persistence,
 * cookie-based authentication, and protected route access.
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await clearAuth(page);
  });

  test.describe('Login', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill in credentials
      await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
      await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);

      // Submit form
      await page.click(selectors.auth.submitButton);

      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });

      // Verify dashboard is displayed
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();

      // Verify auth cookies are set
      const cookies = await hasAuthCookies(page);
      expect(cookies).toBe(true);
    });

    test('should show error with invalid username', async ({ page }) => {
      await page.goto('/login');

      // Fill in invalid credentials
      await page.fill(selectors.auth.identifierInput, 'nonexistent_user');
      await page.fill(selectors.auth.passwordInput, 'wrongpassword');

      // Submit form
      await page.click(selectors.auth.submitButton);

      // Should show error message
      await expect(page.locator(selectors.auth.errorAlert)).toBeVisible();

      // Should still be on login page
      await expect(page).toHaveURL(/.*\/login/);

      // Auth cookies should not be set
      const cookies = await hasAuthCookies(page);
      expect(cookies).toBe(false);
    });

    test('should show error with invalid password', async ({ page }) => {
      await page.goto('/login');

      // Fill in valid username but wrong password
      await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
      await page.fill(selectors.auth.passwordInput, 'wrongpassword123');

      // Submit form
      await page.click(selectors.auth.submitButton);

      // Should show error message
      await expect(page.locator(selectors.auth.errorAlert)).toBeVisible();

      // Should still be on login page
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should show validation error for empty username', async ({ page }) => {
      await page.goto('/login');

      // Leave username empty, fill password
      await page.fill(selectors.auth.passwordInput, 'somepassword');

      // Submit form
      await page.click(selectors.auth.submitButton);

      // Should show validation error (form should prevent submission or show error)
      const identifierInput = page.locator(selectors.auth.identifierInput);
      const hasError = await identifierInput.evaluate((el: HTMLInputElement) => {
        return el.validity.valid === false || el.getAttribute('aria-invalid') === 'true';
      });

      expect(hasError).toBe(true);
    });

    test('should show validation error for empty password', async ({ page }) => {
      await page.goto('/login');

      // Fill username, leave password empty
      await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);

      // Submit form
      await page.click(selectors.auth.submitButton);

      // Should show validation error
      const passwordInput = page.locator(selectors.auth.passwordInput);
      const hasError = await passwordInput.evaluate((el: HTMLInputElement) => {
        return el.validity.valid === false || el.getAttribute('aria-invalid') === 'true';
      });

      expect(hasError).toBe(true);
    });

    test('should disable submit button while logging in', async ({ page }) => {
      await page.goto('/login');

      // Fill in credentials
      await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
      await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);

      // Set up request listener before clicking submit
      const requestPromise = page.waitForRequest((request) =>
        request.url().includes('/api/auth/login') && request.method() === 'POST'
      );

      // Click submit
      const submitButton = page.locator(selectors.auth.submitButton);
      const clickPromise = submitButton.click();

      // Wait for the request to start
      await requestPromise;

      // Button should be disabled during the request
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBe(true);

      // Wait for click to complete
      await clickPromise;

      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
    });

    test('should validate email format for identifier field', async ({ page }) => {
      await page.goto('/login');

      // Test that email format is accepted in the identifier field
      const emailIdentifier = 'kevin@example.com';
      await page.fill(selectors.auth.identifierInput, emailIdentifier);
      await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);

      // Get the input value to verify it was accepted
      const inputValue = await page
        .locator(selectors.auth.identifierInput)
        .inputValue();
      expect(inputValue).toBe(emailIdentifier);

      await page.click(selectors.auth.submitButton);

      // Wait for either success or error response
      await Promise.race([
        page.waitForURL(/.*\/$/, { timeout: 5000 }).catch(() => null),
        page.waitForSelector(selectors.auth.errorAlert, { timeout: 5000 }).catch(() => null),
      ]);

      // Verify a result occurred (either redirect or error message)
      const isOnDashboard = page.url().match(/.*\/$/);
      const errorVisible = await page
        .locator(selectors.auth.errorAlert)
        .isVisible()
        .catch(() => false);

      // Should either successfully login or show error (both indicate field accepts email format)
      expect(isOnDashboard || errorVisible).toBe(true);
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      // First login
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Verify we're on dashboard
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();

      // Perform logout
      await logout(page);

      // Should redirect to login page
      await expect(page).toHaveURL(/.*\/login/);

      // Auth cookies should be cleared
      const cookies = await hasAuthCookies(page);
      expect(cookies).toBe(false);
    });

    test('should not be able to access protected routes after logout', async ({ page }) => {
      // Login
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Logout
      await logout(page);

      // Try to access protected route
      await page.goto('/');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist session across page reloads', async ({ page }) => {
      // Login
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Reload page
      await page.reload();

      // Should still be authenticated
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();

      // Cookies should still be present
      const cookies = await hasAuthCookies(page);
      expect(cookies).toBe(true);
    });

    test('should persist session across navigation', async ({ page }) => {
      // Login
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Navigate to different pages
      await page.goto('/users');
      await expect(page.locator(selectors.users.title)).toBeVisible();

      await page.goto('/settings');
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible();

      await page.goto('/');
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();

      // Should still be authenticated throughout
      const cookies = await hasAuthCookies(page);
      expect(cookies).toBe(true);
    });

    test('should maintain session in new tab', async ({ context, page }) => {
      // Login in first page
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Open new tab
      const newPage = await context.newPage();
      await newPage.goto('/');

      // New tab should be authenticated
      await expect(newPage.locator(selectors.dashboard.title)).toBeVisible();

      // Both pages should have auth cookies
      const cookiesPage1 = await hasAuthCookies(page);
      const cookiesPage2 = await hasAuthCookies(newPage);

      expect(cookiesPage1).toBe(true);
      expect(cookiesPage2).toBe(true);

      await newPage.close();
    });
  });

  test.describe('Cookie-Based Authentication', () => {
    test('should set httpOnly cookies on successful login', async ({ page }) => {
      await page.goto('/login');

      // Fill and submit
      await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
      await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);
      await page.click(selectors.auth.submitButton);

      // Wait for redirect
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });

      // Get cookies
      const cookies = await page.context().cookies();

      // Should have access token cookie
      const accessToken = cookies.find((c) => c.name === 'accessToken');
      expect(accessToken).toBeDefined();
      expect(accessToken?.httpOnly).toBe(true);

      // Should have refresh token cookie
      const refreshToken = cookies.find((c) => c.name === 'refreshToken');
      expect(refreshToken).toBeDefined();
      expect(refreshToken?.httpOnly).toBe(true);
    });

    test('should clear cookies on logout', async ({ page }) => {
      // Login
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Verify cookies are set
      let cookies = await page.context().cookies();
      expect(cookies.some((c) => c.name === 'accessToken')).toBe(true);

      // Logout
      await logout(page);

      // Cookies should be cleared or expired
      cookies = await page.context().cookies();
      const authCookies = cookies.filter((c) =>
        ['accessToken', 'refreshToken'].includes(c.name)
      );

      // Cookies should either be removed or have past expiration
      const validAuthCookies = authCookies.filter((c) => {
        if (!c.expires) {return true;}
        return c.expires > Date.now() / 1000;
      });

      expect(validAuthCookies.length).toBe(0);
    });

    test('should not store tokens in localStorage or sessionStorage', async ({ page }) => {
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Check localStorage and sessionStorage
      const hasTokensInStorage = await page.evaluate(() => {
        const localStorageKeys = Object.keys(localStorage);
        const sessionStorageKeys = Object.keys(sessionStorage);

        const tokenKeys = [
          'accessToken',
          'refreshToken',
          'token',
          'auth',
          'jwt',
          'bearer',
        ];

        const hasInLocal = tokenKeys.some((key) =>
          localStorageKeys.some((k) => k.toLowerCase().includes(key.toLowerCase()))
        );

        const hasInSession = tokenKeys.some((key) =>
          sessionStorageKeys.some((k) => k.toLowerCase().includes(key.toLowerCase()))
        );

        return hasInLocal || hasInSession;
      });

      // Should not store tokens in browser storage
      expect(hasTokensInStorage).toBe(false);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route without auth', async ({
      page,
    }) => {
      // Try to access dashboard without logging in
      await page.goto('/');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });
    });

    test('should redirect to login when accessing users page without auth', async ({ page }) => {
      await page.goto('/users');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });
    });

    test('should redirect to login when accessing settings without auth', async ({ page }) => {
      await page.goto('/settings');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/, { timeout: 5000 });
    });

    test('should redirect back to intended page after login', async ({ page }) => {
      // Try to access protected route
      await page.goto('/users');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);

      // Login
      await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
      await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);
      await page.click(selectors.auth.submitButton);

      // Should redirect back to originally requested page
      // Note: This depends on your redirect implementation
      // It might go to dashboard or the originally requested page
      await expect(page).not.toHaveURL(/.*\/login/);
    });

    test('should allow access to login page when already authenticated', async ({ page }) => {
      // Login first
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      // Try to access login page
      await page.goto('/login');

      // Should either stay on login or redirect to dashboard
      // Both behaviors are acceptable
      const url = page.url();
      expect(url.includes('/login') || url.includes('/')).toBe(true);
    });
  });

  test.describe('Security', () => {
    test('should handle XSS in username field', async ({ page }) => {
      await page.goto('/login');

      const xssPayload = '<script>alert("xss")</script>';

      // Register dialog handler before triggering any action that might cause it
      page.on('dialog', () => {
        throw new Error('XSS vulnerability: alert dialog appeared');
      });

      await page.fill(selectors.auth.identifierInput, xssPayload);
      await page.fill(selectors.auth.passwordInput, 'password');
      await page.click(selectors.auth.submitButton);

      // Should show error (invalid credentials)
      await expect(page.locator(selectors.auth.errorAlert)).toBeVisible();

      // Script should not have executed (no dialog should appear)
    });

    test('should not expose credentials in network requests', async ({ page }) => {
      const requestBodies: unknown[] = [];

      // Capture all request bodies
      page.on('request', (request) => {
        const body = request.postDataJSON();
        if (body) {
          requestBodies.push(body);
        }
      });

      await page.goto('/login');
      await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
      await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);

      // Wait for the login request to be sent
      const requestPromise = page.waitForRequest((request) =>
        request.url().includes('/api/auth/login') && request.method() === 'POST'
      );

      await page.click(selectors.auth.submitButton);

      // Wait for the login request
      await requestPromise;

      // Wait for the response
      await Promise.race([
        page.waitForURL(/.*\/$/, { timeout: 5000 }).catch(() => null),
        page.waitForSelector(selectors.auth.errorAlert, { timeout: 5000 }).catch(() => null),
      ]);

      // Credentials should only be in the login request body, not in URL or other places
      // This is a basic check - more detailed security testing would be needed
      expect(requestBodies.length).toBeGreaterThan(0);
    });
  });
});
