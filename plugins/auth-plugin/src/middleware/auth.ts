/// <reference path="../types/express.d.ts" />

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import type { User } from '@monorepo/shared';

/**
 * Middleware to verify JWT token from Authorization header
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    // Cast decoded token to User type (note: doesn't have all User fields)
    req.user = decoded as unknown as User;
    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(403).json({ error: 'Invalid or expired token' });
    }
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if token is missing
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = verifyToken(token);
    // Cast decoded token to User type (note: doesn't have all User fields)
    req.user = decoded as unknown as User;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  next();
}
