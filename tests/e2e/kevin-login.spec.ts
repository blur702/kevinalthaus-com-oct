import { test, expect, Page } from '@playwright/test';

/**
 * Helper function to login as kevin
 */
async function loginAsKevin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="identifier"]').fill('kevin');
  await page.locator('input[name="password"]').fill('(130Bpm)');
  await page.locator('button[type="submit"]').click();

  // Wait for successful login (redirect to dashboard)
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Kevin User Login Flow - Comprehensive Tests', () => {
  test('should login successfully from /login page', async ({ page }) => {
    await page.goto('/login');

    // Use kevin user credentials
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.locator('text=/Admin Dashboard/i')).toBeVisible({ timeout: 5000 });
  });

  test('should verify kevin user has admin access', async ({ page }) => {
    await loginAsKevin(page);

    // Check for Users section (admin-only feature)
    await expect(page.locator('text=/Users/i')).toBeVisible({ timeout: 5000 });
  });

  test('should persist authentication when navigating pages', async ({ page }) => {
    await loginAsKevin(page);

    // Navigate to different pages and verify auth persists
    const pagesToTest = [
      { url: '/blog', name: 'Blog' },
      { url: '/settings', name: 'Settings' },
      { url: '/users', name: 'Users' },
    ];

    for (const pageToTest of pagesToTest) {
      await page.goto(pageToTest.url);
      // Should not redirect to login
      await expect(page).toHaveURL(pageToTest.url, { timeout: 5000 });
      // Should show user info or authenticated UI element
      await expect(page.locator('text=/kevin/i').or(page.locator('text=/Admin/i'))).toBeVisible({ timeout: 5000 });
    }
  });

  test('should redirect to /login when accessing protected pages without auth', async ({ page }) => {
    // Try to access protected pages without logging in
    const protectedPages = [
      '/users',
      '/settings',
      '/blog/create',
    ];

    for (const protectedPage of protectedPages) {
      await page.goto(protectedPage);
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    }
  });

  test('should successfully logout', async ({ page }) => {
    await loginAsKevin(page);

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]');
    await logoutButton.click({ timeout: 5000 });

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Try to access protected page after logout
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Try with wrong password
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Should show error message
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should access admin-only features after login', async ({ page }) => {
    await loginAsKevin(page);

    // Test access to admin-only features
    await page.goto('/users');
    await expect(page).toHaveURL('/users', { timeout: 5000 });

    // Should see user management interface
    await expect(page.locator('text=/Add User|Create User|User Management/i')).toBeVisible({ timeout: 5000 });
  });

  test('should maintain session across page reload', async ({ page }) => {
    await loginAsKevin(page);

    // Reload the page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL('/', { timeout: 5000 });
    await expect(page.locator('text=/Admin Dashboard/i')).toBeVisible({ timeout: 5000 });

    // Navigate to another protected page
    await page.goto('/users');
    await expect(page).toHaveURL('/users', { timeout: 5000 });
  });

  test('should allow access to all blog-related pages', async ({ page }) => {
    await loginAsKevin(page);

    // Test blog pages
    const blogPages = [
      { url: '/blog', name: 'Blog List' },
      { url: '/blog/create', name: 'Create Blog Post' },
    ];

    for (const blogPage of blogPages) {
      await page.goto(blogPage.url);
      await expect(page).toHaveURL(blogPage.url, { timeout: 5000 });
      // Should not be redirected to login
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});
