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
      console.log('[Global Setup] Skipping login for now - will test without auth persistence');
      // TEMPORARILY DISABLED: Login causing timeouts due to rate limiting issues
      // Tests will handle their own authentication
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
