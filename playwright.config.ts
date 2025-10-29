import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    baseURL: process.env.ADMIN_URL || 'http://localhost:3003',
    bypassCSP: true,
    javaScriptEnabled: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'cd packages/admin && npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

