/**
 * Test data factories for creating mock data
 */

export interface TestUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'editor' | 'viewer' | 'guest';
  active: boolean;
}

/**
 * Generate a unique test user
 *
 * @param overrides - Properties to override in the generated user
 * @returns Test user object
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);

  return {
    username: `testuser_${timestamp}_${random}`,
    email: `testuser_${timestamp}_${random}@example.com`,
    password: 'TestPassword123!',
    role: 'viewer',
    active: true,
    ...overrides,
  };
}

/**
 * Generate multiple test users
 *
 * @param count - Number of users to generate
 * @param overrides - Base properties to apply to all users
 * @returns Array of test users
 */
export function createTestUsers(
  count: number,
  overrides: Partial<TestUser> = {}
): TestUser[] {
  return Array.from({ length: count }, () => createTestUser(overrides));
}

/**
 * Test data for various roles
 */
export const TEST_USER_BY_ROLE = {
  admin: (): TestUser => createTestUser({ role: 'admin' }),
  editor: (): TestUser => createTestUser({ role: 'editor' }),
  viewer: (): TestUser => createTestUser({ role: 'viewer' }),
  guest: (): TestUser => createTestUser({ role: 'guest' }),
};

/**
 * Invalid test data for validation testing
 */
export const INVALID_TEST_DATA = {
  email: {
    missing: '',
    invalid: 'not-an-email',
    malformed: 'test@',
  },
  password: {
    missing: '',
    tooShort: '123',
    noSpecialChar: 'Password123',
  },
  username: {
    missing: '',
    tooShort: 'ab',
    invalidChars: 'user@name!',
    tooLong: 'a'.repeat(256),
  },
};

/**
 * Test data for pagination scenarios
 */
export const PAGINATION_SCENARIOS = {
  firstPage: { page: 0, rowsPerPage: 10 },
  secondPage: { page: 1, rowsPerPage: 10 },
  largePageSize: { page: 0, rowsPerPage: 100 },
  smallPageSize: { page: 0, rowsPerPage: 5 },
};

/**
 * Test data for search scenarios
 */
export const SEARCH_SCENARIOS = {
  byUsername: 'kevin',
  byEmail: 'kevin@',
  partial: 'kev',
  noResults: 'zzzznonexistent999',
};

/**
 * Test data for filter scenarios
 */
export const FILTER_SCENARIOS = {
  adminOnly: { role: 'admin' },
  editorOnly: { role: 'editor' },
  viewerOnly: { role: 'viewer' },
  activeOnly: { active: true },
  inactiveOnly: { active: false },
};

/**
 * Wait times for various scenarios (in milliseconds)
 */
export const WAIT_TIMES = {
  short: 1000,
  medium: 3000,
  long: 5000,
  apiRequest: 10000,
};

/**
 * Common test selectors
 */
export const SELECTORS = {
  // Auth
  loginForm: 'form',
  usernameInput: 'input[name="identifier"]',
  passwordInput: 'input[name="password"]',
  submitButton: 'button[type="submit"]',

  // Dashboard
  dashboardTitle: 'h1:has-text("Dashboard")',
  statCards: '[data-testid="stat-card"]',
  recentActivity: '[data-testid="recent-activity"]',

  // Users
  usersTitle: 'h1:has-text("Users")',
  createUserButton: 'button:has-text("Create User")',
  userTable: 'table',
  userRow: 'tbody tr',
  searchInput: 'input[placeholder*="Search"]',
  roleFilter: 'select[name="role"]',
  statusFilter: 'select[name="status"]',

  // Dialogs
  dialog: '[role="dialog"]',
  dialogTitle: '[role="dialog"] h2',
  dialogClose: '[role="dialog"] button:has-text("Cancel")',
  dialogConfirm: '[role="dialog"] button:has-text("Confirm")',

  // Common
  loading: '[data-testid="loading"]',
  error: '[role="alert"]',
  success: '.MuiAlert-standardSuccess',
};

/**
 * Generate random string
 *
 * @param length - Length of string to generate
 * @returns Random string
 */
export function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 *
 * @returns Random email address
 */
export function randomEmail(): string {
  return `test_${randomString(10)}@example.com`;
}

/**
 * Sleep helper for debugging
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
