import { test, expect } from '@playwright/test';

// Helper to login before tests
async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.locator('input[name="identifier"]').fill('admin@kevinalthaus.com');
  await page.locator('input[name="password"]').fill('Admin123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('/');
}

test.describe('Users Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display users page', async ({ page }) => {
    await page.goto('/users');

    await expect(page.locator('h4')).toContainText('Users');
    await expect(page.locator('[role="grid"]')).toBeVisible();
  });

  test('should show user list with data grid', async ({ page }) => {
    await page.goto('/users');

    // Wait for data grid to load
    await page.waitForSelector('[role="grid"]');

    // Check for common columns
    await expect(page.locator('text=/Email/i')).toBeVisible();
    await expect(page.locator('text=/Role/i')).toBeVisible();
    await expect(page.locator('text=/Status/i')).toBeVisible();
  });

  test('should have add user button', async ({ page }) => {
    await page.goto('/users');

    await expect(page.locator('button:has-text("Add User")')).toBeVisible();
  });

  test('should be able to logout', async ({ page }) => {
    await page.locator('button:has-text("Logout")').click();

    await expect(page).toHaveURL('/login');
  });
});
