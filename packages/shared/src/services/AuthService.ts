/**
 * Auth Service Implementation
 *
 * Provides authentication and authorization as a service that can be used by plugins
 * and the main application. Wraps JWT token management, password validation,
 * and RBAC checks.
 *
 * NOTE: This is the service interface. The actual implementation with database
 * access is in packages/main-app/src/services/AuthServiceImpl.ts
 */

import type { Request, Response, NextFunction } from 'express';
import type {
  IAuthService,
  AuthResult,
  LoginResult,
  TokenPair,
  TokenPayload,
  UserContext,
} from './interfaces';
import { Role, Capability, hasCapability } from '../security/rbac';

/**
 * Base Auth Service (abstract class)
 *
 * This defines the service contract. The concrete implementation
 * is in main-app which has access to the database.
 */
export abstract class AuthService implements IAuthService {
  public readonly name = 'auth';

  // Abstract methods that must be implemented by concrete class
  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract healthCheck(): Promise<{ healthy: boolean; message?: string }>;

  abstract register(data: {
    email: string;
    username: string;
    password: string;
    role?: Role;
  }): Promise<AuthResult>;

  abstract login(data: {
    identifier: string;
    password: string;
    userAgent?: string;
  }): Promise<LoginResult>;

  abstract logout(refreshToken: string): Promise<void>;

  abstract validateToken(token: string): Promise<TokenPayload>;

  abstract refreshTokens(data: {
    refreshToken: string;
    userAgent?: string;
  }): Promise<TokenPair>;

  abstract forgotPassword(email: string): Promise<{ resetToken: string }>;

  abstract resetPassword(data: { token: string; newPassword: string }): Promise<void>;

  abstract changePassword(data: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void>;

  // Implemented helper methods
  async getCurrentUser(req: Request): Promise<UserContext | null> {
    // Check for user in request (set by auth middleware)
    if (req.user) {
      return req.user as UserContext;
    }

    // Try to extract and validate token from cookie or header
    const token = this.extractToken(req);
    if (!token) {
      return null;
    }

    try {
      const payload = await this.validateToken(token);
      return this.payloadToUserContext(payload);
    } catch {
      return null;
    }
  }

  hasRole(user: UserContext, role: Role): boolean {
    // Admin has all roles
    if (user.role === Role.ADMIN) {
      return true;
    }
    return user.role === role;
  }

  hasCapability(user: UserContext, capability: Capability): boolean {
    // Convert UserContext to PermissionContext for RBAC check
    const permissionContext = {
      userId: user.id,
      role: user.role,
      capabilities: user.capabilities,
    };
    return hasCapability(permissionContext, capability);
  }

  /**
   * Express middleware for authentication
   * Validates JWT token and attaches user to request
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const payload = await this.validateToken(token);
        req.user = this.payloadToUserContext(payload);

        next();
      } catch (error) {
        res.status(401).json({
          error: 'Invalid or expired token',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };
  }

  /**
   * Express middleware for role-based authorization
   */
  requireRole(role: Role): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await this.getCurrentUser(req);

        if (!user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        if (!this.hasRole(user, role)) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: role,
            current: user.role,
          });
          return;
        }

        next();
      } catch (error) {
        res.status(500).json({
          error: 'Authorization check failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };
  }

  /**
   * Express middleware for capability-based authorization
   */
  requireCapability(
    capability: Capability
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await this.getCurrentUser(req);

        if (!user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        if (!this.hasCapability(user, capability)) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: capability,
            available: user.capabilities,
          });
          return;
        }

        next();
      } catch (error) {
        res.status(500).json({
          error: 'Authorization check failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    };
  }

  // Helper methods
  protected extractToken(req: Request): string | null {
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

  protected payloadToUserContext(payload: TokenPayload): UserContext {
    // This will be enhanced by the concrete implementation to fetch capabilities
    return {
      id: payload.userId,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      capabilities: [],  // Will be populated by impl
    };
  }
}
