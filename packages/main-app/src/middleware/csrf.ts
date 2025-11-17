import { Response, NextFunction } from 'express';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { AuthenticatedRequest } from '../auth';
import { config } from '@monorepo/shared';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_SECRET = process.env.CSRF_SECRET || randomBytes(32).toString('hex');

// Token expiry (1 hour)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Generates a CSRF token for the current user
 */
export function generateCSRFToken(userId: string): string {
  const timestamp = Date.now();
  const randomPart = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');

  // Create a signed token with user ID and timestamp
  const payload = `${userId}.${timestamp}.${randomPart}`;
  const signature = createHmac('sha256', CSRF_SECRET)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}

/**
 * Validates a CSRF token
 */
export function validateCSRFToken(token: string, userId: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 4) {
      return false;
    }

    const [tokenUserId, timestampStr, randomPart, signature] = parts;

    // Verify user ID matches
    if (tokenUserId !== userId) {
      return false;
    }

    // Verify timestamp is within expiry window
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_EXPIRY_MS) {
      return false;
    }

    // Verify signature using timing-safe comparison
    const payload = `${tokenUserId}.${timestampStr}.${randomPart}`;
    const expectedSignature = createHmac('sha256', CSRF_SECRET)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    return false;
  }
}

/**
 * CSRF protection middleware for state-changing operations
 */
export function csrfProtection(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Skip CSRF check for GET requests (should be idempotent)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  // Ensure user is authenticated
  if (!req.user?.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Get CSRF token from header or body
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const token = req.headers[CSRF_HEADER_NAME] as string ||
                req.body?.csrfToken as string;

  if (!token) {
    res.status(403).json({
      error: 'CSRF token missing',
      message: 'This request requires a CSRF token for security'
    });
    return;
  }

  // Validate the token
  if (!validateCSRFToken(token, req.user.userId)) {
    res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'The CSRF token is invalid or expired'
    });
    return;
  }

  next();
}

/**
 * Middleware to generate and attach CSRF token to response
 */
export function attachCSRFToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.userId) {
    const token = generateCSRFToken(req.user.userId);

    // Set token in both cookie and response header
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_EXPIRY_MS
    });

    res.setHeader('X-CSRF-Token', token);
  }

  next();
}

/**
 * Get CSRF token endpoint for clients to retrieve a fresh token
 */
export function getCSRFToken(req: AuthenticatedRequest, res: Response): void {
  if (!req.user?.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = generateCSRFToken(req.user.userId);

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY_MS
  });

  res.json({ csrfToken: token });
}
