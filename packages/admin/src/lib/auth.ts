// Authentication utility using httpOnly cookies for secure token storage
// Tokens are stored server-side in httpOnly cookies to prevent XSS attacks

import { User, Role } from '@monorepo/shared';

// TypeScript interfaces matching backend response structure
export interface AuthResponse {
  user: User;
  message?: string;
}

// Re-export shared types for convenience
export type { User, Role };

/**
 * NOT USED - Tokens are managed via httpOnly cookies
 * This is a no-op for backwards compatibility
 * @deprecated Use cookie-based authentication instead
 */
export function setTokens(_accessToken: string, _refreshToken: string): void {
  // Tokens are now stored in httpOnly cookies set by the server
  // This function is kept for backwards compatibility but does nothing
  console.warn('setTokens is deprecated. Tokens are now managed via httpOnly cookies.');
}

/**
 * NOT USED - Access tokens are in httpOnly cookies
 * @deprecated Tokens are stored in httpOnly cookies
 */
export function getAccessToken(): string | null {
  console.warn('getAccessToken is deprecated. Tokens are managed via httpOnly cookies.');
  return null;
}

/**
 * NOT USED - Refresh tokens are in httpOnly cookies
 * @deprecated Tokens are stored in httpOnly cookies
 */
export function getRefreshToken(): string | null {
  console.warn('getRefreshToken is deprecated. Tokens are managed via httpOnly cookies.');
  return null;
}

/**
 * Clear authentication by calling the server logout endpoint
 * Server will clear the httpOnly cookies
 * @returns true if logout succeeded, false otherwise
 */
export async function clearTokens(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include', // Send cookies
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Logout failed:', {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Logout failed:', error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if user is authenticated by validating the access token from cookies
 * Since cookies are httpOnly, we make a request to a validation endpoint
 */
export async function isAuthenticated(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch('/api/auth/validate', {
      method: 'GET',
      credentials: 'include', // Send cookies
      signal: controller.signal,
    });
    return response.ok;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
