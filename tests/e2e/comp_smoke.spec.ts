import { test, expect } from '@playwright/test';
import { ensureLoggedIn, selectors } from './utils/comp_helpers';

test.describe('Baseline Smoke (comp_)', () => {
  test('@smoke verifies app bootstrap, login, and dashboard load', async ({ page }) => {
    await ensureLoggedIn(page);
    await expect(page.locator(selectors.dashboard.title)).toBeVisible();
  });

  test('@regression ensures primary navigation is responsive', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.waitForSelector(selectors.navigation.sidebar);

    const navLinks = [
      { locator: selectors.navigation.usersLink, url: /\/users/ },
      { locator: selectors.navigation.settingsLink, url: /\/settings/ },
      { locator: selectors.navigation.dashboardLink, url: /\/(dashboard)?$/ },
    ];

    for (const nav of navLinks) {
      await page.click(nav.locator);
      await expect(page).toHaveURL(nav.url);
    }
  });
});
