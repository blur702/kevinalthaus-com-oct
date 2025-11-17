import { Page, BrowserContext } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Test credentials for authentication
 * Reads from environment variables - MUST be set for testing
 */
export const TEST_CREDENTIALS = {
  ADMIN: {
    username: process.env.TEST_ADMIN_USERNAME || 'kevin',
    password: process.env.TEST_ADMIN_PASSWORD || 'test-password-changeme',
  },
  // Add more test users as needed
};

// Validate credentials are always set
if (!process.env.TEST_ADMIN_PASSWORD) {
  console.warn(
    'WARNING: TEST_ADMIN_PASSWORD not set. Using insecure default "test-password-changeme". ' +
    'Set TEST_ADMIN_PASSWORD environment variable for secure testing.'
  );
}

// Validate credentials are set in production-like environments
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  if (!process.env.TEST_ADMIN_USERNAME || !process.env.TEST_ADMIN_PASSWORD) {
    throw new Error(
      'TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD must be set in environment variables for production/CI environments'
    );
  }
}

/**
 * Storage state file paths for authenticated sessions
 */
export const AUTH_STATE_PATHS = {
  ADMIN: 'e2e/.auth/admin.json',
};

/**
 * Login helper - performs login and optionally saves auth state
 *
 * @param page - Playwright page object
 * @param username - Username to login with
 * @param password - Password to login with
 * @param saveState - Whether to save authentication state to file
 * @param userIdentifier - Optional user identifier for naming the storage state file (defaults to 'admin')
 */
export async function login(
  page: Page,
  username: string,
  password: string,
  saveState = false,
  userIdentifier = 'admin'
): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be visible
  await page.waitForSelector('input[name="identifier"]', { state: 'visible' });

  // Fill in credentials
  await page.fill('input[name="identifier"]', username);
  await page.fill('input[name="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful login - flexible conditions to avoid brittleness
  // Accept either dashboard or root route as valid post-login destinations
  try {
    // Wait for URL to change from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Verify authentication succeeded by checking for auth cookies
    const authSuccess = await hasAuthCookies(page);
    if (!authSuccess) {
      throw new Error('Login failed: No authentication cookies found after form submission');
    }

    // Optionally verify dashboard content is visible (but don't require specific heading text)
    // This provides additional confirmation without being too rigid
    const dashboardVisible = await page.locator(selectors.dashboard.title).isVisible().catch(() => false);
    if (!dashboardVisible) {
      // Dashboard heading not visible - check if we're at least on a valid authenticated route
      const currentUrl = page.url();
      if (!currentUrl.match(/\/(dashboard)?$/)) {
        console.warn(`[Auth] Login succeeded but landed on unexpected route: ${currentUrl}`);
      }
    }
  } catch (error) {
    throw new Error(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Save authentication state if requested
  if (saveState) {
    const context = page.context();
    // Generate path based on user identifier to avoid overwriting
    const statePath = `e2e/.auth/${userIdentifier}.json`;
    await context.storageState({ path: statePath });
  }
}

/**
 * Make an authenticated API request through the browser's fetch API
 * This ensures cookies are automatically included via the browser context
 *
 * @param page - Playwright page object
 * @param url - API URL (e.g., '/api/blog')
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Response object with ok, status, and json() method
 */
export async function apiRequest(
  page: Page,
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; data: unknown }> {
  // Make the request through the browser using fetch()
  // This automatically includes cookies from the browser context
  const result = await page.evaluate(
    async ({ url, method, body, headers }) => {
      const response = await fetch(url, {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include', // Ensure cookies are sent
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    },
    {
      url,
      method: options.method,
      body: options.body,
      headers: options.headers,
    }
  );

  return {
    ok: result.ok,
    status: result.status,
    data: result.data,
    json: async () => result.data,
  };
}

/**
 * Logout helper - performs logout
 *
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Click logout button exposed in the app bar
  // Use role-based selector for better accessibility and robustness
  const logoutButton = page.getByRole('button', { name: /logout/i });
  await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
  await logoutButton.click();

  // Wait for redirect to login page and ensure navigation settled
  await page.waitForURL('**/login', { timeout: 5000 });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Check if user is authenticated by attempting to access a protected route
 *
 * @param page - Playwright page object
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto('/');
    // If we can see the dashboard, we're authenticated
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 3000 });
    return true;
  } catch {
    // If we're redirected to login, we're not authenticated
    return page.url().includes('/login');
  }
}

/**
 * Setup authenticated context - loads saved auth state into browser context
 *
 * @param context - Browser context
 * @param authStatePath - Path to saved auth state file
 * @returns True if auth state was loaded successfully, false otherwise
 */
export async function setupAuthContext(
  context: BrowserContext,
  authStatePath: string = AUTH_STATE_PATHS.ADMIN
): Promise<boolean> {
  try {
    // Check if auth state file exists by attempting to load it
    const fs = await import('fs');
    if (!fs.existsSync(authStatePath)) {
      console.warn(`Auth state file not found: ${authStatePath}`);
      return false;
    }

    // Load the storage state into the context
    // Note: This should ideally be done during context creation, but this provides
    // a runtime option for dynamic loading
    const storageState = JSON.parse(fs.readFileSync(authStatePath, 'utf-8'));

    // Apply cookies to context
    if (storageState.cookies) {
      await context.addCookies(storageState.cookies);
    }

    // Apply localStorage to all pages (need to create a page to set localStorage)
    if (storageState.origins && storageState.origins.length > 0) {
      const page = await context.newPage();
      for (const origin of storageState.origins) {
        await page.goto(origin.origin);
        if (origin.localStorage) {
          await page.evaluate((items) => {
            for (const item of items) {
              localStorage.setItem(item.name, item.value);
            }
          }, origin.localStorage);
        }
      }
      await page.close();
    }

    return true;
  } catch (error) {
    console.error(`Failed to load auth state from ${authStatePath}:`, error);
    return false;
  }
}

/**
 * Clear all cookies and local storage
 *
 * @param page - Playwright page object
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get authentication cookies
 *
 * @param page - Playwright page object
 * @returns Array of cookies
 */
export async function getAuthCookies(page: Page): Promise<Array<{ name: string; value: string }>> {
  const cookies = await page.context().cookies();
  return cookies.filter((cookie) =>
    ['accessToken', 'refreshToken', 'sessionId'].includes(cookie.name)
  );
}

/**
 * Verify authentication cookies are set
 *
 * @param page - Playwright page object
 * @returns True if auth cookies are present
 */
export async function hasAuthCookies(page: Page): Promise<boolean> {
  const authCookies = await getAuthCookies(page);
  return authCookies.length > 0;
}
