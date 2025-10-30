declare module '@monorepo/shared' {
  // Re-export Role and Capability enums from source
  export { Role, Capability } from '../../../shared/src/security/rbac-types';

  // Re-export selected types for admin usage
  export type { User } from '../../../shared/src/types';
}

