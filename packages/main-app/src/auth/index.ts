import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { query, transaction, type PoolClient } from '../db';
import { hashPassword, verifyPassword, hashSHA256, defaultLogger, validateEmail } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Validates password strength
 * Requires: at least 8 characters, one uppercase, one lowercase, one digit, one special character
 */
function isValidPassword(password: string): boolean {
  if (password.length < 8) {
    return false;
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar;
}

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
    console.warn('To persist tokens between restarts, set JWT_SECRET in .env:');
    console.warn('  Generate a secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.warn('  Then add: JWT_SECRET=<generated-secret>');
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

// Password reset configuration
const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = (() => {
  const envValue = process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES;
  if (!envValue) {
    return 30; // Default: 30 minutes
  }
  const parsed = parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1440) {
    console.warn(`Invalid PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: ${envValue}. Using default: 30 minutes. Must be between 1 and 1440.`);
    return 30;
  }
  return parsed;
})();

// Password history configuration
const PASSWORD_HISTORY_LIMIT = (() => {
  const envValue = process.env.PASSWORD_HISTORY_LIMIT;
  if (!envValue) {
    return 3; // Default: 3 passwords
  }
  const parsed = parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) {
    console.warn(`Invalid PASSWORD_HISTORY_LIMIT: ${envValue}. Using default: 3. Must be between 1 and 10.`);
    return 3;
  }
  return parsed;
})();

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

// Helper function for clearing cookies (no maxAge parameter)
function getCookieClearOptions(): { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'strict' | 'none' } {
  const isSecureRequired = COOKIE_SAMESITE === 'none' || process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isSecureRequired,
    sameSite: COOKIE_SAMESITE,
  };
}

// Parse a duration string like "15m", "30s", "2h", "1d" to milliseconds
function parseDurationToMs(input: string, fallbackMs: number): number {
  const trimmed = String(input).trim();
  const match = trimmed.match(/^\s*(\d+)\s*([smhdSMHD]?)\s*$/);
  if (!match) {
    return fallbackMs;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return fallbackMs;
  }
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

// Generate password reset token (returns both plain token and its hash)
function generatePasswordResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex'); // 64 character hex string (256 bits of entropy)
  const hash = hashSHA256(token);
  return { token, hash };
}

// Simulate email sending (for development/testing - replace with real SMTP in production)
function simulateEmailSending(to: string, subject: string, body: string): void {
  const logger = defaultLogger.child('EmailSimulation');

  logger.info('===== EMAIL SIMULATION =====');
  logger.info('Email would be sent via SMTP in production', {
    recipient: to,
    subject,
    body,
    timestamp: new Date().toISOString(),
  });
  logger.info('===== END EMAIL SIMULATION =====');
}

// Check if password exists in user's recent password history
async function checkPasswordHistory(userId: string, newPassword: string): Promise<boolean> {
  try {
    // Get last N password hashes for the user (configured via PASSWORD_HISTORY_LIMIT)
    const result = await query<{ password_hash: string }>(
      'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, PASSWORD_HISTORY_LIMIT]
    );

    // Check if new password matches any historical password
    // Always perform verification against every entry to prevent timing oracle attacks
    let foundMatch = false;
    for (const row of result.rows) {
      const matches = await verifyPassword(newPassword, row.password_hash);
      if (matches) {
        foundMatch = true;
        // Do not return early - continue checking all entries for constant-time behavior
      }
    }

    return foundMatch; // Password found in history if true (should be rejected)
  } catch (error) {
    // Log error and fail closed for security (reject password if history check fails)
    defaultLogger.error('Password history check failed', error as Error);
    return true; // Reject password change if history check fails (fail closed)
  }
}

// Add password to history and maintain configured limit
// Accepts a transaction client to be used within an existing transaction
async function addPasswordToHistory(userId: string, passwordHash: string, client: PoolClient): Promise<void> {
  // Insert new password hash
  await client.query(
    'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
    [userId, passwordHash]
  );

  // Clean up old history entries (keep only N most recent)
  await client.query(
    `DELETE FROM password_history
     WHERE user_id = $1
     AND id NOT IN (
       SELECT id FROM password_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2
     )`,
    [userId, PASSWORD_HISTORY_LIMIT]
  );
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
      if (!isValidPassword(password)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
        });
        return;
      }

      // Check for existing username (case-insensitive)
      // Query uses functional index on LOWER(username) for consistent timing
      const existingUser = await query<{ id: string; username: string }>(
        'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );

      // Check if username exists
      // Note: The earlier DB query with LOWER(username) already leaks existence via timing,
      // so we use simple deterministic comparison: normalize both usernames and check equality
      let usernameExists = false;
      try {
        if (existingUser.rows.length > 0) {
          const storedUsername = existingUser.rows[0].username.toLowerCase().trim();
          const providedUsername = username.toLowerCase().trim();
          usernameExists = storedUsername === providedUsername;
        }
      } catch {
        // On error, conservatively assume exists for security
        usernameExists = true;
      }

      if (usernameExists) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Username already exists',
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
        // Unique violation - log details internally but return generic message
        console.error('[Auth] Registration conflict:', {
          constraint: err.constraint,
          timestamp: new Date().toISOString(),
        });
        res.status(409).json({
          error: 'Conflict',
          message: 'User already exists',
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
  username: string;
  password: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // Guard against undefined/invalid req.body to avoid destructuring errors
      const { username, password } = (req.body || {}) as Partial<LoginRequest>;

      // Validate input types
      if (typeof username !== 'string' || typeof password !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Username and password must be strings',
        });
        return;
      }

      // Trim username to avoid accidental whitespace-caused failures
      // Case policy: logins are case-insensitive. Username lookups use LOWER()
      // and a functional index on LOWER(username) exists for performance.
      const normalizedUsername = username.trim();

      if (!normalizedUsername || !password) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Username and password are required',
        });
        return;
      }

      // Find user by username or email
      const result = await query<{
        id: string;
        email: string;
        username: string;
        password_hash: string;
        role: string;
        is_active: boolean;
      }>('SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)', [normalizedUsername]);

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

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as Role,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken();

      // Store refresh token and update last_login in a transaction
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
      const userAgent = req.get('User-Agent') || 'Unknown';

      await transaction(async (client) => {
        // Store refresh token with context binding (user agent, IP) for security
        await client.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
          [user.id, hashSHA256(refreshToken), expiresAt, getClientIp(req), userAgent]
        );

        // Update last login only after successful token storage
        await client.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
      });

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
      const accessMaxAgeMs = parseDurationToMs(JWT_EXPIRES_IN, 15 * 60 * 1000);
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

      // Clear cookies using consistent options (without maxAge)
      res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, getCookieClearOptions());
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getCookieClearOptions());

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

// POST /api/auth/forgot-password
// Rate limiting recommendation: 3 requests per 15 minutes per IP address
// CSRF protection: Consider requiring CSRF token for state-changing operations
router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email } = req.body as ForgotPasswordRequest;

      // Validate input type
      if (typeof email !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email must be a string',
        });
        return;
      }

      // Validate required field
      if (!email) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email is required',
        });
        return;
      }

      // Validate email format using shared validation function
      if (!validateEmail(email)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid email format',
        });
        return;
      }

      // Query user by email (case-insensitive)
      const userResult = await query<{ id: string; email: string; username: string; is_active: boolean }>(
        'SELECT id, email, username, is_active FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      // Always return success to prevent email enumeration
      // If user exists and is active, send password reset email
      if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
        const user = userResult.rows[0];

        // Generate password reset token
        const { token, hash } = generatePasswordResetToken();

        // Set expiration time based on configured value
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        // Revoke any existing unused reset tokens for this user
        await query(
          'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
          [user.id]
        );

        // Store token hash in database
        await query(
          'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_by_ip) VALUES ($1, $2, $3, $4)',
          [user.id, hash, expiresAt, getClientIp(req)]
        );

        // Construct reset URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

        // Simulate email sending (replace with real SMTP in production)
        const emailBody = `
Hello ${user.username},

You have requested to reset your password. Please click the link below to reset your password:

${resetUrl}

This link will expire in 30 minutes.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Security Notice: Never share this link with anyone. If you suspect unauthorized access to your account, please contact support immediately.

Best regards,
The Team
        `.trim();

        simulateEmailSending(user.email, 'Password Reset Request', emailBody);
      }

      // Always return success message regardless of whether email exists
      res.status(200).json({
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    } catch (error) {
      // Log error internally but return generic success message to prevent information leakage
      console.error('[Auth] Forgot password error:', error);
      res.status(200).json({
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    }
  })
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body as ResetPasswordRequest;

      // Validate input types
      if (typeof token !== 'string' || typeof newPassword !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Token and new password must be strings',
        });
        return;
      }

      // Validate required fields
      if (!token || !newPassword) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Token and new password are required',
        });
        return;
      }

      // Validate password strength
      if (!isValidPassword(newPassword)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
        });
        return;
      }

      // Hash token to look up in database
      const tokenHash = hashSHA256(token);

      // Find and validate reset token
      const tokenResult = await query<{
        id: string;
        user_id: string;
        expires_at: Date;
        used_at: Date | null;
      }>(
        'SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL',
        [tokenHash]
      );

      // Validate token exists, is not expired, and has not been used
      if (tokenResult.rows.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid or expired reset token',
        });
        return;
      }

      const resetToken = tokenResult.rows[0];

      // Check if token is expired
      if (new Date(resetToken.expires_at) < new Date()) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid or expired reset token',
        });
        return;
      }

      // Get user and verify they are active
      const userResult = await query<{ id: string; password_hash: string; is_active: boolean }>(
        'SELECT id, password_hash, is_active FROM users WHERE id = $1',
        [resetToken.user_id]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid or expired reset token',
        });
        return;
      }

      const user = userResult.rows[0];

      // Check if new password is the same as current password
      const isSameAsCurrent = await verifyPassword(newPassword, user.password_hash);
      if (isSameAsCurrent) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'New password must be different from current password',
        });
        return;
      }

      // Check password history
      const passwordInHistory = await checkPasswordHistory(user.id, newPassword);
      if (passwordInHistory) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Password has been used recently. Please choose a different password',
        });
        return;
      }

      // Use transaction to atomically update password, add to history, mark token as used, and revoke refresh tokens
      await transaction(async (client) => {
        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update user password
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newPasswordHash, user.id]
        );

        // Add old password to history using helper function
        await addPasswordToHistory(user.id, user.password_hash, client);

        // Mark reset token as used (conditional update to prevent race condition)
        const tokenUpdateResult = await client.query(
          'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1 AND used_at IS NULL',
          [resetToken.id]
        );

        // Verify token was successfully marked as used (prevents concurrent usage)
        if (tokenUpdateResult.rowCount === 0) {
          throw new Error('Token has already been used');
        }

        // Revoke all existing refresh tokens for security
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
          [user.id]
        );
      });

      res.status(200).json({
        message: 'Password has been reset successfully. Please login with your new password',
      });
    } catch (error) {
      console.error('[Auth] Reset password error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to reset password',
      });
    }
  })
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body as ChangePasswordRequest;

      // Validate input types
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Current password and new password must be strings',
        });
        return;
      }

      // Validate required fields
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Current password and new password are required',
        });
        return;
      }

      // Validate new password is different from current password
      if (currentPassword === newPassword) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'New password must be different from current password',
        });
        return;
      }

      // Validate new password strength
      if (!isValidPassword(newPassword)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
        });
        return;
      }

      // Get user from database
      const userResult = await query<{ id: string; password_hash: string }>(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [req.user!.userId]
      );

      if (userResult.rows.length === 0) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
        });
        return;
      }

      const user = userResult.rows[0];

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Current password is incorrect',
        });
        return;
      }

      // Check password history
      const passwordInHistory = await checkPasswordHistory(user.id, newPassword);
      if (passwordInHistory) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Password has been used recently. Please choose a different password',
        });
        return;
      }

      // Use transaction to atomically update password and add to history
      await transaction(async (client) => {
        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update user password
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newPasswordHash, user.id]
        );

        // Add old password to history using helper function
        await addPasswordToHistory(user.id, user.password_hash, client);

        // Optionally revoke all other refresh tokens except current session
        // For now, we'll keep user logged in on current device
      });

      res.status(200).json({
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('[Auth] Change password error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to change password',
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

// GET /api/auth/me
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
  });
});

// Auth middleware
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Set no-cache headers for all authenticated pages
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
    return;
  }
}

export { router as authRouter, AuthenticatedRequest };
