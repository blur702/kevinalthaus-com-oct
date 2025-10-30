import { test, expect } from '@playwright/test';

/**
 * Complete E2E Workflow Test
 *
 * This test demonstrates the complete user management flow:
 * 1. Login as admin (kevin)
 * 2. Create a new test user
 * 3. Verify user appears in the listings
 * 4. Logout
 * 5. Login as the new user
 * 6. Verify successful authentication
 */

test.describe('Complete User Management Workflow', () => {
  const adminUsername = process.env.TEST_ADMIN_USERNAME || 'kevin';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || '(130Bpm)';

  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `testuser_${Date.now()}@example.com`,
    password: 'Test123!@#',
    role: 'viewer',
  };

  test('should complete full workflow: login, create user, verify listing, login as new user', async ({ page }) => {
    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    await page.goto('/login');
    await page.fill('input[name="identifier"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');

    // Wait for successful login (redirect to dashboard)
    await page.waitForURL(/\/(dashboard)?$/);
    console.log('✓ Admin login successful');

    // Step 2: Navigate to Users page
    console.log('Step 2: Navigating to Users page...');

    // Set up response listener BEFORE navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/users-manager') && response.status() === 200
    );

    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Wait for users list to load
    await responsePromise;
    console.log('✓ Users page loaded');

    // Step 3: Create new user
    console.log('Step 3: Creating new test user...');
    await page.click('button:has-text("Create User")');

    // Wait for dialog to appear
    await page.waitForSelector('[role="dialog"]');

    // Fill in user details using label-based selectors
    await page.getByLabel('Username *').fill(testUser.username);
    await page.getByLabel('Email *').fill(testUser.email);
    await page.getByLabel('Password *').fill(testUser.password);
    await page.getByLabel('Confirm Password *').fill(testUser.password);

    // Role dropdown is already set to "viewer" by default, no need to change

    // Submit form
    await page.click('button:has-text("Create User"):last-of-type');

    // Wait for success (dialog closes and list refreshes)
    const createResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/users-manager') &&
      response.request().method() === 'POST' &&
      response.status() === 201
    );
    await createResponsePromise;

    console.log(`✓ Test user created: ${testUser.username}`);

    // Step 4: Verify user appears in listing
    console.log('Step 4: Verifying user appears in list...');

    // Search for the new user
    await page.fill('input[placeholder*="Search"]', testUser.username);
    await page.waitForResponse((response) =>
      response.url().includes('/api/users-manager') &&
      response.url().includes(`search=${testUser.username}`) &&
      response.status() === 200
    );

    // Verify user row appears
    const userRow = page.locator(`tr:has-text("${testUser.username}")`);
    await expect(userRow).toBeVisible();
    await expect(userRow.locator(`td:has-text("${testUser.email}")`)).toBeVisible();
    await expect(userRow.locator(`td:has-text("${testUser.role}")`)).toBeVisible();

    console.log('✓ User appears in listing with correct details');

    // Step 5: Logout
    console.log('Step 5: Logging out...');
    await page.click('button[aria-label="Account"]');
    await page.click('text=Logout');
    await page.waitForURL('/login');
    console.log('✓ Logged out successfully');

    // Step 6: Login as new user
    console.log('Step 6: Logging in as new user...');
    await page.fill('input[name="identifier"]', testUser.username);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Wait for successful login
    await page.waitForURL(/\/(dashboard)?$/);
    console.log(`✓ Successfully logged in as new user: ${testUser.username}`);

    // Step 7: Verify user is authenticated
    console.log('Step 7: Verifying authentication...');

    // Check for dashboard or user menu presence
    const isAuthenticated = await page.locator('button[aria-label="Account"]').isVisible();
    expect(isAuthenticated).toBe(true);
    console.log('✓ New user is authenticated and can access the application');

    // Final verification: Check dashboard loads
    await page.goto('/dashboard');
    await page.waitForURL('/dashboard');
    const dashboardTitle = page.locator('h1:has-text("Dashboard")');
    await expect(dashboardTitle).toBeVisible();
    console.log('✓ Dashboard accessible by new user');

    console.log('\n=== WORKFLOW COMPLETE ===');
    console.log(`Created user: ${testUser.username} (${testUser.email})`);
    console.log('All steps passed successfully!');
  });
});
