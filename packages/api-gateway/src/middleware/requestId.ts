import { Request, Response, NextFunction } from 'express';
import { generateOrExtractRequestId } from '@monorepo/shared';

// Express middleware for request ID management
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['x-request-id'];
  let existingId: string | undefined;

  if (Array.isArray(header)) {
    existingId = header[0];
  } else if (typeof header === 'string') {
    existingId = header;
  } else {
    existingId = undefined;
  }

  const requestId = generateOrExtractRequestId(existingId);
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}