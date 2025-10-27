import '../types/express';
import { Request, Response, NextFunction } from 'express';
import { generateOrExtractRequestId } from '../utils/logger';

// Note: Express Request.id property is augmented via side-effect import above

/**
 * Express middleware for request ID management
 *
 * Unified implementation used by both api-gateway and main-app.
 * Extracts or generates a request ID and attaches it to the request and response.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers['x-request-id'];
  let existingId: string | undefined;

  // Handle array case (multiple headers with same name)
  if (Array.isArray(headerValue) && headerValue.length > 0) {
    existingId = headerValue[0];
  } else if (typeof headerValue === 'string') {
    existingId = headerValue;
  } else {
    existingId = undefined;
  }

  const requestId = generateOrExtractRequestId(existingId);
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
