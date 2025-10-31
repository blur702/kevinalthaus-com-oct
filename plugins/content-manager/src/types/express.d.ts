// Augment Express Request interface to include request ID and user
declare global {
  namespace Express {
    interface Request {
      id: string;
      // User is optional - undefined when not authenticated
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export {};
