import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { query, transaction } from '../db';
import { hashPassword, verifyPassword, hashSHA256 } from '@monorepo/shared';
import { Role } from '@monorepo/shared';

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

interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Generate JWT token
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

// Generate refresh token
function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, username, password, role = 'viewer' } = req.body;

    // Validate input
    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email, username, and password are required',
      });
    }

    // Validate role
    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid role',
      });
    }

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
      [user.id, hashSHA256(refreshToken), expiresAt, req.ip]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error: unknown) {
    const err = error as { code?: string; constraint?: string };
    if (err.code === '23505') {
      // Unique violation
      return res.status(409).json({
        error: 'Conflict',
        message: err.constraint?.includes('email')
          ? 'Email already exists'
          : 'Username already exists',
      });
    }
    console.error('[Auth] Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
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

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account is inactive',
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
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
      [user.id, hashSHA256(refreshToken), expiresAt, req.ip]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to login',
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    const tokenHash = hashSHA256(refreshToken);

    // Find and validate refresh token
    const result = await query<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid refresh token',
      });
    }

    const token = result.rows[0];

    if (new Date(token.expires_at) < new Date()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token expired',
      });
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User inactive or not found',
      });
    }

    const user = userResult.rows[0];

    // Revoke old token and create new one
    await transaction(async (client) => {
      await client.query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [
        token.id,
      ]);

      const newRefreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip)
         VALUES ($1, $2, $3, $4)`,
        [user.id, hashSHA256(newRefreshToken), expiresAt, req.ip]
      );

      // Generate new access token
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as Role,
      };

      const accessToken = generateAccessToken(tokenPayload);

      res.json({
        message: 'Token refreshed',
        accessToken,
        refreshToken: newRefreshToken,
      });
    });
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh token',
    });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const tokenHash = hashSHA256(refreshToken);
      await query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [
        tokenHash,
      ]);
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to logout',
    });
  }
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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided',
    });
    return;
  }

  const token = authHeader.substring(7);

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
