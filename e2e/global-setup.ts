import { chromium, FullConfig } from '@playwright/test';
import 'dotenv/config';
import fs from 'fs';

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
    const username = process.env.TEST_ADMIN_USERNAME;
    const password = process.env.TEST_ADMIN_PASSWORD;

    if (!username || !password) {
      console.warn(
        '[Global Setup] Skipping login: TEST_ADMIN_USERNAME/TEST_ADMIN_PASSWORD not set.'
      );
    } else {
      console.log('[Global Setup] Performing admin login to persist auth state...');
      // Navigate to login within same origin (baseURL is set as admin host)
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });

      await page.waitForSelector('input[name="identifier"]', { state: 'visible', timeout: 10000 });
      await page.fill('input[name="identifier"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');

      // Wait for dashboard
      await page.waitForURL(/\/(dashboard)?$/i, { timeout: 20000 });
      await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 10000 });

      // Ensure auth directory exists then save storage state
      const authDir = 'e2e/.auth';
      fs.mkdirSync(authDir, { recursive: true });
      const statePath = `${authDir}/admin.json`;
      await context.storageState({ path: statePath });
      console.log(`[Global Setup] Saved authenticated storage state to ${statePath}`);
    }
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
