/**
 * Custom test helpers and matchers for Playwright tests
 */

import { expect, Page } from '@playwright/test';

/**
 * Login as admin user for testing
 */
export async function adminLogin(page: Page): Promise<void> {
  const adminUsername = process.env.TEST_ADMIN_USERNAME || 'kevin';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'test-password-changeme';

  await page.goto('http://localhost:3003/login');
  await page.waitForLoadState('domcontentloaded');

  // Wait for login form to be visible (looking for Username field)
  await page.getByLabel(/username/i).waitFor({ state: 'visible', timeout: 10000 });

  // Fill in login form
  await page.getByLabel(/username/i).fill(adminUsername);
  await page.getByLabel(/password/i).fill(adminPassword);

  // Click login button
  await page.getByRole('button', { name: /login|sign in/i }).click();

  // Wait for redirect to dashboard (accepts /, /dashboard, /home, or /settings)
  await page.waitForURL((url) => {
    const pathname = new URL(url).pathname;
    return pathname === '/' || pathname === '/dashboard' || pathname === '/home' || pathname === '/settings';
  }, { timeout: 10000 });
}

/**
 * Check if a value is one of the provided options
 */
export function expectToBeOneOf<T>(received: T, options: T[]): void {
  const passed = options.includes(received);
  if (!passed) {
    throw new Error(
      `Expected value to be one of: [${options.join(', ')}]\n` +
      `Received: ${received}`
    );
  }
}

/**
 * Assert that a value is one of the allowed options
 */
export function assertOneOf<T>(received: T, options: T[], message?: string): void {
  if (!options.includes(received)) {
    throw new Error(
      message ||
      `Expected value to be one of: [${options.join(', ')}], but received: ${received}`
    );
  }
}

/**
 * Check if response status is one of the expected codes
 */
export function expectStatusToBeOneOf(status: number, allowedCodes: number[]): void {
  expect(allowedCodes).toContain(status);
}

// Extend expect with toBeOneOf matcher for convenience in specs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.extend({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toBeOneOf(received: any, expected: any[]) {
    const pass = Array.isArray(expected) && expected.indexOf(received) !== -1;
    return {
      pass,
      message: () =>
        pass
          ? 'Expected ' + String(received) + ' not to be one of [' + expected.join(', ') + ']'
          : 'Expected ' + String(received) + ' to be one of [' + expected.join(', ') + ']',
    };
  },
});

// Type augmentation for custom matcher (best-effort)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PlaywrightTest {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Matchers<R> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toBeOneOf(expected: any[]): R;
    }
  }
}
