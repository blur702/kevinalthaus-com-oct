/**
 * User Helper Utilities
 *
 * Helper functions for working with different user type representations
 */

import type { User } from '../types';
import type { UserContext, TokenPayload } from '../services/interfaces';

/**
 * Get user ID from any user type (User, UserContext, or TokenPayload)
 */
export function getUserId(user: User | UserContext | TokenPayload | null | undefined): string | null {
  if (!user) {
    return null;
  }

  // TokenPayload has userId
  if ('userId' in user && typeof user.userId === 'string') {
    return user.userId;
  }

  // User and UserContext have id
  if ('id' in user && typeof user.id === 'string') {
    return user.id;
  }

  return null;
}

/**
 * Check if user object has a specific field
 */
export function isUserType(user: unknown): user is User | UserContext | TokenPayload {
  if (!user || typeof user !== 'object') {
    return false;
  }

  return (
    ('id' in user && typeof (user as Record<string, unknown>).id === 'string') ||
    ('userId' in user && typeof (user as Record<string, unknown>).userId === 'string')
  );
}
