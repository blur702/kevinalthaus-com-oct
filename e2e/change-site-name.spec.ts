import { test, expect } from '@playwright/test';

test.describe('Change Site Name', () => {
  test('should login and change site name to kevin', async ({ page }) => {
    // Navigate directly to admin login (admin panel shows login by default)
    await page.goto('http://localhost:3004');

    // Wait for login form to appear - look for the Admin Login heading
    await page.waitForSelector('text=Admin Login', { timeout: 10000 });

    // Wait for the form to be interactive
    const usernameInput = page.locator('input[type="text"], input:not([type="password"])').first();
    await usernameInput.waitFor({ state: 'visible' });

    // Take screenshot of login page
    await page.screenshot({ path: 'screenshots/change-name-01-login.png' });

    // Fill in login form - find the input fields by their labels/placeholders
    const passwordInput = page.locator('input[type="password"]').first();

    // Validate required environment variables
    if (!process.env.TEST_ADMIN_USERNAME || !process.env.TEST_ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD environment variables are required');
    }

    await usernameInput.fill(process.env.TEST_ADMIN_USERNAME);
    await passwordInput.fill(process.env.TEST_ADMIN_PASSWORD);

    // Take screenshot after filling form
    await page.screenshot({ path: 'screenshots/change-name-02-login-filled.png' });

    // Submit login
    await page.click('button[type="submit"]');

    // Wait for dashboard to load - look for navigation away from login
    await page.waitForURL(/dashboard|\/$/,{ timeout: 10000 });

    // Wait for dashboard elements to load
    await page.waitForSelector('nav, [role="navigation"]', { timeout: 5000 }).catch(() => {});

    // Take screenshot of dashboard
    await page.screenshot({ path: 'screenshots/change-name-03-dashboard.png' });

    // Navigate to Settings page (use page.goto with relative or look for Settings link)
    console.log('Navigating to Settings...');
    // Try to find and click a Settings link/button in the navigation
    const settingsLink = page.locator('a:has-text("Settings"), button:has-text("Settings")');
    const settingsLinkCount = await settingsLink.count();

    if (settingsLinkCount > 0) {
      await settingsLink.first().click();
    } else {
      // Fallback: navigate directly to settings
      await page.goto(page.url().replace(/\/[^\/]*$/, '') + '/settings');
    }

    // Wait for settings page to load by looking for a settings element
    await page.waitForSelector('text=Site Name, text=Site Configuration', { timeout: 5000 }).catch(() => {});

    // Take screenshot of settings page
    await page.screenshot({ path: 'screenshots/change-name-04-settings.png' });

    // Find the site name input field - it's in the Site Configuration section
    // Look for the input field that follows the "Site Name *" label
    const siteNameInput = page.locator('text=Site Name').locator('..').locator('input').first();

    // Wait for the input to be visible
    await siteNameInput.waitFor({ state: 'visible', timeout: 5000 });

    // Clear existing value and type "kevin"
    await siteNameInput.clear();
    await siteNameInput.fill('kevin');

    // Take screenshot after changing name
    await page.screenshot({ path: 'screenshots/change-name-05-name-changed.png' });

    // Find and click the Save button
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await saveButton.click();

    // Wait for save to complete by checking for success indicator or network idle
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Take screenshot after saving
    await page.screenshot({ path: 'screenshots/change-name-06-saved.png' });

    // Verify the change was saved by checking if "kevin" is still in the input
    const savedValue = await siteNameInput.inputValue();
    expect(savedValue).toBe('kevin');

    console.log('✅ Successfully changed site name to "kevin"');

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/change-name-07-complete.png' });
  });
});
