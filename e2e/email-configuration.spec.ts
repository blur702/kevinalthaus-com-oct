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
    console.log('Step 1: Logging in as admin...');

    // Login
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });
    console.log('✓ Logged in successfully');

    // Step 2: Navigate to Settings page
    console.log('Step 2: Navigating to Settings...');
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings', { timeout: 5000 });
    console.log('✓ Settings page loaded');

    // Step 3: Click on Email Settings tab
    console.log('Step 3: Opening Email Settings tab...');
    const emailTab = page.locator('button:has-text("Email Settings")');
    await emailTab.click();
    await page.waitForTimeout(500); // Wait for tab animation
    console.log('✓ Email Settings tab opened');

    // Step 4: Verify Brevo is selected (default)
    console.log('Step 4: Verifying Brevo provider is selected...');
    const brevoSwitch = page.locator('input[type="checkbox"]').filter({ has: page.locator('text=/Brevo/i') }).first();
    const isBrevoSelected = await brevoSwitch.isChecked();

    if (!isBrevoSelected) {
      console.log('  Switching to Brevo provider...');
      await brevoSwitch.click();
      await page.waitForTimeout(300);
    }
    console.log('✓ Brevo provider selected');

    // Step 5: Enter Brevo API key
    console.log('Step 5: Entering Brevo API key...');
    const apiKeyInput = page.locator('input[type="password"]').filter({ hasText: /Brevo API Key/i }).or(
      page.locator('label:has-text("Brevo API Key")').locator('..').locator('input')
    ).first();

    // The API key might be in a password field, look for the label
    const apiKeyField = page.getByLabel('Brevo API Key');
    await apiKeyField.fill('v98KyhcFSHqgXf7t');
    console.log('✓ API key entered');

    // Step 6: Enter from email and name
    console.log('Step 6: Entering sender information...');

    // Find the From Email field (there might be multiple, select the one that's visible)
    const fromEmailField = page.locator('input[type="email"]').filter({ hasText: /From Email/i }).or(
      page.getByLabel('From Email')
    ).first();
    await fromEmailField.fill('noreply@kevinalthaus.com');
    console.log('✓ From email entered: noreply@kevinalthaus.com');

    const fromNameField = page.locator('label:has-text("From Name")').locator('..').locator('input').first();
    await fromNameField.fill('Kevin Althaus');
    console.log('✓ From name entered: Kevin Althaus');

    // Step 7: Save settings
    console.log('Step 7: Saving email settings...');
    const saveButton = page.locator('button:has-text("Save Changes")').first();
    await saveButton.click();

    // Wait for success notification
    await expect(page.locator('text=/saved successfully/i').or(page.locator('text=/success/i'))).toBeVisible({ timeout: 10000 });
    console.log('✓ Settings saved successfully');

    // Verify API key configured indicator
    const apiKeyConfigured = page.locator('text=/API Key Configured/i');
    await expect(apiKeyConfigured).toBeVisible({ timeout: 5000 });
    console.log('✓ API key configuration confirmed');

    // Step 8: Send test email
    console.log('Step 8: Sending test email...');
    const testEmailButton = page.locator('button:has-text("Test Email")');
    await testEmailButton.click();

    // Wait for test email result
    await expect(
      page.locator('text=/test email sent/i').or(
        page.locator('text=/check your inbox/i')
      )
    ).toBeVisible({ timeout: 15000 });
    console.log('✓ Test email sent');

    // Success summary
    console.log('\n✅ EMAIL CONFIGURATION TEST COMPLETED SUCCESSFULLY!');
    console.log('---------------------------------------------------');
    console.log('1. ✓ Logged in as admin (kevin)');
    console.log('2. ✓ Navigated to Settings → Email');
    console.log('3. ✓ Selected Brevo as email provider');
    console.log('4. ✓ Entered Brevo API key (v98KyhcFSHqgXf7t)');
    console.log('5. ✓ Configured sender (noreply@kevinalthaus.com)');
    console.log('6. ✓ Saved settings successfully');
    console.log('7. ✓ API key configuration verified');
    console.log('8. ✓ Test email sent successfully');
    console.log('---------------------------------------------------');
  });

  test('should show API key configured status after configuration', async ({ page }) => {
    console.log('Verifying API key configured status...');

    // Login
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
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
    console.log('✓ API key configured status verified');

    // Verify helper text shows "Leave blank to keep existing key"
    const helperText = page.locator('text=/Leave blank to keep existing key/i');
    await expect(helperText).toBeVisible();
    console.log('✓ Helper text indicates key is already configured');

    console.log('\n✅ API KEY STATUS VERIFICATION COMPLETE!');
  });
});
