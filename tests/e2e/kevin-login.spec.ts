import { test, expect } from '@playwright/test';

test.describe('Kevin User Login Flow', () => {
  test('should login successfully with kevin credentials', async ({ page }) => {
    await page.goto('/login');

    // Use kevin user credentials
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=/Admin Dashboard/i')).toBeVisible();
  });

  test('should verify kevin user has admin access', async ({ page }) => {
    await page.goto('/login');

    // Login as kevin
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard
    await expect(page).toHaveURL('/');

    // Check for Users section (admin-only feature)
    await expect(page.locator('text=/Users/i')).toBeVisible();
  });
});
