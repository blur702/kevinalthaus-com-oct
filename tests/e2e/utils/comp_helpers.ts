import { expect, Page } from '@playwright/test';
import {
  login,
  logout,
  clearAuth,
  TEST_CREDENTIALS,
  hasAuthCookies,
} from '../../../e2e/utils/auth';
import { selectors } from '../../../e2e/utils/selectors';

export { selectors, TEST_CREDENTIALS, hasAuthCookies };

export const compTags = {
  smoke: /@smoke/,
  regression: /@regression/,
};

export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto('/login');
  const onLogin = page.url().includes('/login');
  if (!onLogin) {
    const authenticated = await hasAuthCookies(page);
    if (authenticated) {
      await page.goto('/');
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();
      return;
    }
  }

  await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
}

export async function resetAuth(page: Page): Promise<void> {
  await clearAuth(page);
}

export async function fullLogout(page: Page): Promise<void> {
  try {
    await logout(page);
  } catch {
    // fall back to clearing context if UI logout fails
    await resetAuth(page);
  }
}
