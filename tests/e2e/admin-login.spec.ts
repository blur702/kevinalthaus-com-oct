import { test, expect } from '@playwright/test';

test.describe('Admin Login Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h4')).toContainText('Admin Login');
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');

    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=/Email or Username is required/i')).toBeVisible();
    await expect(page.locator('text=/Password is required/i')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[name="identifier"]').fill('invalid@example.com');
    await page.locator('input[name="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('[role="alert"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Use default admin credentials (must be seeded)
    await page.locator('input[name="identifier"]').fill('admin@kevinalthaus.com');
    await page.locator('input[name="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=/Admin Dashboard/i')).toBeVisible();
  });
});
