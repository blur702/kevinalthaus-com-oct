// User management types for admin panel

import { Role } from '@monorepo/shared';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  customFields?: Record<string, unknown>;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  details?: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: Role;
  active?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  role?: Role;
  active?: boolean;
  customFields?: Record<string, unknown>;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  active?: boolean;
  sortBy?: 'username' | 'email' | 'role' | 'createdAt' | 'lastLogin';
  sortOrder?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BulkImportRequest {
  users: CreateUserRequest[];
}

export interface BulkImportResponse {
  success: number;
  failed: number;
  errors: Array<{
    index: number;
    error: string;
  }>;
}

export interface BulkExportFormat {
  format: 'csv' | 'json';
  userIds?: string[];
}

export type UserFormMode = 'create' | 'edit';
