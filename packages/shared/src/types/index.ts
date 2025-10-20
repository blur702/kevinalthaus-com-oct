import { Role } from '../security/rbac';

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseEntity {
  email: string;
  username: string;
  role: Role;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };
