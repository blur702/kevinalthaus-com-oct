import { chromium, request as playwrightRequest, FullConfig } from '@playwright/test';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const authStatePath = 'e2e/.auth/admin.json';

/**
 * Global setup runs once before all tests
 *
 * This setup performs any necessary pre-test initialization:
 * - Sets E2E_TESTING environment variable to disable rate limiting
 * - Verifies API endpoints are accessible
 * - Can create test database state if needed
 * - Can generate test data
 */
async function globalSetup(config: FullConfig): Promise<void> {
  // Set E2E_TESTING environment variable to disable rate limiting
  process.env.E2E_TESTING = 'true';
  process.env.RATE_LIMIT_BYPASS_E2E = 'true';

  // Validate that projects are configured
  if (!config.projects || config.projects.length === 0) {
    throw new Error('No projects configured in playwright.config.ts');
  }

  const { baseURL } = config.projects[0].use;

  if (!baseURL) {
    throw new Error('baseURL is not configured in playwright.config.ts');
  }

  console.log(`[Global Setup] Testing connectivity to ${baseURL}`);

  // Launch browser to verify application is accessible
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page to verify app is running
    const response = await page.goto(`${baseURL}/login`, {
      waitUntil: 'domcontentloaded', // Changed from networkidle to domcontentloaded for faster/more reliable loading
      timeout: 60000, // Increased timeout to 60 seconds
    });

    if (!response || !response.ok()) {
      throw new Error(
        `Failed to connect to ${baseURL}/login - Status: ${response?.status() || 'unknown'}`
      );
    }

    console.log(`[Global Setup] Successfully connected to ${baseURL}`);

    // Attempt to perform an authenticated login and persist storage state
    // In CI/production, credentials MUST be set via environment variables
    // In local/dev, fallback to default credentials for convenience
    const isProduction = process.env.NODE_ENV === 'production' || process.env.CI;

    let username = process.env.TEST_ADMIN_USERNAME;
    let password = process.env.TEST_ADMIN_PASSWORD;

    if (!username || !password) {
      if (isProduction) {
        throw new Error(
          'TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD must be set in environment variables for CI/production environments'
        );
      }
      // Fallback to default credentials for local/dev testing
      username = username || 'kevin';
      password = password || 'test-password-changeme';
      console.log('[Global Setup] Using default credentials for local/dev environment');
    }

    // Verify login page loads (but do not authenticate via UI to avoid rate limiting proxies)
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle', timeout: 60_000 });

    const authBaseUrl =
      process.env.E2E_LOGIN_BASE_URL ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.MAIN_APP_BASE_URL ||
      'http://localhost:3000';
    const apiContext = await playwrightRequest.newContext({
      baseURL: authBaseUrl,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });

    const loginResponse = await apiContext.post('/api/auth/login', {
      data: { username, password },
    });

    if (!loginResponse.ok()) {
      const responseBody = await loginResponse.json().catch(() => ({}));
      throw new Error(
        `API login failed for ${authBaseUrl}/api/auth/login as ${username}. Status: ${loginResponse.status()} ${
          loginResponse.statusText()
        } Response: ${JSON.stringify(responseBody)}`
      );
    }

    fs.mkdirSync(path.dirname(authStatePath), { recursive: true });
    await apiContext.storageState({ path: authStatePath });
    await apiContext.dispose();
    console.log('[Global Setup] API authentication complete; storage state saved.');
  } catch (error) {
    console.error('[Global Setup] Failed to connect to application:', error);
    throw new Error(
      `Application is not accessible at ${baseURL}. Make sure the admin panel is running.`
    );
  } finally {
    await browser.close();
  }

  console.log('[Global Setup] Setup complete');
}

export default globalSetup;
