import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Async handler wrapper to properly handle async route handlers
 * Catches rejected promises and forwards them to Express error middleware
 */
export function asyncHandler<T = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void | Response>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}
