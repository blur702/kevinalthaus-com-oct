import { test, expect } from '@playwright/test';

// Configuration for test URLs from environment variables
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3003';

test.describe('UI smoke', () => {
  test('Frontend loads with expected title', async ({ page }) => {
    // Use baseURL configured in playwright.config.ts
    await page.goto('/');
    await expect(page).toHaveTitle(/Kevin Althaus - Full Stack Developer/i);
  });

  test('Admin loads with expected title', async ({ page }) => {
    // Use admin URL from configuration
    await page.goto(ADMIN_URL);
    await expect(page).toHaveTitle(/Admin Dashboard - Kevin Althaus/i);
  });
});

