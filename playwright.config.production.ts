import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Testing Configuration for PRODUCTION
 * Tests the live site at kevinalthaus.com
 */
export default defineConfig({
  testDir: './tests/production',

  // Timeout for each test
  timeout: 30000,

  // Timeout for expect assertions
  expect: {
    timeout: 5000,
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if test.only is used
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 2 : 1,

  // Number of parallel workers
  workers: process.env.CI ? 1 : 3,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report-production', open: 'never' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for production site
    baseURL: 'http://kevinalthaus.com',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Capture video on failure
    video: 'retain-on-failure',

    // Trace on first retry
    trace: 'on-first-retry',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Navigation timeout
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 10000,
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

  // Output folder for test artifacts
  outputDir: 'test-results-production',
});
