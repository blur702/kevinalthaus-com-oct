import { test as base, expect } from '@playwright/test';
import { ConsoleMonitor } from '../../e2e/utils/console-monitor';
import * as fs from 'fs';
import * as path from 'path';

// Production test credentials (from user requirements)
const PROD_ADMIN_CREDENTIALS = {
  username: 'kevin',
  password: '(130Bpm)'
};

// Extend test with console monitoring
const test = base.extend<{ consoleMonitor: ConsoleMonitor }>({
  consoleMonitor: async ({ page }, use) => {
    // Create test-results directory if it doesn't exist
    const testResultsDir = path.join(process.cwd(), 'test-results-production');
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    // Open log stream for console errors
    const consoleErrorsLog = path.join(testResultsDir, 'console-errors-production.log');
    const logStream = fs.createWriteStream(consoleErrorsLog, { flags: 'a' });

    // Write session header
    logStream.write(`\n${'='.repeat(80)}\n`);
    logStream.write(`Production Admin Authentication Test\n`);
    logStream.write(`Started: ${new Date().toISOString()}\n`);
    logStream.write(`Target: http://kevinalthaus.com/admin\n`);
    logStream.write(`${'='.repeat(80)}\n\n`);

    // Create and attach monitor
    const monitor = new ConsoleMonitor();
    monitor.attachToPage(page, logStream);

    try {
      await use(monitor);
    } finally {
      // Detach and write summary
      monitor.detachFromPage(page);

      const summary = monitor.getSummary();
      logStream.write(`\n${'='.repeat(80)}\n`);
      logStream.write(`Test Session Complete\n`);
      logStream.write(`Ended: ${new Date().toISOString()}\n`);
      logStream.write(`Total Browser Errors: ${summary.errors}\n`);
      logStream.write(`Total Browser Warnings: ${summary.warnings}\n`);
      logStream.write(`${'='.repeat(80)}\n\n`);

      logStream.end();
    }
  }
});

test.describe('Production Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
  });

  test('should load admin login page without console errors', async ({ page, consoleMonitor }) => {
    console.log('🧪 Testing admin login page load...');

    const response = await page.goto('http://kevinalthaus.com/admin');

    // Should return 200
    expect(response?.status()).toBe(200);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check for critical console errors
    const errors = consoleMonitor.getErrorsByLevel('ERROR');
    const criticalErrors = errors.filter(e => {
      const msg = e.message.toLowerCase();
      return !msg.includes('401') &&
             !msg.includes('403') &&
             !msg.includes('unauthorized') &&
             !msg.includes('theme-overrides.css') && // Optional file with onerror handler
             !(msg.includes('failed to load resource') && msg.includes('404')); // 404 for optional resources
    });

    if (criticalErrors.length > 0) {
      console.error('❌ Found critical console errors on admin page load:');
      criticalErrors.forEach(err => console.error(`  - ${err.message}`));
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('should login successfully with valid admin credentials', async ({ page, consoleMonitor }) => {
    console.log('🧪 Testing admin login authentication...');

    await page.goto('http://kevinalthaus.com/admin');
    await page.waitForLoadState('networkidle');

    // Look for login form elements
    const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="username" i]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();

    // Verify login form is visible
    await expect(usernameInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    console.log('📝 Filling login credentials...');

    // Fill credentials
    await usernameInput.fill(PROD_ADMIN_CREDENTIALS.username);
    await passwordInput.fill(PROD_ADMIN_CREDENTIALS.password);

    console.log('🔑 Submitting login form...');

    // Submit form
    await submitButton.click();

    // Wait for navigation or dashboard to load
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Check if we're authenticated (should NOT be on login page anymore)
    const currentUrl = page.url();
    console.log(`📍 Current URL after login: ${currentUrl}`);

    // Should either redirect to dashboard or stay on admin without login form
    const isAuthenticated = !currentUrl.includes('/login') || !(await usernameInput.isVisible().catch(() => false));

    if (!isAuthenticated) {
      console.error('❌ Login failed - still on login page');

      // Check for error messages
      const errorMessages = await page.locator('[role="alert"], .error, .alert-danger').allTextContents();
      if (errorMessages.length > 0) {
        console.error('Error messages found:', errorMessages);
      }
    }

    expect(isAuthenticated).toBe(true);

    // Check for console errors during login
    const loginErrors = consoleMonitor.getErrorsByLevel('ERROR');
    const criticalLoginErrors = loginErrors.filter(e => {
      const msg = e.message.toLowerCase();
      return !msg.includes('401') &&
             !msg.includes('403') &&
             !msg.includes('theme-overrides.css') && // Optional file with onerror handler
             !(msg.includes('failed to load resource') && msg.includes('404')); // 404 for optional resources
    });

    if (criticalLoginErrors.length > 0) {
      console.error('❌ Found console errors during login:');
      criticalLoginErrors.forEach(err => console.error(`  - ${err.message}`));
    }

    expect(criticalLoginErrors.length).toBe(0);

    console.log('✅ Admin login successful!');
  });

  test('should have valid session after login', async ({ page, consoleMonitor }) => {
    console.log('🧪 Testing admin session persistence...');

    // Login first
    await page.goto('http://kevinalthaus.com/admin');
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    await usernameInput.fill(PROD_ADMIN_CREDENTIALS.username);
    await passwordInput.fill(PROD_ADMIN_CREDENTIALS.password);
    await submitButton.click();

    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Check cookies are set
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter(c =>
      c.name.toLowerCase().includes('token') ||
      c.name.toLowerCase().includes('session') ||
      c.name.toLowerCase().includes('auth')
    );

    console.log(`🍪 Found ${authCookies.length} authentication cookies`);
    authCookies.forEach(c => console.log(`  - ${c.name}`));

    expect(authCookies.length).toBeGreaterThan(0);

    // Reload page to test session persistence
    console.log('🔄 Reloading page to test session...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be authenticated (not redirected to login)
    const currentUrl = page.url();
    const stillAuthenticated = !currentUrl.includes('/login');

    if (!stillAuthenticated) {
      console.error('❌ Session lost after reload');
    } else {
      console.log('✅ Session persisted after reload');
    }

    expect(stillAuthenticated).toBe(true);

    // No console errors during session check
    const sessionErrors = consoleMonitor.getErrorsByLevel('ERROR');
    expect(sessionErrors.length).toBe(0);
  });

  test('should display admin dashboard content after login', async ({ page, consoleMonitor }) => {
    console.log('🧪 Testing admin dashboard content...');

    // Login
    await page.goto('http://kevinalthaus.com/admin');
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    await usernameInput.fill(PROD_ADMIN_CREDENTIALS.username);
    await passwordInput.fill(PROD_ADMIN_CREDENTIALS.password);
    await submitButton.click();

    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Check for React app root
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Check that dashboard has content
    const hasContent = await root.evaluate(el => el.children.length > 0);
    expect(hasContent).toBe(true);

    // Look for common admin UI elements
    const hasNavigation = await page.locator('nav, [role="navigation"], aside, .sidebar').count() > 0;
    const hasHeading = await page.locator('h1, h2, [role="heading"]').count() > 0;

    console.log(`📊 Dashboard elements: Navigation=${hasNavigation}, Heading=${hasHeading}`);

    expect(hasNavigation || hasHeading).toBe(true);

    // No console errors on dashboard
    const dashboardErrors = consoleMonitor.getErrorsByLevel('ERROR');
    const criticalErrors = dashboardErrors.filter(e =>
      !e.message.toLowerCase().includes('failed to load resource')
    );

    if (criticalErrors.length > 0) {
      console.error('❌ Found console errors on dashboard:');
      criticalErrors.forEach(err => console.error(`  - ${err.message}`));
    }

    expect(criticalErrors.length).toBe(0);

    console.log('✅ Admin dashboard loaded successfully');
  });
});
