import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Testing
 *
 * This configuration is for testing against the live production server
 * at kevinalthaus.com (65.181.112.77) without starting local services.
 */

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/production-*.spec.ts'],

  // Timeout for each test
  timeout: 60000,

  // Timeout for expect assertions
  expect: {
    timeout: 10000,
  },

  // Run tests serially for production
  fullyParallel: false,

  // No retries for production tests
  retries: 0,

  // Single worker for production
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report-prod', open: 'never' }],
    ['json', { outputFile: 'test-results/prod-results.json' }],
    ['list'],
  ],

  // Shared settings
  use: {
    // Production server URL
    baseURL: 'http://65.181.112.77',

    // Capture screenshots
    screenshot: 'on',

    // Capture video
    video: 'on',

    // Capture trace
    trace: 'on',

    // Browser options
    viewport: { width: 1280, height: 720 },

    // Increased timeouts for production
    navigationTimeout: 45000,
    actionTimeout: 15000,

    // Production SSL handling
    ignoreHTTPSErrors: false,

    // Don't bypass CSP in production
    bypassCSP: false,

    // Enable JavaScript
    javaScriptEnabled: true,

    // No pre-authenticated state for production tests
    storageState: undefined,
  },

  // Test in Chromium only for production
  projects: [
    {
      name: 'chromium-production',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // NO webServer - testing against live production server

  // Output folder
  outputDir: 'test-results/production',
});
