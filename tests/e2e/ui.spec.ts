import { test, expect } from '@playwright/test';

test.describe('UI smoke', () => {
  test('Frontend loads with expected title', async ({ page }) => {
    await page.goto('http://localhost:3002/');
    await expect(page).toHaveTitle(/Kevin Althaus - Full Stack Developer/i);
  });

  test('Admin loads with expected title', async ({ page }) => {
    await page.goto('http://localhost:3003/');
    await expect(page).toHaveTitle(/Admin Dashboard - Kevin Althaus/i);
  });
});

