// Augment Express Request interface to include request ID and user
import type { User } from './index';
import type { UserContext } from '../services/interfaces';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: User | UserContext | null;
    }
  }
}

export {};
