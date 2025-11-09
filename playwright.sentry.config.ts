import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Sentry Integration Tests
 *
 * This configuration is specifically for testing the Sentry integration
 * on the frontend application (port 5173).
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test files pattern - only Sentry tests
  testMatch: '**/sentry-integration.spec.ts',

  // Timeout for each test (30 seconds)
  timeout: 30000,

  // Timeout for expect assertions (5 seconds)
  expect: {
    timeout: 5000,
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if test.only is used
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Number of parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report-sentry', open: 'never' }],
    ['json', { outputFile: 'test-results/sentry-results.json' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for frontend (production build on port 5173)
    baseURL: 'http://localhost:5173',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Capture video on first retry
    video: 'retain-on-failure',

    // Trace on first retry
    trace: 'on-first-retry',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Navigation timeout (30 seconds)
    navigationTimeout: 30000,

    // Action timeout (10 seconds)
    actionTimeout: 10000,

    // Ignore HTTPS errors in development
    ignoreHTTPSErrors: true,

    // Bypass CSP in development
    bypassCSP: true,

    // Enable JavaScript
    javaScriptEnabled: true,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // No web server - assume frontend is already running on port 5173
  webServer: undefined,

  // Output folder for test artifacts
  outputDir: 'test-results/sentry',
});
