import { Role } from '../security/rbac';

// Express type augmentations - import to ensure they're loaded
import './express-types';

// Re-export base types
export type { BaseEntity, User, ApiResponse, Result } from './base';

// Re-export Role for convenience
export { Role };
export type { Role as RoleType };
export type { AppConfig } from './appConfig';
