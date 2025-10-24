// Augment Express Request interface locally to include request ID
declare namespace Express {
  interface Request {
    id: string;
  }
}

