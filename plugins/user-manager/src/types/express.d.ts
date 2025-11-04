// Augment Express Request interface to include user
import type { User } from '@monorepo/shared';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: User | null;
    }
  }
}

export {};
