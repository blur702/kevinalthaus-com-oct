/**
 * Custom test helpers and matchers for Playwright tests
 */

import { expect } from '@playwright/test';

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
