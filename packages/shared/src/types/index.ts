import { Role } from '../security/rbac';

// Express type augmentations - import to ensure they're loaded
import './express-types';

// Re-export Role for convenience
export { Role };
export type { Role as RoleType };
export type { AppConfig } from './appConfig';

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseEntity {
  email: string;
  username: string;
  role: Role;
  // Optional alias for compatibility with TokenPayload
  userId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };
