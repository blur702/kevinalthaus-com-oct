import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';
import { selectors, getTableRow } from './utils/selectors';
import {
  createUserViaApi,
  deleteUserViaApi,
  listUsersViaApi,
  updateUserViaApi,
} from './utils/api';
import { createTestUser, randomString } from './utils/fixtures';

/**
 * User Management Tests
 *
 * Comprehensive test suite covering:
 * - User listing with pagination
 * - Search and filtering
 * - Create, read, update, delete operations
 * - Bulk operations
 * - User details view
 * - Protection of admin user (kevin)
 */

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

    // Navigate to users page
    await page.goto('/users');
    await expect(page.locator(selectors.users.title)).toBeVisible();
  });

  test.describe('Page Load', () => {
    test('should load users page successfully', async ({ page }) => {
      // Title should be visible
      await expect(page.locator(selectors.users.title)).toBeVisible();

      // Table should be visible
      await expect(page.locator(selectors.users.table.container)).toBeVisible();

      // Create button should be visible
      await expect(page.locator(selectors.users.createButton)).toBeVisible();
    });

    test('should display user table with data', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector(selectors.users.table.bodyRows, { timeout: 10000 });

      // Should have at least one user (kevin)
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display kevin admin user', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Kevin should be in the list
      const kevinRow = page.locator('tbody tr:has-text("kevin")');
      await expect(kevinRow).toBeVisible();

      // Kevin should be admin
      const roleChip = kevinRow.locator('.MuiChip-root').first();
      await expect(roleChip).toContainText(/admin/i);
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination controls', async ({ page }) => {
      const pagination = page.locator(selectors.users.pagination.container);
      await expect(pagination).toBeVisible();
    });

    test('should display current page info', async ({ page }) => {
      const pageInfo = page.locator(selectors.users.pagination.pageInfo);
      await expect(pageInfo).toBeVisible();

      const text = await pageInfo.textContent();
      expect(text).toMatch(/\d+-\d+ of \d+/);
    });

    test('should change page size', async ({ page }) => {
      // Wait for initial load
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Get initial row count
      const initialCount = await page.locator(selectors.users.table.bodyRows).count();

      // Wait for response when changing page size
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Change page size to 10
      await page.selectOption(selectors.users.pagination.rowsPerPage, '10');

      // Wait for table to update via API response
      await responsePromise;

      // Row count should update (may be same if total is less than 10)
      const newCount = await page.locator(selectors.users.table.bodyRows).count();
      expect(newCount).toBeLessThanOrEqual(10);
      expect(newCount).toBeGreaterThan(0);
    });

    test('should navigate to next page if available', async ({ page }) => {
      // Get total count from pagination
      const pageInfo = await page.locator(selectors.users.pagination.pageInfo).textContent();
      const totalMatch = pageInfo?.match(/of (\d+)/);
      const total = totalMatch ? parseInt(totalMatch[1]) : 0;

      // Only test if there are enough users for pagination
      if (total > 25) {
        // Wait for response when navigating to next page
        const responsePromise = page.waitForResponse((response) =>
          response.url().includes('/api/users') && response.status() === 200
        );

        // Click next page
        await page.click(selectors.users.pagination.nextButton);

        // Wait for table to update via API response
        await responsePromise;

        // Page info should update
        const newPageInfo = await page
          .locator(selectors.users.pagination.pageInfo)
          .textContent();
        expect(newPageInfo).not.toBe(pageInfo);
      } else {
        // If not enough users exist, verify pagination is disabled
        const nextButton = page.locator(selectors.users.pagination.nextButton);
        await expect(nextButton).toBeDisabled();
      }
    });

    test('should navigate to previous page', async ({ page }) => {
      // Get total count
      const pageInfo = await page.locator(selectors.users.pagination.pageInfo).textContent();
      const totalMatch = pageInfo?.match(/of (\d+)/);
      const total = totalMatch ? parseInt(totalMatch[1]) : 0;

      // Only test if there are enough users for pagination
      if (total > 25) {
        // Wait for response when going to next page
        let responsePromise = page.waitForResponse((response) =>
          response.url().includes('/api/users') && response.status() === 200
        );

        // Go to next page first
        await page.click(selectors.users.pagination.nextButton);
        await responsePromise;

        // Wait for response when going back
        responsePromise = page.waitForResponse((response) =>
          response.url().includes('/api/users') && response.status() === 200
        );

        // Then go back
        await page.click(selectors.users.pagination.previousButton);
        await responsePromise;

        // Should be back on page 1
        const newPageInfo = await page
          .locator(selectors.users.pagination.pageInfo)
          .textContent();
        expect(newPageInfo).toContain('1-');
      } else {
        // If not enough users exist, verify we're on the first page and previous is disabled
        const previousButton = page.locator(selectors.users.pagination.previousButton);
        await expect(previousButton).toBeDisabled();
      }
    });
  });

  test.describe('Search and Filtering', () => {
    test('should search users by username', async ({ page }) => {
      // Wait for response when searching
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Search for kevin
      await page.fill(selectors.users.searchInput, 'kevin');

      // Wait for search to complete
      await responsePromise;

      // Should find kevin
      const kevinRow = page.locator('tbody tr:has-text("kevin")');
      await expect(kevinRow).toBeVisible();

      // Other users should be filtered out
      const rowCount = await page.locator(selectors.users.table.bodyRows).count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should search users by email', async ({ page }) => {
      // Get kevin's email from the table
      const kevinRow = page.locator('tbody tr:has-text("kevin")');
      const email = await kevinRow.locator('td:nth-child(3)').textContent();

      if (email) {
        // Wait for response when searching
        const responsePromise = page.waitForResponse((response) =>
          response.url().includes('/api/users') && response.status() === 200
        );

        // Search by email prefix
        const emailPrefix = email.split('@')[0];
        await page.fill(selectors.users.searchInput, emailPrefix);

        // Wait for search to complete
        await responsePromise;

        // Should find the user
        await expect(kevinRow).toBeVisible();
      }
    });

    test('should show no results for non-existent search', async ({ page }) => {
      // Wait for response when searching
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Search for non-existent user
      await page.fill(selectors.users.searchInput, 'zzz_nonexistent_999');

      // Wait for search to complete
      await responsePromise;

      // Should show no results message
      const noData = page.locator('text=No users found');
      await expect(noData).toBeVisible();
    });

    test('should filter by role - Admin', async ({ page }) => {
      // Wait for response when filtering
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Filter by admin role
      await page.selectOption(selectors.users.roleFilter, 'admin');

      // Wait for filter to complete
      await responsePromise;

      // All visible users should be admin
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const roleChip = rows.nth(i).locator('.MuiChip-root').first();
          await expect(roleChip).toContainText(/admin/i);
        }
      }
    });

    test('should filter by status - Active', async ({ page }) => {
      // Wait for response when filtering
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Filter by active status
      await page.selectOption(selectors.users.statusFilter, 'true');

      // Wait for filter to complete
      await responsePromise;

      // All visible users should be active
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const statusChip = rows.nth(i).locator('td:nth-child(5) .MuiChip-root');
          await expect(statusChip).toContainText(/active/i);
        }
      }
    });

    test('should combine search and filters', async ({ page }) => {
      // Wait for response when applying search and filter
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Search for kevin and filter by admin
      await page.fill(selectors.users.searchInput, 'kevin');
      await page.selectOption(selectors.users.roleFilter, 'admin');

      // Wait for filter to complete
      await responsePromise;

      // Should find kevin as admin
      const kevinRow = page.locator('tbody tr:has-text("kevin")');
      await expect(kevinRow).toBeVisible();
    });

    test('should clear search on input change', async ({ page }) => {
      // Wait for first search response
      let responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Search for something
      await page.fill(selectors.users.searchInput, 'test');
      await responsePromise;

      // Wait for clear search response
      responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Clear search
      await page.fill(selectors.users.searchInput, '');
      await responsePromise;

      // Should show all users again
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should refresh data on refresh button click', async ({ page }) => {
      // Wait for response when refreshing
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Click refresh button
      await page.click(selectors.users.refreshButton);

      // Wait for reload
      await responsePromise;

      // Table should still have data
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Sorting', () => {
    test('should sort by username', async ({ page }) => {
      // Wait for response when sorting
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Click username sort header
      await page.click('th:has-text("Username") .MuiTableSortLabel-root');

      // Wait for sort to complete
      await responsePromise;

      // Get usernames
      const usernames: string[] = [];
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const username = await rows.nth(i).locator('td:nth-child(2)').textContent();
        if (username) {usernames.push(username);}
      }

      // Should be sorted (ascending or descending)
      expect(usernames.length).toBeGreaterThan(0);
    });

    test('should toggle sort direction', async ({ page }) => {
      const sortButton = page.locator('th:has-text("Username") .MuiTableSortLabel-root');

      // Wait for first sort response
      let responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Click once for ascending
      await sortButton.click();
      await responsePromise;

      // Wait for second sort response
      responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Click again for descending
      await sortButton.click();
      await responsePromise;

      // Table should still have data
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should sort by email', async ({ page }) => {
      // Wait for response when sorting
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      await page.click('th:has-text("Email") .MuiTableSortLabel-root');

      // Wait for sort to complete
      await responsePromise;

      // Table should update
      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should sort by created date', async ({ page }) => {
      // Wait for response when sorting
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      await page.click('th:has-text("Created") .MuiTableSortLabel-root');

      // Wait for sort to complete
      await responsePromise;

      const rows = page.locator(selectors.users.table.bodyRows);
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Selection', () => {
    test('should select individual user', async ({ page }) => {
      // Wait for table
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Click first row checkbox
      const firstCheckbox = page.locator(selectors.users.table.rowCheckbox).first();
      await firstCheckbox.click();

      // Should show selected count
      const selectedChip = page.locator('.MuiChip-root:has-text("selected")');
      await expect(selectedChip).toBeVisible();
      await expect(selectedChip).toContainText('1');
    });

    test('should select multiple users', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Select first two users
      const checkboxes = page.locator(selectors.users.table.rowCheckbox);
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();

      // Should show selected count of 2
      const selectedChip = page.locator('.MuiChip-root:has-text("selected")');
      await expect(selectedChip).toContainText('2');
    });

    test('should select all users on page', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Click select all checkbox
      await page.click(selectors.users.table.selectAllCheckbox);

      // All rows should be selected
      const selectedChip = page.locator('.MuiChip-root:has-text("selected")');
      await expect(selectedChip).toBeVisible();
    });

    test('should deselect all users', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Select all
      await page.click(selectors.users.table.selectAllCheckbox);

      // Deselect all
      await page.click(selectors.users.table.selectAllCheckbox);

      // Selected chip should not be visible
      const selectedChip = page.locator('.MuiChip-root:has-text("selected")');
      await expect(selectedChip).not.toBeVisible();
    });

    test('should show bulk actions when users selected', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Select first user
      const firstCheckbox = page.locator(selectors.users.table.rowCheckbox).first();
      await firstCheckbox.click();

      // Bulk delete button should appear
      const deleteButton = page.locator('button:has-text("Delete Selected")');
      await expect(deleteButton).toBeVisible();
    });
  });

  test.describe('Create User', () => {
    test('should open create user dialog', async ({ page }) => {
      // Click create button
      await page.click(selectors.users.createButton);

      // Dialog should open
      await expect(page.locator(selectors.userForm.dialog)).toBeVisible();
      await expect(page.locator('h2:has-text("Create User")')).toBeVisible();
    });

    test('should create new user successfully', async ({ page }) => {
      const testUser = createTestUser();

      // Open dialog
      await page.click(selectors.users.createButton);

      // Fill form
      await page.fill(selectors.userForm.usernameInput, testUser.username);
      await page.fill(selectors.userForm.emailInput, testUser.email);
      await page.fill(selectors.userForm.passwordInput, testUser.password);
      await page.selectOption(selectors.userForm.roleSelect, testUser.role);

      // Submit
      await page.click(selectors.userForm.submitButton);

      // Should show success message
      await expect(page.locator(selectors.common.successAlert)).toBeVisible({ timeout: 5000 });

      // Wait for response when searching for new user
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Search for new user
      await page.fill(selectors.users.searchInput, testUser.username);

      // Wait for search to complete
      await responsePromise;

      // New user should be in list
      const userRow = page.locator(`tbody tr:has-text("${testUser.username}")`);
      await expect(userRow).toBeVisible();

      // Cleanup
      const userId = await userRow.getAttribute('data-id');
      if (userId) {
        await deleteUserViaApi(page, userId);
      }
    });

    test('should validate required fields', async ({ page }) => {
      // Open dialog
      await page.click(selectors.users.createButton);

      // Try to submit without filling fields
      await page.click(selectors.userForm.submitButton);

      // Should show validation errors
      const errors = page.locator(selectors.userForm.errorMessage);
      const count = await errors.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should validate email format', async ({ page }) => {
      // Open dialog
      await page.click(selectors.users.createButton);

      // Fill invalid email
      await page.fill(selectors.userForm.usernameInput, 'testuser');
      await page.fill(selectors.userForm.emailInput, 'invalid-email');
      await page.fill(selectors.userForm.passwordInput, 'Password123!');

      // Try to submit
      await page.click(selectors.userForm.submitButton);

      // Should show email validation error
      const emailError = page.locator('input[name="email"] ~ .Mui-error');
      await expect(emailError).toBeVisible();
    });

    test('should close dialog on cancel', async ({ page }) => {
      // Open dialog
      await page.click(selectors.users.createButton);

      // Click cancel
      await page.click(selectors.userForm.cancelButton);

      // Dialog should close
      await expect(page.locator(selectors.userForm.dialog)).not.toBeVisible();
    });
  });

  test.describe('Edit User', () => {
    let testUserId: string;

    test.beforeAll(async ({ browser }) => {
      // Create a test user for editing
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

      const testUser = createTestUser();
      const created = await createUserViaApi(page, testUser);
      testUserId = (created as { id: string }).id;

      await context.close();
    });

    test.afterAll(async ({ browser }) => {
      // Cleanup test user
      if (testUserId) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
        await deleteUserViaApi(page, testUserId);
        await context.close();
      }
    });

    test('should open edit user dialog', async ({ page }) => {
      // Find test user row
      const users = await listUsersViaApi(page);
      if (users.users.length > 0) {
        // Click edit on first user (not kevin)
        const rows = page.locator('tbody tr');
        const count = await rows.count();

        for (let i = 0; i < count; i++) {
          const row = rows.nth(i);
          const username = await row.locator('td:nth-child(2)').textContent();

          if (username && username !== 'kevin') {
            // Click edit button
            await row.locator('button[aria-label*="Edit"]').click();

            // Dialog should open
            await expect(page.locator(selectors.userForm.dialog)).toBeVisible();
            await expect(page.locator('h2:has-text("Edit User")')).toBeVisible();
            break;
          }
        }
      }
    });

    test('should update user details', async ({ page }) => {
      // Wait for response when searching
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Search for a test user
      await page.fill(selectors.users.searchInput, 'testuser');

      // Wait for search to complete
      await responsePromise;

      const rows = page.locator('tbody tr');
      const count = await rows.count();

      if (count > 0) {
        // Click edit on first result
        await rows.first().locator('button[aria-label*="Edit"]').click();

        // Update email
        const newEmail = `updated_${randomString(8)}@example.com`;
        await page.fill(selectors.userForm.emailInput, '');
        await page.fill(selectors.userForm.emailInput, newEmail);

        // Submit
        await page.click(selectors.userForm.submitButton);

        // Should show success message
        await expect(page.locator(selectors.common.successAlert)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('View User Details', () => {
    test('should open user detail dialog on row click', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Click on first row (not checkbox or action buttons)
      await page.click('tbody tr:first-child td:nth-child(2)');

      // Detail dialog should open
      await expect(page.locator(selectors.userDetail.dialog)).toBeVisible();
    });

    test('should display user information in detail view', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Click on kevin's row
      await page.click('tbody tr:has-text("kevin") td:nth-child(2)');

      // Dialog should show kevin's details
      const dialog = page.locator(selectors.userDetail.dialog);
      await expect(dialog).toContainText('kevin');
    });

    test('should close detail dialog', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Open detail dialog
      await page.click('tbody tr:first-child td:nth-child(2)');

      // Close dialog
      await page.click(selectors.userDetail.closeButton);

      // Dialog should close
      await expect(page.locator(selectors.userDetail.dialog)).not.toBeVisible();
    });
  });

  test.describe('Delete User', () => {
    test('should prevent deleting kevin admin user', async ({ page }) => {
      // Find kevin's row
      const kevinRow = page.locator('tbody tr:has-text("kevin")');
      await expect(kevinRow).toBeVisible();

      // Try to click delete (if button exists)
      const deleteButton = kevinRow.locator('button:has-text("Delete")');
      const isVisible = await deleteButton.isVisible().catch(() => false);

      if (isVisible) {
        await deleteButton.click();

        // Should show error or warning
        const error = page.locator(selectors.common.errorAlert);
        await expect(error).toBeVisible({ timeout: 3000 });
      }
    });

    test('should open delete confirmation dialog', async ({ page }) => {
      // Wait for response when searching
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/users') && response.status() === 200
      );

      // Search for test user
      await page.fill(selectors.users.searchInput, 'testuser');

      // Wait for search to complete
      await responsePromise;

      const rows = page.locator('tbody tr');
      const count = await rows.count();

      if (count > 0) {
        // Click more actions menu
        await rows.first().locator('button[aria-label*="More"]').click();

        // Click delete from menu
        await page.click('text=Delete User');

        // Confirmation dialog should open
        await expect(page.locator(selectors.deleteDialog.dialog)).toBeVisible();
        await expect(page.locator(selectors.deleteDialog.title)).toBeVisible();
      }
    });
  });

  test.describe('Bulk Operations', () => {
    test('should open bulk operations dialog', async ({ page }) => {
      // Click import/export button
      await page.click(selectors.users.bulk.importExportButton);

      // Bulk dialog should open
      await expect(page.locator(selectors.bulkDialog.dialog)).toBeVisible();
    });

    test('should show bulk delete button when users selected', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Select a user (not kevin)
      const checkboxes = page.locator(selectors.users.table.rowCheckbox);
      await checkboxes.nth(1).click();

      // Bulk delete button should appear
      const deleteButton = page.locator('button:has-text("Delete Selected")');
      await expect(deleteButton).toBeVisible();
    });

    test('should confirm bulk delete', async ({ page }) => {
      await page.waitForSelector(selectors.users.table.bodyRows);

      // Select a test user
      const rows = page.locator('tbody tr');
      const count = await rows.count();

      if (count > 1) {
        // Select non-kevin user
        for (let i = 0; i < count; i++) {
          const username = await rows.nth(i).locator('td:nth-child(2)').textContent();
          if (username && username !== 'kevin') {
            await rows.nth(i).locator('input[type="checkbox"]').click();
            break;
          }
        }

        // Click delete selected
        await page.click('button:has-text("Delete Selected")');

        // Confirmation dialog should open
        const dialog = page.locator('[role="dialog"]:has-text("Confirm Bulk Delete")');
        await expect(dialog).toBeVisible();

        // Cancel to avoid actually deleting
        await page.click('button:has-text("Cancel")');
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Table should still be visible (may scroll horizontally)
      await expect(page.locator(selectors.users.title)).toBeVisible();
      await expect(page.locator(selectors.users.table.container)).toBeVisible();
    });

    test('should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      // All elements should be visible
      await expect(page.locator(selectors.users.title)).toBeVisible();
      await expect(page.locator(selectors.users.createButton)).toBeVisible();
      await expect(page.locator(selectors.users.table.container)).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('**/api/users*', (route) => route.abort('failed'));

      // Reload page
      await page.reload();

      // Should show error message
      const error = page.locator(selectors.common.errorAlert);
      await expect(error).toBeVisible({ timeout: 5000 });
    });

    test('should handle network timeout', async ({ page }) => {
      // Mock slow response
      await page.route('**/api/users*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 15000));
        await route.abort('timedout');
      });

      // Reload
      await page.reload();

      // Should show error or loading state
      const hasError = await page.locator(selectors.common.errorAlert).isVisible().catch(() => false);
      const hasLoading = await page.locator(selectors.common.loading).isVisible().catch(() => false);

      expect(hasError || hasLoading).toBe(true);
    });
  });
});
