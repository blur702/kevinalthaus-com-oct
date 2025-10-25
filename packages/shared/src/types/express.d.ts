// Augment Express Request interface to include request ID and user
import type { User } from './index';

declare namespace Express {
  interface Request {
    id: string;
    user?: User | null;
  }
}
