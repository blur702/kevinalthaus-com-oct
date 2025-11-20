// Augment Express Request interface to include request ID and user
import type { User } from './base';
import type { UserContext, TokenPayload } from '../services/interfaces';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: User | UserContext | TokenPayload | null;
    }
  }
}

export {};
