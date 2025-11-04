/**
 * Route Protection Decorators
 *
 * TypeScript decorators for protecting Express routes with authentication and authorization.
 * Makes it easy for plugins to protect routes with one line.
 *
 * Usage:
 *   @RequireAuth()
 *   async myRoute(req, res) { ... }
 *
 *   @RequireRole(Role.ADMIN)
 *   async adminRoute(req, res) { ... }
 *
 *   @RequireCapability(Capability.CONTENT_EDIT)
 *   async editRoute(req, res) { ... }
 */

import 'reflect-metadata';
import type { Request, Response, NextFunction } from 'express';
import type { Role, Capability } from '../security/rbac';
import { getServiceContainer } from './ServiceContainer';
import type { IAuthService } from './interfaces';

// Metadata keys for storing decorator information
const AUTH_METADATA_KEY = Symbol('auth:required');
const ROLE_METADATA_KEY = Symbol('auth:role');
const CAPABILITY_METADATA_KEY = Symbol('auth:capability');

/**
 * Decorator: Require authentication for this route
 *
 * Validates JWT token and attaches user to request.
 * Returns 401 if not authenticated.
 *
 * @example
 * ```typescript
 * @RequireAuth()
 * async createPost(req: Request, res: Response) {
 *   const user = req.user; // User is guaranteed to exist
 *   // ... create post
 * }
 * ```
 */
export function RequireAuth(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // Mark method as requiring auth
    Reflect.defineMetadata(AUTH_METADATA_KEY, true, target, propertyKey);

    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: unknown,
      req: Request,
      res: Response,
      next?: NextFunction
    ): Promise<void> {
      try {
        const container = getServiceContainer();
        const authService = container.get<IAuthService>('auth');

        // Extract token from request
        const token = extractToken(req);
        if (!token) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        // Validate token and attach user to request
        const payload = await authService.validateToken(token);
        req.user = {
          id: payload.userId,
          email: payload.email,
          username: payload.username,
          role: payload.role,
          capabilities: [], // Will be populated by service
        };

        // Call original method
        return await originalMethod.call(this, req, res, next);
      } catch (error) {
        res.status(401).json({
          error: 'Invalid or expired token',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };

    return descriptor;
  };
}

/**
 * Decorator: Require specific role for this route
 *
 * Checks that the authenticated user has the required role.
 * Also requires authentication (no need to add @RequireAuth).
 * Returns 401 if not authenticated, 403 if wrong role.
 *
 * @param role - Required role (ADMIN, EDITOR, VIEWER, GUEST)
 *
 * @example
 * ```typescript
 * @RequireRole(Role.ADMIN)
 * async deleteUser(req: Request, res: Response) {
 *   // Only admins can reach here
 * }
 * ```
 */
export function RequireRole(role: Role): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // Mark method with required role
    Reflect.defineMetadata(ROLE_METADATA_KEY, role, target, propertyKey);

    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: unknown,
      req: Request,
      res: Response,
      next?: NextFunction
    ): Promise<void> {
      try {
        const container = getServiceContainer();
        const authService = container.get<IAuthService>('auth');

        // Get user (also validates authentication)
        const user = await authService.getCurrentUser(req);
        if (!user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        // Check role
        if (!authService.hasRole(user, role)) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: role,
            current: user.role,
          });
          return;
        }

        // Attach user to request for method access
        req.user = user;

        // Call original method
        return await originalMethod.call(this, req, res, next);
      } catch (error) {
        res.status(500).json({
          error: 'Authorization check failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };

    return descriptor;
  };
}

/**
 * Decorator: Require specific capability for this route
 *
 * Checks that the authenticated user has the required capability.
 * Also requires authentication (no need to add @RequireAuth).
 * Returns 401 if not authenticated, 403 if missing capability.
 *
 * @param capability - Required capability
 *
 * @example
 * ```typescript
 * @RequireCapability(Capability.CONTENT_EDIT)
 * async updatePost(req: Request, res: Response) {
 *   // Only users with CONTENT_EDIT capability can reach here
 * }
 * ```
 */
export function RequireCapability(capability: Capability): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // Mark method with required capability
    Reflect.defineMetadata(CAPABILITY_METADATA_KEY, capability, target, propertyKey);

    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: unknown,
      req: Request,
      res: Response,
      next?: NextFunction
    ): Promise<void> {
      try {
        const container = getServiceContainer();
        const authService = container.get<IAuthService>('auth');

        // Get user (also validates authentication)
        const user = await authService.getCurrentUser(req);
        if (!user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        // Check capability
        if (!authService.hasCapability(user, capability)) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: capability,
            available: user.capabilities,
          });
          return;
        }

        // Attach user to request for method access
        req.user = user;

        // Call original method
        return await originalMethod.call(this, req, res, next);
      } catch (error) {
        res.status(500).json({
          error: 'Authorization check failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };

    return descriptor;
  };
}

/**
 * Decorator: Allow multiple roles (OR logic)
 *
 * User must have at least one of the specified roles.
 *
 * @param roles - Array of allowed roles
 *
 * @example
 * ```typescript
 * @RequireAnyRole([Role.ADMIN, Role.EDITOR])
 * async publishPost(req: Request, res: Response) {
 *   // Admins and editors can reach here
 * }
 * ```
 */
export function RequireAnyRole(roles: Role[]): MethodDecorator {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: unknown,
      req: Request,
      res: Response,
      next?: NextFunction
    ): Promise<void> {
      try {
        const container = getServiceContainer();
        const authService = container.get<IAuthService>('auth');

        const user = await authService.getCurrentUser(req);
        if (!user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const hasAnyRole = roles.some((role) => authService.hasRole(user, role));
        if (!hasAnyRole) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: `One of: ${roles.join(', ')}`,
            current: user.role,
          });
          return;
        }

        req.user = user;
        return await originalMethod.call(this, req, res, next);
      } catch (error) {
        res.status(500).json({
          error: 'Authorization check failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };

    return descriptor;
  };
}

/**
 * Decorator: Allow multiple capabilities (OR logic)
 *
 * User must have at least one of the specified capabilities.
 *
 * @param capabilities - Array of allowed capabilities
 */
export function RequireAnyCapability(capabilities: Capability[]): MethodDecorator {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: unknown,
      req: Request,
      res: Response,
      next?: NextFunction
    ): Promise<void> {
      try {
        const container = getServiceContainer();
        const authService = container.get<IAuthService>('auth');

        const user = await authService.getCurrentUser(req);
        if (!user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const hasAnyCapability = capabilities.some((cap) => authService.hasCapability(user, cap));
        if (!hasAnyCapability) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: `One of: ${capabilities.join(', ')}`,
            available: user.capabilities,
          });
          return;
        }

        req.user = user;
        return await originalMethod.call(this, req, res, next);
      } catch (error) {
        res.status(500).json({
          error: 'Authorization check failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };

    return descriptor;
  };
}

// Helper function to extract token from request
function extractToken(req: Request): string | null {
  // Try cookie first
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  // Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Helper: Get metadata from decorated method
 * Useful for debugging or logging
 */
export function getAuthMetadata(
  target: object,
  propertyKey: string | symbol
): {
  requiresAuth: boolean;
  requiredRole?: Role;
  requiredCapability?: Capability;
} {
  return {
    requiresAuth: Reflect.getMetadata(AUTH_METADATA_KEY, target, propertyKey) || false,
    requiredRole: Reflect.getMetadata(ROLE_METADATA_KEY, target, propertyKey),
    requiredCapability: Reflect.getMetadata(CAPABILITY_METADATA_KEY, target, propertyKey),
  };
}
