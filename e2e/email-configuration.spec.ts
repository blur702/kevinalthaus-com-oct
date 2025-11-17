import { test, expect } from '@playwright/test';

/**
 * Email Configuration E2E Test
 *
 * Tests the complete workflow of configuring Brevo email settings via the admin UI:
 * 1. Login as admin
 * 2. Navigate to Settings → Email
 * 3. Configure Brevo API key and sender info
 * 4. Save settings
 * 5. Send test email
 */

test.describe('Email Configuration', () => {
  test('should configure Brevo email settings and send test email', async ({ page }) => {

    // Login
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill(process.env.TEST_ADMIN_USERNAME || 'kevin');
    await page.locator('input[name="password"]').fill(process.env.TEST_ADMIN_PASSWORD || 'test-password-changeme');
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Step 2: Navigate to Settings page
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings', { timeout: 5000 });

    // Step 3: Click on Email Settings tab
    const emailTab = page.locator('button:has-text("Email Settings")');
    await emailTab.click();
    await page.waitForTimeout(500); // Wait for tab animation

    // Step 4: Verify Brevo is selected (default)
    const brevoSwitch = page.locator('input[type="checkbox"]').filter({ has: page.locator('text=/Brevo/i') }).first();
    const isBrevoSelected = await brevoSwitch.isChecked();

    if (!isBrevoSelected) {
      await brevoSwitch.click();
      await page.waitForTimeout(300);
    }

    // Step 5: Enter Brevo API key
    const apiKeyInput = page.locator('input[type="password"]').filter({ hasText: /Brevo API Key/i }).or(
      page.locator('label:has-text("Brevo API Key")').locator('..').locator('input')
    ).first();

    // The API key might be in a password field, look for the label
    const apiKeyField = page.getByLabel('Brevo API Key');
    await apiKeyField.fill('v98KyhcFSHqgXf7t');

    // Step 6: Enter from email and name

    // Find the From Email field (there might be multiple, select the one that's visible)
    const fromEmailField = page.locator('input[type="email"]').filter({ hasText: /From Email/i }).or(
      page.getByLabel('From Email')
    ).first();
    await fromEmailField.fill('noreply@kevinalthaus.com');

    const fromNameField = page.locator('label:has-text("From Name")').locator('..').locator('input').first();
    await fromNameField.fill('Kevin Althaus');

    // Step 7: Save settings
    const saveButton = page.locator('button:has-text("Save Changes")').first();
    await saveButton.click();

    // Wait for success notification
    await expect(page.locator('text=/saved successfully/i').or(page.locator('text=/success/i'))).toBeVisible({ timeout: 10000 });

    // Verify API key configured indicator
    const apiKeyConfigured = page.locator('text=/API Key Configured/i');
    await expect(apiKeyConfigured).toBeVisible({ timeout: 5000 });

    // Step 8: Send test email
    const testEmailButton = page.locator('button:has-text("Test Email")');
    await testEmailButton.click();

    // Wait for test email result
    await expect(
      page.locator('text=/test email sent/i').or(
        page.locator('text=/check your inbox/i')
      )
    ).toBeVisible({ timeout: 15000 });

    // Success summary
  });

  test('should show API key configured status after configuration', async ({ page }) => {

    // Login
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill(process.env.TEST_ADMIN_USERNAME || 'kevin');
    await page.locator('input[name="password"]').fill(process.env.TEST_ADMIN_PASSWORD || 'test-password-changeme');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Navigate to settings
    await page.goto('/settings');

    // Open Email Settings tab
    const emailTab = page.locator('button:has-text("Email Settings")');
    await emailTab.click();
    await page.waitForTimeout(500);

    // Verify API key configured chip is visible
    const apiKeyConfigured = page.locator('text=/API Key Configured/i');
    await expect(apiKeyConfigured).toBeVisible({ timeout: 5000 });

    // Verify helper text shows "Leave blank to keep existing key"
    const helperText = page.locator('text=/Leave blank to keep existing key/i');
    await expect(helperText).toBeVisible();

  });
});
