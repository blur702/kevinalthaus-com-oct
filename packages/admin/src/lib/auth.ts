// Token storage utility for managing authentication tokens in localStorage

const AUTH_ACCESS_TOKEN = 'auth_access_token';
const AUTH_REFRESH_TOKEN = 'auth_refresh_token';

// TypeScript interfaces matching backend response structure
export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

/**
 * Store authentication tokens in localStorage
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(AUTH_ACCESS_TOKEN, accessToken);
  localStorage.setItem(AUTH_REFRESH_TOKEN, refreshToken);
}

/**
 * Retrieve the access token from localStorage
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_ACCESS_TOKEN);
}

/**
 * Retrieve the refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(AUTH_REFRESH_TOKEN);
}

/**
 * Remove all authentication tokens from localStorage (on logout)
 */
export function clearTokens(): void {
  localStorage.removeItem(AUTH_ACCESS_TOKEN);
  localStorage.removeItem(AUTH_REFRESH_TOKEN);
}

/**
 * Check if user is authenticated by verifying valid tokens exist
 */
export function isAuthenticated(): boolean {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  return !!(accessToken && refreshToken);
}
