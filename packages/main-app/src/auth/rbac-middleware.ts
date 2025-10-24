import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './index';
import { Role, Capability, hasCapability, createPermissionContext } from '@monorepo/shared';

function ensureAuthenticated(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return null;
  }
  return req.user;
}

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = ensureAuthenticated(req, res);
    if (!user) {
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

export function requireCapability(...capabilities: Capability[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = ensureAuthenticated(req, res);
    if (!user) {
      return;
    }

    const context = createPermissionContext(user.userId, user.role);

    const hasAllCapabilities = capabilities.every((cap) => hasCapability(context, cap));

    if (!hasAllCapabilities) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        requiredCapabilities: capabilities,
      });
      return;
    }

    next();
  };
}
