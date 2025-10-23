import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { query, transaction } from '../db';
import { hashPassword, verifyPassword, hashSHA256, defaultLogger } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Secure JWT_SECRET handling - require real secret in production, generate random in development
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Generate a random secret for development to avoid using a static default
    JWT_SECRET = randomBytes(32).toString('hex');
    console.warn('');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('⚠️  WARNING: JWT_SECRET not set - using random ephemeral secret');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('This is acceptable for development but has implications:');
    console.warn('  - All JWT tokens become invalid on server restart');
    console.warn('  - Users must re-login after each restart');
    console.warn('  - Not suitable for any production or staging environment');
    console.warn('');
    console.warn('For persistent development sessions, set JWT_SECRET in .env:');
    console.warn('  JWT_SECRET=' + JWT_SECRET);
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('');
  } else {
    throw new Error(
      'JWT_SECRET environment variable is required in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
}
// Short-lived access token (default 15 minutes) to reduce risk window
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

// Parse COOKIE_SAMESITE from environment (lax|strict|none, default: lax for better compatibility)
type SameSiteValue = 'lax' | 'strict' | 'none';
const COOKIE_SAMESITE: SameSiteValue = (process.env.COOKIE_SAMESITE as SameSiteValue) || 'lax';

// Validate sameSite value
if (!['lax', 'strict', 'none'].includes(COOKIE_SAMESITE)) {
  throw new Error(
    `Invalid COOKIE_SAMESITE value: ${process.env.COOKIE_SAMESITE}. Must be one of: lax, strict, none`
  );
}

// Helper function to configure cookie options
// secure: true is required when sameSite=none per spec, or when running in production behind HTTPS
function getCookieOptions(
  maxAge: number
): { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'strict' | 'none'; maxAge: number } {
  const isSecureRequired = COOKIE_SAMESITE === 'none' || process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isSecureRequired,
    sameSite: COOKIE_SAMESITE,
    maxAge,
  };
}

// Parse a duration string like "15m", "30s", "2h", "1d" to milliseconds
function parseDurationToMs(input: string, fallbackMs: number): number {
  const trimmed = String(input).trim();
  const match = trimmed.match(/^\s*(\d+)\s*([smhdSMHD]?)\s*$/);
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return fallbackMs;
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      // No unit provided, assume seconds
      return value * 1000;
  }
}

// Dummy hash for timing attack prevention - valid bcrypt hash of 'dummy-password'
const DUMMY_PASSWORD_HASH = '$2b$10$rLsUhbUd.4I7BaZ1uNLZWu3dkcUPfVM.orLNsF3ykAD9zYMehtFue';

interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Helper function to extract real client IP from proxied requests
// Note: Only use X-Forwarded-For when Express trust proxy is configured
// Otherwise, fall back to req.ip to prevent IP spoofing
function getClientIp(req: Request): string | undefined {
  // req.ip respects the trust proxy setting and handles X-Forwarded-For safely
  // when trust proxy is configured, otherwise returns direct connection IP
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
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email, username, password } = req.body as RegisterRequest;

      // Validate input types
      if (
        typeof email !== 'string' ||
        typeof username !== 'string' ||
        typeof password !== 'string'
      ) {
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

      // Store refresh token with context binding (user agent, IP) for security
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
      const userAgent = req.get('User-Agent') || 'Unknown';

      await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
        [user.id, hashSHA256(refreshToken), expiresAt, getClientIp(req), userAgent]
      );

      const accessMaxAgeMs = parseDurationToMs(JWT_EXPIRES_IN, 15 * 60 * 1000);
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, getCookieOptions(accessMaxAgeMs));
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
  })
);

interface LoginRequest {
  email: string;
  password: string;
}

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
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
      const hashToVerify = user && user.is_active ? user.password_hash : DUMMY_PASSWORD_HASH;
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

      // Store refresh token with context binding (user agent, IP) for security
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
      const userAgent = req.get('User-Agent') || 'Unknown';

      await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
        [user.id, hashSHA256(refreshToken), expiresAt, getClientIp(req), userAgent]
      );

      const accessMaxAgeMs = parseDurationToMs(JWT_EXPIRES_IN, 15 * 60 * 1000);
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, getCookieOptions(accessMaxAgeMs));
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
  })
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
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
        user_agent: string | null;
      }>('SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);

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

      // Validate user agent to detect token theft
      const currentUserAgent = req.get('User-Agent') || 'Unknown';
      if (token.user_agent && token.user_agent !== currentUserAgent) {
        // User agent mismatch - potential token theft
        defaultLogger.warn('Refresh token user agent mismatch - potential theft detected', {
          userId: token.user_id,
          storedAgent: token.user_agent,
          currentAgent: currentUserAgent,
        });
        // Revoke the suspicious token immediately
        await query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [
          token.id,
        ]);
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Token validation failed',
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
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1',
          [token.id]
        );

        const newRefreshToken = generateRefreshToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

        // Store new refresh token with same user agent (already validated above)
        await client.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
          [user.id, hashSHA256(newRefreshToken), expiresAt, getClientIp(req), currentUserAgent]
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

      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      const accessMaxAgeMs = parseDurationToMs(JWT_EXPIRES_IN, 15 * 60 * 1000)
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, result.accessToken, getCookieOptions(accessMaxAgeMs));
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
  })
);

// POST /api/auth/logout
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.cookies as { refreshToken?: string };

      if (refreshToken) {
        const tokenHash = hashSHA256(refreshToken);
        await query(
          'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
          [tokenHash]
        );
      }

      // Clear cookies using consistent options
      res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, getCookieOptions(0));
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getCookieOptions(0));

      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to logout',
      });
    }
  })
);

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
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check for token in httpOnly cookie
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken as string;
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

