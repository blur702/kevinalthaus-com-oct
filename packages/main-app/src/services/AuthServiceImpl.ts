/**
 * Auth Service Implementation
 *
 * Concrete implementation of AuthService with database access.
 * Handles user registration, login, JWT token management, and password operations.
 */

import { AuthService } from '@monorepo/shared';
import type {
  AuthResult,
  LoginResult,
  TokenPair,
  TokenPayload,
  UserContext,
  IDatabaseService,
} from '@monorepo/shared';
import { Role, getCapabilitiesForRole } from '@monorepo/shared';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  role: Role;
  created_at: Date;
  updated_at: Date;
}

interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  expires_at: Date;
  created_at: Date;
}

/**
 * Concrete Auth Service Implementation
 */
export class AuthServiceImpl extends AuthService {
  private jwtSecret: string;
  private accessTokenExpiry = '15m';

  constructor(
    private dbService: IDatabaseService,
    jwtSecret: string
  ) {
    super();
    this.jwtSecret = jwtSecret;
  }

  async initialize(): Promise<void> {
    // Verify JWT secret is set
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET is required for AuthService');
    }
    console.log('[AuthService] ✓ Initialized');
  }

  async shutdown(): Promise<void> {
    console.log('[AuthService] ✓ Shut down');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    // Check if we can query the users table
    try {
      const knex = this.dbService.getKnex();
      await knex('users').count('* as count').first();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Auth service health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async register(data: {
    email: string;
    username: string;
    password: string;
    role?: Role;
  }): Promise<AuthResult> {
    const knex = this.dbService.getKnex();

    // Check if user already exists
    const existingUser = await knex('users')
      .where({ email: data.email })
      .orWhere({ username: data.username })
      .first();

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const [user] = (await knex('users')
      .insert({
        email: data.email,
        username: data.username,
        password_hash: passwordHash,
        role: data.role || Role.VIEWER,
      })
      .returning('*')) as User[];

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };
  }

  async login(data: {
    identifier: string;
    password: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const knex = this.dbService.getKnex();

    // Find user by email or username
    const user = await knex('users')
      .where({ email: data.identifier })
      .orWhere({ username: data.identifier })
      .first() as User;

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user, data.userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      tokens,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const knex = this.dbService.getKnex();
    const tokenHash = this.hashToken(refreshToken);

    await knex('refresh_tokens').where({ token_hash: tokenHash }).delete();
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async refreshTokens(data: {
    refreshToken: string;
    userAgent?: string;
  }): Promise<TokenPair> {
    const knex = this.dbService.getKnex();
    const tokenHash = this.hashToken(data.refreshToken);

    // Find refresh token
    const storedToken = (await knex('refresh_tokens')
      .where({ token_hash: tokenHash })
      .where('expires_at', '>', knex.fn.now())
      .first()) as RefreshToken;

    if (!storedToken) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get user
    const user = await knex('users')
      .where({ id: storedToken.user_id })
      .first() as User;

    if (!user) {
      throw new Error('User not found');
    }

    // Delete old refresh token
    await knex('refresh_tokens').where({ id: storedToken.id }).delete();

    // Generate new token pair
    return this.generateTokenPair(user, data.userAgent);
  }

  async forgotPassword(email: string): Promise<{ resetToken: string }> {
    const knex = this.dbService.getKnex();

    // Check if user exists
    const user = await knex('users').where({ email }).first() as User;
    if (!user) {
      // Don't reveal if user exists for security
      throw new Error('If an account exists with this email, a reset link will be sent');
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (you may want a separate password_reset_tokens table)
    await knex('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return { resetToken };
  }

  async resetPassword(data: { token: string; newPassword: string }): Promise<void> {
    const knex = this.dbService.getKnex();
    const tokenHash = this.hashToken(data.token);

    // Find valid reset token
    const resetToken = (await knex('password_reset_tokens')
      .where({ token_hash: tokenHash })
      .where('expires_at', '>', knex.fn.now())
      .first()) as { user_id: string };

    if (!resetToken) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(data.newPassword, 10);

    // Update user password
    await knex('users').where({ id: resetToken.user_id }).update({
      password_hash: passwordHash,
      updated_at: knex.fn.now(),
    });

    // Delete used reset token
    await knex('password_reset_tokens').where({ token_hash: tokenHash }).delete();
  }

  async changePassword(data: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const knex = this.dbService.getKnex();

    // Get user
    const user = await knex('users').where({ id: data.userId }).first() as User;
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(data.newPassword, 10);

    // Update password
    await knex('users').where({ id: data.userId }).update({
      password_hash: passwordHash,
      updated_at: knex.fn.now(),
    });
  }

  // Helper methods

  private async generateTokenPair(user: User, userAgent?: string): Promise<TokenPair> {
    const knex = this.dbService.getKnex();

    // Generate access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry } as jwt.SignOptions
    );

    // Generate refresh token
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store refresh token
    await knex('refresh_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      user_agent: userAgent || null,
      expires_at: expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  protected payloadToUserContext(payload: TokenPayload): UserContext {
    return {
      id: payload.userId,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      capabilities: getCapabilitiesForRole(payload.role),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: payload.userId,
    };
  }
}
