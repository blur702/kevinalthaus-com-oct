import { test, expect } from '../../e2e/fixtures/console-monitor-fixture';
import {
  ensureLoggedIn,
  resetAuth,
  fullLogout,
  selectors,
  TEST_CREDENTIALS,
  hasAuthCookies,
} from './utils/comp_helpers';

test.describe('TEST-001 Authentication (comp_)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAuth(page);
    await page.goto('/login');
  });

  test('@smoke logs in with valid admin credentials and lands on dashboard', async ({ page }) => {
    await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
    await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);
    await page.click(selectors.auth.submitButton);

    await expect(page).toHaveURL(/\/(dashboard)?$/);
    await expect(page.locator(selectors.dashboard.title)).toBeVisible();

    expect(await hasAuthCookies(page)).toBeTruthy();
  });

  test('@regression blocks invalid credentials with error feedback', async ({ page }) => {
    await page.fill(selectors.auth.identifierInput, 'invalid-user');
    await page.fill(selectors.auth.passwordInput, 'bad-password');
    await page.click(selectors.auth.submitButton);

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(selectors.auth.errorAlert)).toBeVisible();
    expect(await hasAuthCookies(page)).toBeFalsy();
  });

  test('@regression enforces auth on protected routes and preserves intent after login', async ({
    page,
  }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login/);

    await page.fill(selectors.auth.identifierInput, TEST_CREDENTIALS.ADMIN.username);
    await page.fill(selectors.auth.passwordInput, TEST_CREDENTIALS.ADMIN.password);
    await page.click(selectors.auth.submitButton);

    await expect(page).toHaveURL(/\/users/);
    await expect(page.locator(selectors.users.title)).toBeVisible();
  });

  test('@smoke logs out via user menu and clears auth context', async ({ page }) => {
    await ensureLoggedIn(page);

    await fullLogout(page);
    await expect(page).toHaveURL(/\/login/);
    expect(await hasAuthCookies(page)).toBeFalsy();
  });
});
