import { test, expect, Page } from '@playwright/test';
import { adminLogin } from './test-helpers';

/**
 * Settings Verification E2E Tests
 *
 * This test suite verifies that settings can be updated in the admin UI
 * and that the changes are properly reflected in both the frontend and backend.
 */

test.describe('Settings Verification', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await adminLogin(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should load settings page and display all tabs', async () => {
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');

    // Verify all tabs are present
    await expect(page.getByRole('tab', { name: 'Site Configuration' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Security Settings' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Email Settings' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'External APIs' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'API Keys' })).toBeVisible();

    // Capture screenshot of initial settings page
    await page.screenshot({
      path: 'e2e/screenshots/settings-initial.png',
      fullPage: true
    });
  });

  test('should update site configuration settings', async () => {
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');

    // Click Site Configuration tab (should be default, but click to be sure)
    await page.getByRole('tab', { name: 'Site Configuration' }).click();
    await page.waitForTimeout(500);

    // Update site name
    const siteName = `Test Site ${Date.now()}`;
    const siteNameInput = page.getByLabel('Site Name', { exact: true });
    await siteNameInput.clear();
    await siteNameInput.fill(siteName);

    // Update site description
    const siteDescription = 'E2E Test Site Description';
    const siteDescInput = page.getByLabel('Site Description');
    await siteDescInput.clear();
    await siteDescInput.fill(siteDescription);

    // Update site URL
    const siteUrl = 'https://test.example.com';
    const siteUrlInput = page.getByLabel('Site URL');
    await siteUrlInput.clear();
    await siteUrlInput.fill(siteUrl);

    // Capture screenshot before saving
    await page.screenshot({
      path: 'e2e/screenshots/settings-site-before-save.png',
      fullPage: true
    });

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click();

    // Wait for success message
    await expect(page.getByText(/site settings saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Capture screenshot after saving
    await page.screenshot({
      path: 'e2e/screenshots/settings-site-after-save.png',
      fullPage: true
    });

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-query elements after reload to avoid stale references
    const reloadedSiteNameInput = page.getByLabel('Site Name', { exact: true });
    const reloadedSiteDescInput = page.getByLabel('Site Description');
    const reloadedSiteUrlInput = page.getByLabel('Site URL');

    // Verify settings persisted
    await expect(reloadedSiteNameInput).toHaveValue(siteName);
    await expect(reloadedSiteDescInput).toHaveValue(siteDescription);
    await expect(reloadedSiteUrlInput).toHaveValue(siteUrl);
    await expect(siteDescInput).toHaveValue(siteDescription);
    await expect(siteUrlInput).toHaveValue(siteUrl);

    // Capture screenshot after reload
    await page.screenshot({
      path: 'e2e/screenshots/settings-site-after-reload.png',
      fullPage: true
    });
  });

  test('should update security settings', async () => {
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');

    // Click Security Settings tab
    await page.getByRole('tab', { name: 'Security Settings' }).click();
    await page.waitForTimeout(500);

    // Update password minimum length
    const minLengthInput = page.getByLabel('Minimum Length');
    await minLengthInput.clear();
    await minLengthInput.fill('10');

    // Update session timeout
    const sessionTimeoutInput = page.getByLabel(/session timeout/i);
    await sessionTimeoutInput.clear();
    await sessionTimeoutInput.fill('90');

    // Toggle require special characters
    const requireSpecialCheckbox = page.getByRole('checkbox', { name: /require special characters/i });
    await requireSpecialCheckbox.check();

    // Capture screenshot before saving
    await page.screenshot({
      path: 'e2e/screenshots/settings-security-before-save.png',
      fullPage: true
    });

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click();

    // Wait for success message
    await expect(page.getByText(/security settings saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Capture screenshot after saving
    await page.screenshot({
      path: 'e2e/screenshots/settings-security-after-save.png',
      fullPage: true
    });

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Security Settings' }).click();
    await page.waitForTimeout(500);

    // Verify settings persisted
    await expect(minLengthInput).toHaveValue('10');
    await expect(sessionTimeoutInput).toHaveValue('90');
    await expect(requireSpecialCheckbox).toBeChecked();
  });

  test('should update email settings', async () => {
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');

    // Click Email Settings tab
    await page.getByRole('tab', { name: 'Email Settings' }).click();
    await page.waitForTimeout(500);

    // Update Brevo from email
    const brevoFromEmail = 'test@example.com';
    const brevoEmailInput = page.getByLabel('From Email');
    await brevoEmailInput.clear();
    await brevoEmailInput.fill(brevoFromEmail);

    // Update Brevo from name
    const brevoFromName = 'Test Sender';
    const brevoNameInput = page.getByLabel('From Name');
    await brevoNameInput.clear();
    await brevoNameInput.fill(brevoFromName);

    // Capture screenshot before saving
    await page.screenshot({
      path: 'e2e/screenshots/settings-email-before-save.png',
      fullPage: true
    });

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click();

    // Wait for success message
    await expect(page.getByText(/email settings saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Capture screenshot after saving
    await page.screenshot({
      path: 'e2e/screenshots/settings-email-after-save.png',
      fullPage: true
    });

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Email Settings' }).click();
    await page.waitForTimeout(500);

    // Verify settings persisted
    await expect(brevoEmailInput).toHaveValue(brevoFromEmail);
    await expect(brevoNameInput).toHaveValue(brevoFromName);
  });

  test('should verify backend database contains updated settings', async () => {
    // This test will be executed via API to verify backend storage
    const response = await page.request.get('http://localhost:3000/api/settings/site');
    expect(response.ok()).toBeTruthy();

    const siteSettings = await response.json();

    // Verify site settings are returned
    expect(siteSettings).toHaveProperty('site_name');
    expect(siteSettings).toHaveProperty('site_description');
    expect(siteSettings).toHaveProperty('site_url');
    expect(siteSettings).toHaveProperty('timezone');
    expect(siteSettings).toHaveProperty('language');

    // Log settings for verification

    // Verify security settings
    const securityResponse = await page.request.get('http://localhost:3000/api/settings/security');
    expect(securityResponse.ok()).toBeTruthy();

    const securitySettings = await securityResponse.json();

    // Verify email settings
    const emailResponse = await page.request.get('http://localhost:3000/api/settings/email');
    expect(emailResponse.ok()).toBeTruthy();

    const emailSettings = await emailResponse.json();
  });

  test('should create comprehensive settings report', async () => {
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');

    // Capture screenshots of all settings tabs
    const tabs = [
      'Site Configuration',
      'Security Settings',
      'Email Settings',
      'External APIs',
      'API Keys'
    ];

    for (const tabName of tabs) {
      await page.getByRole('tab', { name: tabName }).click();
      await page.waitForTimeout(500);

      const filename = `settings-${tabName.toLowerCase().replace(/\s+/g, '-')}.png`;
      await page.screenshot({
        path: `e2e/screenshots/${filename}`,
        fullPage: true
      });
    }

    // Create a final comprehensive screenshot
    await page.screenshot({
      path: 'e2e/screenshots/settings-comprehensive.png',
      fullPage: true
    });
  });
});
