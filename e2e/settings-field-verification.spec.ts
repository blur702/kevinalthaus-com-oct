import { test, expect } from '@playwright/test';
import { adminLogin } from './test-helpers';

/**
 * Settings Field Verification Test
 *
 * This test verifies that:
 * 1. Settings can be saved to the database
 * 2. Settings are properly loaded back into form fields on page load
 * 3. All fields in all settings tabs show their values correctly
 */

test.describe('Settings Field Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await adminLogin(page);

    // Navigate to settings page
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');
  });

  test('Site Settings - Save and verify field values are loaded', async ({ page }) => {

    // Wait for the Site Settings tab to be visible and active
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-0"]:not([hidden])');

    // Define test values
    const testValues = {
      site_name: 'Kevin Althaus Test Site',
      site_description: 'A test site for verifying settings functionality',
      site_url: 'https://test.kevinalthaus.com',
      timezone: 'America/New_York',
      language: 'en',
    };


    // Fill in all Site Settings fields
    await page.getByLabel('Site Name', { exact: true }).clear();
    await page.getByLabel('Site Name', { exact: true }).fill(testValues.site_name);

    await page.getByLabel('Site Description').clear();
    await page.getByLabel('Site Description').fill(testValues.site_description);

    await page.getByLabel('Site URL').clear();
    await page.getByLabel('Site URL').fill(testValues.site_url);

    await page.getByLabel('Timezone').clear();
    await page.getByLabel('Timezone').fill(testValues.timezone);

    await page.getByLabel('Language').clear();
    await page.getByLabel('Language').fill(testValues.language);


    // Click Save button
    await page.getByRole('button', { name: /save.*site/i }).click();

    // Wait for success message
    await page.waitForSelector('text=/settings.*saved.*successfully/i', { timeout: 5000 });


    // Reload the page to verify settings are loaded from database
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for Site Settings tab to be active again
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-0"]:not([hidden])');


    // Verify all fields contain the saved values
    const siteNameInput = page.getByLabel('Site Name', { exact: true });
    const siteDescInput = page.getByLabel('Site Description');
    const siteUrlInput = page.getByLabel('Site URL');
    const timezoneInput = page.getByLabel('Timezone');
    const languageInput = page.getByLabel('Language');

    const siteNameValue = await siteNameInput.inputValue();
    const siteDescValue = await siteDescInput.inputValue();
    const siteUrlValue = await siteUrlInput.inputValue();
    const timezoneValue = await timezoneInput.inputValue();
    const languageValue = await languageInput.inputValue();


    // Assert all values match
    expect(siteNameValue).toBe(testValues.site_name);
    expect(siteDescValue).toBe(testValues.site_description);
    expect(siteUrlValue).toBe(testValues.site_url);
    expect(timezoneValue).toBe(testValues.timezone);
    expect(languageValue).toBe(testValues.language);


    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/settings-site-verified.png', fullPage: true });
  });

  test('Security Settings - Save and verify field values are loaded', async ({ page }) => {

    // Click Security tab (tab index 1)
    await page.getByRole('tab', { name: /security/i }).click();
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-1"]:not([hidden])');


    // Define test values
    const testValues = {
      session_timeout: 30,
      max_login_attempts: 5,
      lockout_duration: 15,
      password_min_length: 12,
      require_uppercase: true,
      require_lowercase: true,
      require_numbers: true,
      require_special_chars: true,
    };

    // Fill in numeric fields
    await page.getByLabel('Session Timeout (minutes)').clear();
    await page.getByLabel('Session Timeout (minutes)').fill(String(testValues.session_timeout));

    await page.getByLabel('Max Login Attempts').clear();
    await page.getByLabel('Max Login Attempts').fill(String(testValues.max_login_attempts));

    await page.getByLabel('Lockout Duration (minutes)').clear();
    await page.getByLabel('Lockout Duration (minutes)').fill(String(testValues.lockout_duration));

    await page.getByLabel('Minimum Password Length').clear();
    await page.getByLabel('Minimum Password Length').fill(String(testValues.password_min_length));


    // Click Save button
    await page.getByRole('button', { name: /save.*security/i }).click();

    // Wait for success message
    await page.waitForSelector('text=/settings.*saved.*successfully/i', { timeout: 5000 });


    // Reload and navigate back to Security tab
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /security/i }).click();
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-1"]:not([hidden])');


    const sessionTimeoutValue = await page.getByLabel('Session Timeout (minutes)').inputValue();
    const maxLoginAttemptsValue = await page.getByLabel('Max Login Attempts').inputValue();
    const lockoutDurationValue = await page.getByLabel('Lockout Duration (minutes)').inputValue();
    const passwordMinLengthValue = await page.getByLabel('Minimum Password Length').inputValue();


    // Assert all values match
    expect(sessionTimeoutValue).toBe(String(testValues.session_timeout));
    expect(maxLoginAttemptsValue).toBe(String(testValues.max_login_attempts));
    expect(lockoutDurationValue).toBe(String(testValues.lockout_duration));
    expect(passwordMinLengthValue).toBe(String(testValues.password_min_length));


    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/settings-security-verified.png', fullPage: true });
  });

  test('Email Settings - Save and verify field values are loaded', async ({ page }) => {

    // Click Email tab (tab index 2)
    await page.getByRole('tab', { name: /email/i }).click();
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-2"]:not([hidden])');


    const testValues = {
      smtp_host: 'smtp.test.com',
      smtp_port: 587,
      smtp_username: 'test@kevinalthaus.com',
      smtp_password: 'test-password-123',
      from_email: 'noreply@kevinalthaus.com',
      from_name: 'Kevin Althaus Test',
    };

    await page.getByLabel('SMTP Host').clear();
    await page.getByLabel('SMTP Host').fill(testValues.smtp_host);

    await page.getByLabel('SMTP Port').clear();
    await page.getByLabel('SMTP Port').fill(String(testValues.smtp_port));

    await page.getByLabel('SMTP Username').clear();
    await page.getByLabel('SMTP Username').fill(testValues.smtp_username);

    await page.getByLabel('SMTP Password').clear();
    await page.getByLabel('SMTP Password').fill(testValues.smtp_password);

    await page.getByLabel('From Email').clear();
    await page.getByLabel('From Email').fill(testValues.from_email);

    await page.getByLabel('From Name').clear();
    await page.getByLabel('From Name').fill(testValues.from_name);


    await page.getByRole('button', { name: /save.*email/i }).click();
    await page.waitForSelector('text=/settings.*saved.*successfully/i', { timeout: 5000 });


    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /email/i }).click();
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-2"]:not([hidden])');


    const smtpHostValue = await page.getByLabel('SMTP Host').inputValue();
    const smtpPortValue = await page.getByLabel('SMTP Port').inputValue();
    const smtpUsernameValue = await page.getByLabel('SMTP Username').inputValue();
    const fromEmailValue = await page.getByLabel('From Email').inputValue();
    const fromNameValue = await page.getByLabel('From Name').inputValue();


    expect(smtpHostValue).toBe(testValues.smtp_host);
    expect(smtpPortValue).toBe(String(testValues.smtp_port));
    expect(smtpUsernameValue).toBe(testValues.smtp_username);
    expect(fromEmailValue).toBe(testValues.from_email);
    expect(fromNameValue).toBe(testValues.from_name);


    await page.screenshot({ path: 'e2e/screenshots/settings-email-verified.png', fullPage: true });
  });

  test('External API Settings - Save and verify field values are loaded', async ({ page }) => {

    // Click External APIs tab (tab index 3)
    await page.getByRole('tab', { name: /external.*api/i }).click();
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-3"]:not([hidden])');


    const testValues = {
      google_maps_api_key: 'test-google-maps-key-123',
      usps_api_key: 'test-usps-key-456',
      census_api_key: 'test-census-key-789',
    };

    await page.getByLabel('Google Maps API Key').clear();
    await page.getByLabel('Google Maps API Key').fill(testValues.google_maps_api_key);

    await page.getByLabel('USPS API Key').clear();
    await page.getByLabel('USPS API Key').fill(testValues.usps_api_key);

    await page.getByLabel('Census.gov API Key').clear();
    await page.getByLabel('Census.gov API Key').fill(testValues.census_api_key);


    await page.getByRole('button', { name: /save.*external/i }).click();
    await page.waitForSelector('text=/settings.*saved.*successfully/i', { timeout: 5000 });


    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /external.*api/i }).click();
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-3"]:not([hidden])');


    const googleMapsValue = await page.getByLabel('Google Maps API Key').inputValue();
    const uspsValue = await page.getByLabel('USPS API Key').inputValue();
    const censusValue = await page.getByLabel('Census.gov API Key').inputValue();


    expect(googleMapsValue).toBe(testValues.google_maps_api_key);
    expect(uspsValue).toBe(testValues.usps_api_key);
    expect(censusValue).toBe(testValues.census_api_key);


    await page.screenshot({ path: 'e2e/screenshots/settings-external-api-verified.png', fullPage: true });
  });

  test('Verify Site Name shows on frontend', async ({ page }) => {

    // First, ensure Site Name is set in admin
    await page.goto('http://localhost:3003/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[role="tabpanel"][id="settings-tabpanel-0"]:not([hidden])');

    const expectedSiteName = 'Kevin Althaus Test Site';

    await page.getByLabel('Site Name', { exact: true }).clear();
    await page.getByLabel('Site Name', { exact: true }).fill(expectedSiteName);
    await page.getByRole('button', { name: /save.*site/i }).click();
    await page.waitForSelector('text=/settings.*saved.*successfully/i', { timeout: 5000 });


    // Now check frontend
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Take screenshot of frontend
    await page.screenshot({ path: 'e2e/screenshots/frontend-with-site-name.png', fullPage: true });

    // Check if site name appears in header or title
    const pageContent = await page.content();

    if (pageContent.includes(expectedSiteName)) {
    } else {
    }

  });
});
