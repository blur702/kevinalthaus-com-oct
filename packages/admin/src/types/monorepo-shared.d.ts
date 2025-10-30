declare module '@monorepo/shared' {
  // Re-export Role enum from built declarations
  export { Role } from '../../../shared/dist/security/rbac';

  // Re-export selected types for admin usage
  export type { User } from '../../../shared/src/types';
}

