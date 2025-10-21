import { Request, Response, NextFunction } from 'express';
import { generateOrExtractRequestId } from '@monorepo/shared';

// Note: Express Request.id property is defined in @monorepo/shared/types/express.d.ts

// Express middleware for request ID management
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers['x-request-id'];
  const existingId = typeof headerValue === 'string' ? headerValue : undefined;
  const requestId = generateOrExtractRequestId(existingId);
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}