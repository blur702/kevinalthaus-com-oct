import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Testing Configuration
 *
 * This configuration sets up end-to-end testing for the admin panel
 * with support for multiple browsers, screenshots, traces, and parallel execution.
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test files pattern
  testMatch: '**/*.spec.ts',

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

  // Number of parallel workers (use half of available CPUs)
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // Global setup/teardown
  globalSetup: './e2e/global-setup.ts',

  // Shared settings for all projects
  use: {
    // Base URL for all tests (prefer IPv4 localhost to avoid ::1 binding issues)
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003',

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

    // Ignore HTTPS errors only in development (not production/CI)
    // In production, tests should validate proper SSL configuration
    ignoreHTTPSErrors: !process.env.CI && process.env.NODE_ENV !== 'production',

    // Bypass CSP only in development for easier testing
    // In production/CI, tests should work with CSP enabled
    bypassCSP: !process.env.CI && process.env.NODE_ENV !== 'production',

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

    // Mobile viewports (optional)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Web servers: start backend and admin for UI tests. Use IPv4 and longer timeouts.
  webServer: process.env.CI
    ? undefined
    : {
        // Start backend in background, then build+preview admin on 127.0.0.1:3003
        command:
          "(CORS_ORIGIN=http://localhost:3003 npm run --workspace @monorepo/main-app dev &) && VITE_API_URL=http://localhost:3001/api npm run --workspace @monorepo/admin build && VITE_API_URL=http://localhost:3001/api npm run --workspace @monorepo/admin preview -- --host localhost --port 3003",
        url: 'http://localhost:3003/login',
        reuseExistingServer: true,
        timeout: 300000,
        stdout: 'pipe',
        stderr: 'pipe',
      },

  // Output folder for test artifacts
  outputDir: 'test-results',
});
