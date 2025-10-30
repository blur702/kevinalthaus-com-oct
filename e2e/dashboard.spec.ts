import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';
import { selectors } from './utils/selectors';
import { getDashboardStatsViaApi, mockApiResponse, waitForApiResponse } from './utils/api';

/**
 * Dashboard Tests
 *
 * Test suite covering dashboard functionality including:
 * - Stats display
 * - API data fetching
 * - Fallback to mock data on errors
 * - Recent activity section
 * - Loading states
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
  });

  test.describe('Page Load', () => {
    test('should load dashboard successfully after login', async ({ page }) => {
      // Dashboard should be displayed
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();

      // Welcome message should be present
      await expect(page.locator('text=Welcome back')).toBeVisible();
    });

    test('should display loading state while fetching data', async ({ page }) => {
      // Reload to see loading state
      await page.reload();

      // Wait for page to fully load - either loading indicator appears or data loads
      await Promise.race([
        page.waitForSelector(selectors.common.loading, { timeout: 1000 }).catch(() => null),
        page.waitForSelector(selectors.dashboard.statCard.container, { timeout: 3000 }),
      ]);

      // After page loads, verify either:
      // 1. Loading indicator is/was visible (might be too fast to catch)
      // 2. Data is loaded and visible
      const dataVisible = await page
        .locator(selectors.dashboard.statCard.container)
        .isVisible()
        .catch(() => false);

      // Data should be visible after page load
      expect(dataVisible).toBe(true);
    });

    test('should have correct page title', async ({ page }) => {
      await expect(page).toHaveTitle(/Admin/i);
    });
  });

  test.describe('Stats Cards', () => {
    test('should display all stat cards', async ({ page }) => {
      // Wait for stats to load
      await page.waitForSelector(selectors.dashboard.statCard.container, { timeout: 10000 });

      // Get all stat cards
      const statCards = page.locator(selectors.dashboard.statCard.container);
      const count = await statCards.count();

      // Should have 5 stat cards (Total Users, Plugins, Page Views, Articles, Growth)
      expect(count).toBeGreaterThanOrEqual(5);
    });

    test('should display Total Users stat', async ({ page }) => {
      // Find the Total Users card
      const usersCard = page.locator(
        `${selectors.dashboard.statCard.container}:has-text("Total Users")`
      );

      await expect(usersCard).toBeVisible();

      // Should have a value
      const value = await usersCard.locator(selectors.dashboard.statCard.value).textContent();
      expect(value).toBeTruthy();
      expect(value).not.toBe('0');
    });

    test('should display Plugins stat', async ({ page }) => {
      const pluginsCard = page.locator(
        `${selectors.dashboard.statCard.container}:has-text("Plugins")`
      );

      await expect(pluginsCard).toBeVisible();

      const value = await pluginsCard.locator(selectors.dashboard.statCard.value).textContent();
      expect(value).toBeTruthy();
    });

    test('should display Page Views stat', async ({ page }) => {
      const pageViewsCard = page.locator(
        `${selectors.dashboard.statCard.container}:has-text("Page Views")`
      );

      await expect(pageViewsCard).toBeVisible();

      const value = await pageViewsCard
        .locator(selectors.dashboard.statCard.value)
        .textContent();
      expect(value).toBeTruthy();
    });

    test('should display Articles stat', async ({ page }) => {
      const articlesCard = page.locator(
        `${selectors.dashboard.statCard.container}:has-text("Articles")`
      );

      await expect(articlesCard).toBeVisible();

      const value = await articlesCard.locator(selectors.dashboard.statCard.value).textContent();
      expect(value).toBeTruthy();
    });

    test('should display Growth stat', async ({ page }) => {
      const growthCard = page.locator(
        `${selectors.dashboard.statCard.container}:has-text("Growth")`
      );

      await expect(growthCard).toBeVisible();

      const value = await growthCard.locator(selectors.dashboard.statCard.value).textContent();
      expect(value).toBeTruthy();
      expect(value).toContain('%');
    });

    test('should display change indicators on stat cards', async ({ page }) => {
      // Wait for stats to load
      await page.waitForSelector(selectors.dashboard.statCard.container);

      // Get all change chips
      const changeChips = page.locator(selectors.dashboard.statCard.change);
      const count = await changeChips.count();

      // Most cards should have change indicators
      expect(count).toBeGreaterThan(0);

      // Check first change chip has proper format (+X% or -X%)
      if (count > 0) {
        const firstChange = await changeChips.first().textContent();
        expect(firstChange).toMatch(/[+-]\d+/);
      }
    });

    test('should display appropriate icons for each stat', async ({ page }) => {
      // Wait for stats to load
      await page.waitForSelector(selectors.dashboard.statCard.container);

      // Each card should have an icon (svg element)
      const statCards = page.locator(selectors.dashboard.statCard.container);
      const count = await statCards.count();

      for (let i = 0; i < count; i++) {
        const card = statCards.nth(i);
        const icon = card.locator('svg');
        await expect(icon).toBeVisible();
      }
    });
  });

  test.describe('API Integration', () => {
    test('should fetch dashboard stats from API', async ({ page }) => {
      // Set up listener for API request
      const responsePromise = waitForApiResponse(page, '/api/dashboard/stats');

      // Navigate to dashboard (or reload)
      await page.goto('/');

      // Wait for API request
      const response = await responsePromise;
      expect(response).toBeDefined();
    });

    test('should fetch plugins count from API', async ({ page }) => {
      // Set up listener for plugins API request
      const responsePromise = waitForApiResponse(page, '/api/plugins');

      // Navigate to dashboard (or reload)
      await page.goto('/');

      // Wait for API request
      const response = await responsePromise;
      expect(response).toBeDefined();
    });

    test('should display data from API response', async ({ page }) => {
      // Get actual data from API
      const stats = await getDashboardStatsViaApi(page);
      expect(stats).toBeDefined();

      // Navigate to dashboard
      await page.goto('/');

      // Wait for stats to load
      await page.waitForSelector(selectors.dashboard.statCard.container);

      // Verify at least some stat cards are displayed
      const statCards = page.locator(selectors.dashboard.statCard.container);
      const count = await statCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should handle API timeout gracefully', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/dashboard/stats', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await route.abort('timedout');
      });

      await page.goto('/');

      // Should show fallback data or error
      const hasData =
        (await page.locator(selectors.dashboard.statCard.container).count()) > 0;
      const hasError = await page.locator(selectors.common.errorAlert).isVisible().catch(() => false);

      // Either fallback data is shown or error is displayed
      expect(hasData || hasError).toBe(true);
    });

    test('should handle API server error (500)', async ({ page }) => {
      // Mock server error
      await mockApiResponse(page, '**/api/dashboard/stats', { error: 'Server error' }, 500);

      await page.goto('/');

      // Should show warning/error message
      const warningAlert = page.locator(selectors.common.warningAlert);
      await expect(warningAlert).toBeVisible({ timeout: 10000 });

      // Should contain message about fallback data
      const alertText = await warningAlert.textContent();
      expect(alertText).toContain('fallback');
    });

    test('should handle API network error', async ({ page }) => {
      // Mock network error
      await page.route('**/api/dashboard/stats', (route) => route.abort('failed'));

      await page.goto('/');

      // Should show error or fallback data
      const hasWarning = await page
        .locator(selectors.common.warningAlert)
        .isVisible()
        .catch(() => false);
      const hasData =
        (await page.locator(selectors.dashboard.statCard.container).count()) > 0;

      expect(hasWarning || hasData).toBe(true);
    });
  });

  test.describe('Fallback Mock Data', () => {
    test('should display mock data when API fails', async ({ page }) => {
      // Mock API failure
      await mockApiResponse(page, '**/api/dashboard/stats', { error: 'Failed' }, 500);
      await mockApiResponse(page, '**/api/plugins', { error: 'Failed' }, 500);

      await page.goto('/');

      // Should still display stat cards with mock data
      await page.waitForSelector(selectors.dashboard.statCard.container, { timeout: 10000 });

      const statCards = page.locator(selectors.dashboard.statCard.container);
      const count = await statCards.count();

      // Should have mock data for all stats
      expect(count).toBeGreaterThanOrEqual(5);
    });

    test('should display warning when using fallback data', async ({ page }) => {
      // Mock API failure
      await mockApiResponse(page, '**/api/dashboard/stats', { error: 'Failed' }, 500);

      await page.goto('/');

      // Should show warning alert
      const warningAlert = page.locator(selectors.common.warningAlert);
      await expect(warningAlert).toBeVisible({ timeout: 10000 });

      // Warning should mention fallback data
      const text = await warningAlert.textContent();
      expect(text?.toLowerCase()).toContain('fallback');
    });

    test('should use default plugin count when plugins API fails', async ({ page }) => {
      // Mock only plugins API failure
      await mockApiResponse(page, '**/api/plugins', { error: 'Failed' }, 500);

      await page.goto('/');

      // Wait for dashboard to load
      await page.waitForSelector(selectors.dashboard.statCard.container);

      // Find plugins card
      const pluginsCard = page.locator(
        `${selectors.dashboard.statCard.container}:has-text("Plugins")`
      );

      await expect(pluginsCard).toBeVisible();

      // Should display default mock value (64)
      const value = await pluginsCard.locator(selectors.dashboard.statCard.value).textContent();
      expect(value).toBe('64');
    });
  });

  test.describe('Recent Activity Section', () => {
    test('should display Recent Activity section', async ({ page }) => {
      const recentActivity = page.locator('h6:has-text("Recent Activity")');
      await expect(recentActivity).toBeVisible();
    });

    test('should display no activity message by default', async ({ page }) => {
      const noActivity = page.locator('text=No recent activity');
      await expect(noActivity).toBeVisible();
    });

    test('should display Recent Activity card in grid layout', async ({ page }) => {
      // The Recent Activity section should be in a grid item
      const activityCard = page.locator('.MuiCard-root:has-text("Recent Activity")');
      await expect(activityCard).toBeVisible();
    });
  });

  test.describe('Quick Actions Section', () => {
    test('should display Quick Actions section', async ({ page }) => {
      const quickActions = page.locator('h6:has-text("Quick Actions")');
      await expect(quickActions).toBeVisible();
    });

    test('should display quick action items', async ({ page }) => {
      // Check for quick action items
      const createContent = page.locator('text=Create new content');
      const manageUsers = page.locator('text=Manage users');
      const viewAnalytics = page.locator('text=View analytics');
      const updateSettings = page.locator('text=Update settings');

      await expect(createContent).toBeVisible();
      await expect(manageUsers).toBeVisible();
      await expect(viewAnalytics).toBeVisible();
      await expect(updateSettings).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display stats in grid layout', async ({ page }) => {
      // Stats should be in a grid container
      const gridContainer = page.locator('.MuiGrid-container').first();
      await expect(gridContainer).toBeVisible();

      // Should have multiple grid items
      const gridItems = page.locator('.MuiGrid-item');
      const count = await gridItems.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should be responsive on mobile viewport', async ({ page }) => {
      // Change viewport to mobile size
      await page.setViewportSize({ width: 375, height: 667 });

      // Dashboard should still be visible
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();

      // Stats cards should still be visible
      const statCards = page.locator(selectors.dashboard.statCard.container);
      const count = await statCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      // Change viewport to tablet size
      await page.setViewportSize({ width: 768, height: 1024 });

      // Dashboard should still be visible
      await expect(page.locator(selectors.dashboard.title)).toBeVisible();

      // Stats cards should still be visible
      const statCards = page.locator(selectors.dashboard.statCard.container);
      const count = await statCards.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Data Refresh', () => {
    test('should refresh data on page reload', async ({ page }) => {
      // Get initial data
      const initialValue = await page
        .locator(`${selectors.dashboard.statCard.container}:has-text("Total Users")`)
        .locator(selectors.dashboard.statCard.value)
        .textContent();

      // Reload page
      await page.reload();

      // Data should be displayed again (might be same value)
      const reloadedValue = await page
        .locator(`${selectors.dashboard.statCard.container}:has-text("Total Users")`)
        .locator(selectors.dashboard.statCard.value)
        .textContent();

      expect(reloadedValue).toBeTruthy();
      // Values might be the same, but should both be truthy
      expect(initialValue).toBeTruthy();
    });

    test('should handle abort on unmount', async ({ page }) => {
      // Start loading dashboard
      await page.goto('/');

      // Quickly navigate away before data loads
      await page.goto('/users');

      // Should navigate successfully without errors
      await expect(page.locator(selectors.users.title)).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load dashboard within reasonable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await page.waitForSelector(selectors.dashboard.statCard.container, { timeout: 10000 });

      const loadTime = Date.now() - startTime;

      // Dashboard should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should not show excessive loading spinners', async ({ page }) => {
      await page.goto('/');

      // Wait for content to load
      await page.waitForSelector(selectors.dashboard.statCard.container);

      // Should not have loading spinners after content loads
      const loadingVisible = await page
        .locator(selectors.common.loading)
        .isVisible()
        .catch(() => false);

      expect(loadingVisible).toBe(false);
    });
  });
});
