// User management API service layer

import api from '../lib/api';
import type {
  User,
  UserActivity,
  CreateUserRequest,
  UpdateUserRequest,
  UserListParams,
  UserListResponse,
  BulkImportRequest,
  BulkImportResponse,
} from '../types/user';
import { asArray, asNumber } from '../lib/dataNormalization';

const BASE_URL = '/users-manager';

/**
 * Fetch paginated list of users with filters
 */
export async function listUsers(params?: UserListParams): Promise<UserListResponse> {
  const response = await api.get<UserListResponse>(BASE_URL, { params });
  return {
    users: asArray<User>(response.data.users, { feature: 'UsersService', field: 'users' }),
    total: asNumber(response.data.total, 0, { feature: 'UsersService', field: 'total' }),
  };
}

/**
 * Get single user by ID
 */
export async function getUser(userId: string): Promise<User> {
  const response = await api.get<User>(`${BASE_URL}/${encodeURIComponent(userId)}`);
  return response.data;
}

/**
 * Create new user
 */
export async function createUser(data: CreateUserRequest): Promise<User> {
  const response = await api.post<User>(BASE_URL, data);
  return response.data;
}

/**
 * Update existing user
 */
export async function updateUser(userId: string, data: UpdateUserRequest): Promise<User> {
  const response = await api.patch<User>(`${BASE_URL}/${encodeURIComponent(userId)}`, data);
  return response.data;
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`${BASE_URL}/${encodeURIComponent(userId)}`);
}

/**
 * Get user activity log
 */
export async function getUserActivity(
  userId: string,
  limit = 50
): Promise<{ activities: UserActivity[] }> {
  const response = await api.get<{ activities: UserActivity[] }>(
    `${BASE_URL}/${encodeURIComponent(userId)}/activity`,
    {
      params: { limit },
    }
  );
  return {
    activities: asArray<UserActivity>(response.data.activities, { feature: 'UsersService', field: 'activities' }),
  };
}

/**
 * Get custom fields for a user
 */
export async function getCustomFields(
  userId: string
): Promise<{ customFields: Record<string, unknown> }> {
  const response = await api.get<{ customFields: Record<string, unknown> }>(
    `${BASE_URL}/${encodeURIComponent(userId)}/custom-fields`
  );
  return response.data;
}

/**
 * Update custom fields for a user
 */
export async function updateCustomFields(
  userId: string,
  customFields: Record<string, unknown>
): Promise<{ customFields: Record<string, unknown> }> {
  const response = await api.patch<{ customFields: Record<string, unknown> }>(
    `${BASE_URL}/${encodeURIComponent(userId)}/custom-fields`,
    { customFields }
  );
  return response.data;
}

/**
 * Bulk import users from array
 */
export async function bulkImport(data: BulkImportRequest): Promise<BulkImportResponse> {
  const response = await api.post<BulkImportResponse>(`${BASE_URL}/bulk/import`, data);
  return response.data;
}

/**
 * Bulk export users to CSV or JSON
 */
export async function bulkExport(
  format: 'csv' | 'json',
  userIds?: string[]
): Promise<Blob> {
  const response = await api.post(
    `${BASE_URL}/bulk/export`,
    { format, userIds },
    {
      responseType: 'blob',
    }
  );
  return response.data as Blob;
}

/**
 * Delete multiple users
 */
export async function bulkDelete(userIds: string[]): Promise<{ deleted: number }> {
  const response = await api.post<{ deleted: number }>(`${BASE_URL}/bulk/delete`, { userIds });
  return response.data;
}
