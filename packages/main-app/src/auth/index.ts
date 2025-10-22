import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { query, transaction } from '../db';
import { hashPassword, verifyPassword, hashSHA256, defaultLogger } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Secure JWT_SECRET handling - require real secret in production
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'development') {
    JWT_SECRET = 'development_only_insecure_key_change_for_production';
    console.warn('WARNING: Using insecure development JWT secret. Set JWT_SECRET environment variable for production!');
  } else {
    throw new Error('JWT_SECRET environment variable is required in production. Please set a secure random string.');
  }
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

// Helper function to configure cookie options
function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge,
  };
}

// Dummy hash for timing attack prevention - valid bcrypt hash format
const DUMMY_PASSWORD_HASH = '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Helper function to extract real client IP from proxied requests
function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can be comma-separated list, take first value
    const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor;
    return ips[0].trim();
  }
  return req.ip;
}

// Generate JWT token
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

// Generate refresh token
function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}

interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body as RegisterRequest;

    // Validate input types
    if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email, username, and password must be strings',
      });
      return;
    }

    // Validate required fields
    if (!email || !username || !password) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email, username, and password are required',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format',
      });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    // Role assignment is enforced server-side; ignore any client-provided role
    const role: Role = Role.VIEWER;

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const result = await query<{ id: string; email: string; username: string; role: string }>(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role`,
      [email, username, password_hash, role]
    );

    const user = result.rows[0];

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken();

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip)
       VALUES ($1, $2, $3, $4)`,
      [user.id, hashSHA256(refreshToken), expiresAt, getClientIp(req)]
    );

    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, getCookieOptions(sevenDaysInMs));
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getCookieOptions(thirtyDaysInMs));

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: string; constraint?: string };
    if (err.code === '23505') {
      // Unique violation
      res.status(409).json({
        error: 'Conflict',
        message: err.constraint?.includes('email')
          ? 'Email already exists'
          : 'Username already exists',
      });
      return;
    }
    console.error('[Auth] Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user',
    });
  }
}));

interface LoginRequest {
  email: string;
  password: string;
}

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    // Validate input types
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password must be strings',
      });
      return;
    }

    if (!email || !password) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
      return;
    }

    // Find user
    const result = await query<{
      id: string;
      email: string;
      username: string;
      password_hash: string;
      role: string;
      is_active: boolean;
    }>('SELECT * FROM users WHERE email = $1', [email]);

    const user = result.rows.length > 0 ? result.rows[0] : null;

    // Always perform password verification to prevent timing attacks
    // Use dummy hash when user not found or inactive
    const hashToVerify = (user && user.is_active) ? user.password_hash : DUMMY_PASSWORD_HASH;
    let isValid = false;
    try {
      isValid = await verifyPassword(password, hashToVerify);
    } catch (error) {
      // If verification fails (e.g., invalid hash format), treat as invalid password
      defaultLogger.error('Password verification error', error as Error);
      isValid = false;
    }

    // Check if user exists and is active
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
      return;
    }

    // Check password validity
    if (!isValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
      return;
    }

    // Update last login
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken();

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip)
       VALUES ($1, $2, $3, $4)`,
      [user.id, hashSHA256(refreshToken), expiresAt, getClientIp(req)]
    );

    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, getCookieOptions(sevenDaysInMs));
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getCookieOptions(thirtyDaysInMs));

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to login',
    });
  }
}));


// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies as { refreshToken?: string };

    // Validate input type
    if (typeof refreshToken !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token must be a string',
      });
      return;
    }

    if (!refreshToken) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
      return;
    }

    const tokenHash = hashSHA256(refreshToken);

    // Find and validate refresh token
    const tokenResult = await query<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid refresh token',
      });
      return;
    }

    const token = tokenResult.rows[0];

    if (new Date(token.expires_at) < new Date()) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token expired',
      });
      return;
    }

    // Get user
    const userResult = await query<{
      id: string;
      email: string;
      username: string;
      role: string;
      is_active: boolean;
    }>('SELECT * FROM users WHERE id = $1', [token.user_id]);

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'User inactive or not found',
      });
      return;
    }

    const user = userResult.rows[0];

    // Revoke old token and create new one
    const result = await transaction(async (client) => {
      await client.query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [
        token.id,
      ]);

      const newRefreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip)
         VALUES ($1, $2, $3, $4)`,
        [user.id, hashSHA256(newRefreshToken), expiresAt, getClientIp(req)]
      );

      // Generate new access token
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as Role,
      };

      const accessToken = generateAccessToken(tokenPayload);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    });

    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, result.accessToken, getCookieOptions(sevenDaysInMs));
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, getCookieOptions(thirtyDaysInMs));

    res.json({
      message: 'Token refreshed',
    });
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh token',
    });
  }
}));


// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies as { refreshToken?: string };

    if (refreshToken) {
      const tokenHash = hashSHA256(refreshToken);
      await query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [
        tokenHash,
      ]);
    }

    // Clear cookies
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const };
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, cookieOptions);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieOptions);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to logout',
    });
  }
}));

// GET /api/auth/validate
router.get('/validate', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    message: 'Token is valid',
    user: req.user,
  });
});

// GET /api/users/me
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
  });
});

// Auth middleware
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  let token: string | undefined;

  // 1. Check for token in httpOnly cookie
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  // 2. Fallback to Authorization header for backward compatibility
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

export { router as authRouter, AuthenticatedRequest };
