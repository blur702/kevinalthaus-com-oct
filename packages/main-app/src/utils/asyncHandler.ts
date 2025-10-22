import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler<T extends RequestHandler>(fn: (req: Parameters<T>[0], res: Parameters<T>[1], next: Parameters<T>[2]) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

