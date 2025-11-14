import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * Playwright E2E Testing Configuration for Docker-running services
 * Uses already-running Docker containers instead of starting new web servers
 */
const authStatePath = 'e2e/.auth/admin.json';

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts'],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    navigationTimeout: 30000,
    actionTimeout: 10000,
    // Only enable insecure bypass flags when explicitly opted-in via PLAYWRIGHT_ALLOW_INSECURE
    // WARNING: These flags disable important security checks and should only be used in development
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_ALLOW_INSECURE === 'true',
    bypassCSP: process.env.PLAYWRIGHT_ALLOW_INSECURE === 'true',
    javaScriptEnabled: true,
    storageState: authStatePath,
  },
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
  // No webServer config - assume services are already running
  outputDir: 'test-results',
});
