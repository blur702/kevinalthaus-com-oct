import jwt from 'jsonwebtoken';

// Validate JWT_SECRET at module initialization
function validateJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isDev = process.env.NODE_ENV === 'development';
  const knownInsecureSecrets = ['dev-secret-key-change-in-production', 'secret', 'test', 'password'];

  // Fail fast if secret is missing or empty
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. ' +
      'Set a secure JWT_SECRET before starting the application.'
    );
  }

  // Fail fast if using a known insecure default (even in development)
  if (knownInsecureSecrets.includes(secret.toLowerCase())) {
    throw new Error(
      `CRITICAL SECURITY ERROR: JWT_SECRET is set to a known insecure value "${secret}". ` +
      'Generate a secure secret using: openssl rand -base64 64'
    );
  }

  // Warn if secret is too short (minimum 32 characters recommended)
  if (secret.length < 32) {
    const message = `WARNING: JWT_SECRET is only ${secret.length} characters long. ` +
      'Recommended minimum is 32 characters for security.';

    if (isDev) {
      console.warn(message);
    } else {
      throw new Error(`CRITICAL SECURITY ERROR: ${message}`);
    }
  }

  // Check for character diversity (should have mixed case and special characters)
  const hasUpperCase = /[A-Z]/.test(secret);
  const hasLowerCase = /[a-z]/.test(secret);
  const hasNumber = /[0-9]/.test(secret);
  const hasSpecial = /[^A-Za-z0-9]/.test(secret);

  if (!isDev && (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial)) {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET must contain a mix of uppercase, lowercase, ' +
      'numbers, and special characters in production. Generate a secure secret using: openssl rand -base64 64'
    );
  }

  return secret;
}

const JWT_SECRET = validateJWTSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface DecodedToken extends JWTPayload {
  iat: number;
  exp: number;
}

/**
 * Generate an access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): DecodedToken {
  try {
    return jwt.verify(token, JWT_SECRET) as DecodedToken;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Get the expiration date for a refresh token
 */
export function getRefreshTokenExpiration(): Date {
  const ms = parseExpiration(REFRESH_TOKEN_EXPIRES_IN);
  return new Date(Date.now() + ms);
}

/**
 * Parse time string to milliseconds
 */
function parseExpiration(exp: string): number {
  const unit = exp.slice(-1);
  const value = parseInt(exp.slice(0, -1), 10);

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
      return 15 * 60 * 1000; // Default 15 minutes
  }
}
