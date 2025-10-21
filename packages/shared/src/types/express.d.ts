// Augment Express Request interface to include request ID
declare namespace Express {
  interface Request {
    id: string;
  }
}