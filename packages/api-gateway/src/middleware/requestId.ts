import { Request, Response, NextFunction } from 'express';
import { generateOrExtractRequestId } from '@monorepo/shared';

// Express middleware for request ID management
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'] as string | undefined;
  const requestId = generateOrExtractRequestId(existingId);
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}