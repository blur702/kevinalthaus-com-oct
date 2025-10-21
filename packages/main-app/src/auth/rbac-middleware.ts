import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './index';
import { Role, Capability, hasCapability, createPermissionContext } from '@monorepo/shared';

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
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
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const context = createPermissionContext(req.user.userId, req.user.role);

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
