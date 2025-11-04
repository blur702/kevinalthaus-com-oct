import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

/**
 * Settings UI Tests
 *
 * Test suite covering settings management UI including:
 * - Navigation to settings page
 * - Tab switching
 * - Form validation
 * - Site settings update
 * - Security settings update
 * - Email settings update
 * - API key management
 */

test.describe('Settings UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

    // Navigate to settings page
    await page.goto('/admin/settings');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test.describe('Page Load and Navigation', () => {
    test('should load settings page successfully', async ({ page }) => {
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible();

      // All tabs should be visible
      await expect(page.locator('button[role="tab"]:has-text("Site Configuration")')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("Security Settings")')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("Email Settings")')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("API Keys")')).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      // Click on Security Settings tab
      await page.click('button[role="tab"]:has-text("Security Settings")');
      await expect(page.locator('text=Password Requirements')).toBeVisible();

      // Click on Email Settings tab
      await page.click('button[role="tab"]:has-text("Email Settings")');
      await expect(page.locator('label:has-text("SMTP Host")')).toBeVisible();

      // Click on API Keys tab
      await page.click('button[role="tab"]:has-text("API Keys")');
      await expect(page.locator('button:has-text("Create New API Key")')).toBeVisible();

      // Click back to Site Configuration
      await page.click('button[role="tab"]:has-text("Site Configuration")');
      await expect(page.locator('label:has-text("Site Name")')).toBeVisible();
    });
  });

  test.describe('Site Configuration Tab', () => {
    test('should display current site settings', async ({ page }) => {
      // Check that form fields are populated
      const siteNameInput = page.locator('input[label="Site Name"]').or(page.locator('label:has-text("Site Name")').locator('..').locator('input'));
      await expect(siteNameInput).not.toHaveValue('');
    });

    test('should update site name', async ({ page }) => {
      const newSiteName = `Test Site ${Date.now()}`;

      // Find and fill the site name input
      const siteNameInput = page.locator('label:has-text("Site Name")').locator('..').locator('input');
      await siteNameInput.clear();
      await siteNameInput.fill(newSiteName);

      // Click save button
      await page.click('button:has-text("Save Site Settings")');

      // Wait for success message
      await expect(page.locator('text=Settings updated successfully')).toBeVisible({ timeout: 5000 });
    });

    test('should validate site name length', async ({ page }) => {
      const siteNameInput = page.locator('label:has-text("Site Name")').locator('..').locator('input');

      // Clear the field (should trigger validation)
      await siteNameInput.clear();
      await siteNameInput.blur();

      // Try to save
      await page.click('button:has-text("Save Site Settings")');

      // Should show validation error
      await expect(page.locator('text=Site name must be between 1 and 100 characters')).toBeVisible();
    });

    test('should validate URL format', async ({ page }) => {
      const urlInput = page.locator('label:has-text("Site URL")').locator('..').locator('input');

      // Enter invalid URL
      await urlInput.clear();
      await urlInput.fill('not-a-valid-url');
      await urlInput.blur();

      // Try to save
      await page.click('button:has-text("Save Site Settings")');

      // Should show validation error
      await expect(page.locator('text=Invalid URL format')).toBeVisible();
    });
  });

  test.describe('Security Settings Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Security Settings")');
      await expect(page.locator('text=Password Requirements')).toBeVisible();
    });

    test('should display current security settings', async ({ page }) => {
      // Check that password min length field has a value
      const minLengthInput = page.locator('label:has-text("Minimum Length")').locator('..').locator('input');
      await expect(minLengthInput).not.toHaveValue('');
    });

    test('should update password requirements', async ({ page }) => {
      const minLengthInput = page.locator('label:has-text("Minimum Length")').locator('..').locator('input');

      // Update minimum length
      await minLengthInput.clear();
      await minLengthInput.fill('12');

      // Toggle uppercase requirement
      const uppercaseCheckbox = page.locator('text=Require Uppercase').locator('..').locator('input[type="checkbox"]');
      await uppercaseCheckbox.click();

      // Click save button
      await page.click('button:has-text("Save Security Settings")');

      // Wait for success message
      await expect(page.locator('text=Settings updated successfully')).toBeVisible({ timeout: 5000 });
    });

    test('should validate password min length', async ({ page }) => {
      const minLengthInput = page.locator('label:has-text("Minimum Length")').locator('..').locator('input');

      // Enter invalid value (too low)
      await minLengthInput.clear();
      await minLengthInput.fill('5');
      await minLengthInput.blur();

      // Try to save
      await page.click('button:has-text("Save Security Settings")');

      // Should show validation error
      await expect(page.locator('text=Password minimum length must be between 8 and 128')).toBeVisible();
    });

    test('should update session settings', async ({ page }) => {
      const sessionTimeoutInput = page.locator('label:has-text("Session Timeout")').locator('..').locator('input');

      // Update session timeout
      await sessionTimeoutInput.clear();
      await sessionTimeoutInput.fill('60');

      // Click save button
      await page.click('button:has-text("Save Security Settings")');

      // Wait for success message
      await expect(page.locator('text=Settings updated successfully')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Email Settings Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Email Settings")');
      await expect(page.locator('label:has-text("SMTP Host")')).toBeVisible();
    });

    test('should display current email settings', async ({ page }) => {
      // Check that SMTP host field has a value (or is empty for new setup)
      const smtpHostInput = page.locator('label:has-text("SMTP Host")').locator('..').locator('input');
      await expect(smtpHostInput).toBeVisible();
    });

    test('should update email settings', async ({ page }) => {
      const smtpHostInput = page.locator('label:has-text("SMTP Host")').locator('..').locator('input');
      const smtpUserInput = page.locator('label:has-text("SMTP Username")').locator('..').locator('input');

      // Update SMTP settings
      await smtpHostInput.clear();
      await smtpHostInput.fill('smtp.test.com');
      await smtpUserInput.clear();
      await smtpUserInput.fill('testuser@test.com');

      // Click save button
      await page.click('button:has-text("Save Email Settings")');

      // Wait for success message
      await expect(page.locator('text=Settings updated successfully')).toBeVisible({ timeout: 5000 });
    });

    test('should validate email format', async ({ page }) => {
      const fromEmailInput = page.locator('label:has-text("From Email")').locator('..').locator('input');

      // Enter invalid email
      await fromEmailInput.clear();
      await fromEmailInput.fill('not-an-email');
      await fromEmailInput.blur();

      // Try to save
      await page.click('button:has-text("Save Email Settings")');

      // Should show validation error
      await expect(page.locator('text=Invalid email format')).toBeVisible();
    });

    test('should test email settings', async ({ page }) => {
      // Click test email button
      await page.click('button:has-text("Test Email")');

      // Wait for result message (success or failure)
      await expect(
        page.locator('text=Test email sent').or(page.locator('text=Failed to send test email'))
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('API Keys Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('button[role="tab"]:has-text("API Keys")');
      await expect(page.locator('button:has-text("Create New API Key")')).toBeVisible();
    });

    test('should display API keys list', async ({ page }) => {
      // List should be visible (may be empty)
      await expect(page.locator('button:has-text("Create New API Key")')).toBeVisible();
    });

    test('should create new API key', async ({ page }) => {
      // Click create button
      await page.click('button:has-text("Create New API Key")');

      // Dialog should open
      await expect(page.locator('text=Create API Key')).toBeVisible();

      // Fill in key details
      const keyName = `Test Key ${Date.now()}`;
      await page.fill('input[label="Key Name"]', keyName);

      // Select some scopes (if available)
      // Note: Scope selection may vary based on implementation

      // Click create button in dialog
      await page.click('button:has-text("Create"):visible');

      // Wait for success and key display
      await expect(page.locator('text=API key created successfully')).toBeVisible({ timeout: 5000 });

      // Key should be displayed (one-time)
      await expect(page.locator('text=Copy and save this key')).toBeVisible();

      // Close the dialog
      await page.click('button:has-text("Close")');

      // Verify key appears in list
      await expect(page.locator(`text=${keyName}`)).toBeVisible();
    });

    test('should validate API key name', async ({ page }) => {
      // Click create button
      await page.click('button:has-text("Create New API Key")');

      // Try to create without name
      await page.click('button:has-text("Create"):visible');

      // Should show validation error
      await expect(page.locator('text=Key name is required')).toBeVisible();
    });

    test('should revoke API key', async ({ page }) => {
      // First create a key
      await page.click('button:has-text("Create New API Key")');
      const keyName = `Test Key to Revoke ${Date.now()}`;
      await page.fill('input[label="Key Name"]', keyName);
      await page.click('button:has-text("Create"):visible');
      await expect(page.locator('text=API key created successfully')).toBeVisible({ timeout: 5000 });
      await page.click('button:has-text("Close")');

      // Find the revoke button for this key
      const keyRow = page.locator(`tr:has-text("${keyName}")`);
      await expect(keyRow).toBeVisible();

      // Click revoke button
      await keyRow.locator('button[aria-label="Revoke"]').or(keyRow.locator('button:has-text("Revoke")')).click();

      // Confirm revocation
      await page.click('button:has-text("Revoke"):visible');

      // Wait for success message
      await expect(page.locator('text=API key revoked successfully')).toBeVisible({ timeout: 5000 });

      // Key should no longer be in list
      await expect(keyRow).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      // Simulate network failure
      await context.route('**/api/settings/**', (route) => route.abort());

      // Try to reload settings
      await page.reload();

      // Should show error message
      await expect(page.locator('text=Failed to load').or(page.locator('text=Error'))).toBeVisible({ timeout: 5000 });
    });
  });
});
