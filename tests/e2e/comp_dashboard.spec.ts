import { test, expect } from '@playwright/test';
import { ensureLoggedIn, selectors } from './utils/comp_helpers';

test.describe('TEST-002 Dashboard & Analytics (comp_)', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('@smoke renders core analytics tiles with values', async ({ page }) => {
    await page.waitForSelector(selectors.dashboard.statCard.container, { timeout: 10000 });

    const requiredTiles = ['Total Users', 'Plugins', 'Page Views', 'Articles'];
    for (const tile of requiredTiles) {
      const card = page.locator(`${selectors.dashboard.statCard.container}:has-text("${tile}")`);
      await expect(card, `${tile} card missing`).toBeVisible();
      await expect(card.locator(selectors.dashboard.statCard.value)).toHaveText(/\S/);
    }
  });

  test('@regression surfaces operational alerts when analytics fail and recovers after reload', async ({
    page,
  }) => {
    await page.route('**/api/**dashboard**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'forced failure' }) })
    );

    await page.reload();
    await expect(page.locator(selectors.common.errorAlert)).toBeVisible();

    await page.unroute('**/api/**dashboard**');
    await page.reload();
    await expect(page.locator(selectors.common.errorAlert)).toBeHidden({ timeout: 5000 });
    await expect(page.locator(selectors.dashboard.statCard.container).first()).toBeVisible();
  });

  test('@regression quick actions navigate to the correct sections', async ({ page }) => {
    await page.click('text=/Manage users/i');
    await expect(page).toHaveURL(/\/users/);
    await expect(page.locator(selectors.users.title)).toBeVisible();

    await page.goBack();
    await expect(page.locator(selectors.dashboard.title)).toBeVisible();

    await page.click('text=/Update settings/i');
    await expect(page).toHaveURL(/\/settings/);
  });
});
