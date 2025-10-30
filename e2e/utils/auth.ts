import { Page, BrowserContext } from '@playwright/test';

/**
 * Test credentials for authentication
 * Reads from environment variables with fallback for local development
 */
export const TEST_CREDENTIALS = {
  ADMIN: {
    username: process.env.TEST_ADMIN_USERNAME || 'kevin',
    password: process.env.TEST_ADMIN_PASSWORD || '(130Bpm)',
  },
  // Add more test users as needed
};

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

  // Wait for navigation to dashboard (successful login)
  // Use specific pattern to avoid matching all routes ending in /
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });

  // Verify we're on the dashboard by checking for dashboard-specific content
  await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });

  // Save authentication state if requested
  if (saveState) {
    const context = page.context();
    // Generate path based on user identifier to avoid overwriting
    const statePath = `e2e/.auth/${userIdentifier}.json`;
    await context.storageState({ path: statePath });
  }
}

/**
 * Logout helper - performs logout
 *
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Click on user menu or logout button
  // This depends on your UI structure - adjust selector as needed
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');

  // Wait for redirect to login page
  await page.waitForURL('**/login', { timeout: 5000 });
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
