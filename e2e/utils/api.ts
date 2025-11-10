import { Page, APIRequestContext } from '@playwright/test';

/**
 * API helper utilities for E2E tests
 *
 * These helpers allow tests to interact with the API directly
 * for setup/teardown operations without going through the UI.
 */

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Make an authenticated API request
 *
 * @param page - Playwright page object (for cookies)
 * @param method - HTTP method
 * @param path - API endpoint path
 * @param data - Request body data
 * @returns API response
 */
export async function apiRequest<T = unknown>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  const baseURL = process.env.BASE_URL || 'http://localhost:3003';
  const url = `${baseURL}${path}`;

  const response = await page.request.fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    data: data ? JSON.stringify(data) : undefined,
  });

  let responseData: unknown;
  try {
    responseData = await response.json();
  } catch (error) {
    const rawText = await response.text();
    console.error(
      `Failed to parse JSON response from ${method} ${url}:`,
      `Status: ${response.status()}, Raw response: ${rawText.substring(0, 500)}`
    );
    throw new Error(`Invalid JSON response from ${method} ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    status: response.status(),
    data: responseData as T,
    headers: response.headers(),
  };
}

/**
 * Create a user via API
 *
 * @param page - Playwright page object
 * @param userData - User data to create
 * @returns Created user data
 */
export async function createUserViaApi(
  page: Page,
  userData: {
    username: string;
    email: string;
    password: string;
    role?: string;
    active?: boolean;
  }
): Promise<unknown> {
  const response = await apiRequest(page, 'POST', '/api/users', userData);

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Failed to create user: ${response.status}`);
  }

  return response.data;
}

/**
 * Delete a user via API
 *
 * @param page - Playwright page object
 * @param userId - User ID to delete
 */
export async function deleteUserViaApi(page: Page, userId: string): Promise<void> {
  const response = await apiRequest(page, 'DELETE', `/api/users/${userId}`);

  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`Failed to delete user: ${response.status}`);
  }
}

/**
 * Get user by ID via API
 *
 * @param page - Playwright page object
 * @param userId - User ID
 * @returns User data
 */
export async function getUserViaApi(page: Page, userId: string): Promise<unknown> {
  const response = await apiRequest(page, 'GET', `/api/users/${userId}`);

  if (response.status !== 200) {
    throw new Error(`Failed to get user: ${response.status}`);
  }

  return response.data;
}

/**
 * List users via API
 *
 * @param page - Playwright page object
 * @param params - Query parameters
 * @returns Users list response
 */
export async function listUsersViaApi(
  page: Page,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    active?: boolean;
  }
): Promise<{ users: unknown[]; total: number }> {
  const queryParams = new URLSearchParams();

  if (params) {
    if (params.page !== undefined) {queryParams.set('page', String(params.page));}
    if (params.limit !== undefined) {queryParams.set('limit', String(params.limit));}
    if (params.search) {queryParams.set('search', params.search);}
    if (params.role) {queryParams.set('role', params.role);}
    if (params.active !== undefined) {queryParams.set('active', String(params.active));}
  }

  const queryString = queryParams.toString();
  const path = `/api/users${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{ users: unknown[]; total: number }>(page, 'GET', path);

  if (response.status !== 200) {
    throw new Error(`Failed to list users: ${response.status}`);
  }

  return response.data;
}

/**
 * Update user via API
 *
 * @param page - Playwright page object
 * @param userId - User ID to update
 * @param updates - User data to update
 * @returns Updated user data
 */
export async function updateUserViaApi(
  page: Page,
  userId: string,
  updates: {
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    active?: boolean;
  }
): Promise<unknown> {
  const response = await apiRequest(page, 'PATCH', `/api/users/${userId}`, updates);

  if (response.status !== 200) {
    throw new Error(`Failed to update user: ${response.status}`);
  }

  return response.data;
}

/**
 * Bulk delete users via API
 *
 * @param page - Playwright page object
 * @param userIds - Array of user IDs to delete
 */
export async function bulkDeleteUsersViaApi(page: Page, userIds: string[]): Promise<void> {
  const response = await apiRequest(page, 'POST', '/api/users/bulk-delete', { userIds });

  if (response.status !== 200) {
    throw new Error(`Failed to bulk delete users: ${response.status}`);
  }
}

/**
 * Get dashboard stats via API
 *
 * @param page - Playwright page object
 * @returns Dashboard statistics
 */
export async function getDashboardStatsViaApi(page: Page): Promise<unknown> {
  const response = await apiRequest(page, 'GET', '/api/dashboard/stats');

  if (response.status !== 200) {
    throw new Error(`Failed to get dashboard stats: ${response.status}`);
  }

  return response.data;
}

/**
 * Wait for API response matching a pattern
 *
 * @param page - Playwright page object
 * @param urlPattern - URL pattern to match
 * @param timeout - Timeout in milliseconds
 * @returns Response object
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
): Promise<unknown> {
  return page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Intercept and mock API response
 *
 * @param page - Playwright page object
 * @param urlPattern - URL pattern to intercept
 * @param mockData - Mock response data
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  mockData: unknown,
  status = 200
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(mockData),
    });
  });
}

/**
 * Check if API endpoint is accessible
 *
 * @param page - Playwright page object
 * @param path - API endpoint path
 * @returns True if accessible
 */
export async function isApiAccessible(page: Page, path: string): Promise<boolean> {
  try {
    const response = await apiRequest(page, 'GET', path);
    return response.status < 500;
  } catch {
    return false;
  }
}
