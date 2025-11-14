import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth';
import { createLogger, LogLevel } from '@monorepo/shared';

const logger = createLogger({
  level: LogLevel.INFO,
  service: 'rate-limiter',
  format: 'json'
});

// Store for rate limit tracking
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blockedUntil?: number;
}

// In-memory store (consider Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.blockedUntil && entry.blockedUntil < now) {
      rateLimitStore.delete(key);
    } else if (now - entry.firstRequest > 3600000) { // 1 hour
      rateLimitStore.delete(key);
    }
  }
}, 300000); // 5 minutes

export interface RateLimitOptions {
  windowMs?: number;      // Time window in milliseconds
  max?: number;           // Max requests per window
  message?: string;        // Error message
  skipFailedRequests?: boolean; // Skip failed requests
  skipSuccessfulRequests?: boolean; // Skip successful requests
  keyGenerator?: (req: Request | AuthenticatedRequest) => string; // Custom key generator
  handler?: (req: Request, res: Response) => void; // Custom handler
  skip?: (req: Request) => boolean; // Skip function
  blockDuration?: number;  // Block duration in ms after limit exceeded
  enableBruteForceProtection?: boolean; // Progressive delays for repeated violations
}

/**
 * Default key generator - uses user ID for authenticated requests, IP for anonymous
 */
function defaultKeyGenerator(req: Request | AuthenticatedRequest): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }

  // Fall back to IP address
  const ip = req.ip ||
             req.headers['x-forwarded-for'] as string ||
             req.socket.remoteAddress ||
             'unknown';

  return `ip:${ip}`;
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000, // 1 minute default
    max = 100,        // 100 requests per window default
    message = 'Too many requests, please try again later',
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    keyGenerator = defaultKeyGenerator,
    handler,
    skip,
    blockDuration = windowMs * 2, // Block for 2x window duration by default
    enableBruteForceProtection = false
  } = options;

  return (req: Request | AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Check if should skip
    if (skip && skip(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    // Check if currently blocked
    if (entry?.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);

      logger.warn('Rate limit blocked request', {
        key,
        blockedUntil: new Date(entry.blockedUntil).toISOString(),
        retryAfter
      });

      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', new Date(entry.blockedUntil).toISOString());

      if (handler) {
        handler(req, res);
      } else {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          retryAfter
        });
      }
      return;
    }

    if (!entry || now - entry.firstRequest > windowMs) {
      // Create new window
      entry = {
        count: 0,
        firstRequest: now
      };
      rateLimitStore.set(key, entry);
    }

    // Increment counter
    entry.count++;

    // Calculate remaining requests
    const remaining = Math.max(0, max - entry.count);
    const resetTime = new Date(entry.firstRequest + windowMs);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', resetTime.toISOString());

    // Check if limit exceeded
    if (entry.count > max) {
      // Calculate block duration with progressive increase for brute force protection
      let actualBlockDuration = blockDuration;

      if (enableBruteForceProtection) {
        // Progressive blocking: double the duration for each violation
        const violations = Math.floor(entry.count / max);
        actualBlockDuration = blockDuration * Math.min(Math.pow(2, violations - 1), 32); // Cap at 32x
      }

      entry.blockedUntil = now + actualBlockDuration;
      const retryAfter = Math.ceil(actualBlockDuration / 1000);

      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        max,
        windowMs,
        blockedFor: actualBlockDuration,
        retryAfter
      });

      res.set('Retry-After', String(retryAfter));

      if (handler) {
        handler(req, res);
      } else {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          retryAfter
        });
      }
      return;
    }

    // Track response status for conditional counting
    if (skipFailedRequests || skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(data: unknown): Response {
        // Decrement counter based on response status
        if (entry && res.statusCode >= 400 && skipFailedRequests) {
          entry.count--;
        } else if (entry && res.statusCode < 400 && skipSuccessfulRequests) {
          entry.count--;
        }
        return originalSend.call(this, data);
      };
    }

    next();
  };
}

/**
 * Strict rate limit for authentication endpoints
 */
const isAuthRateLimitDisabled = (): boolean => {
  return process.env.DISABLE_AUTH_RATE_LIMIT === 'true' ||
    process.env.E2E_TESTING === 'true' ||
    process.env.RATE_LIMIT_BYPASS_E2E === 'true' ||
    process.env.NODE_ENV === 'test';
};

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isAuthRateLimitDisabled() ? 10000 : 5, // 5 requests per 15 minutes (unless disabled)
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true, // Only count failed attempts
  enableBruteForceProtection: true,
  blockDuration: 30 * 60 * 1000, // 30 minutes block
  skip: () => isAuthRateLimitDisabled(),
});

/**
 * Rate limit for API endpoints
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'API rate limit exceeded'
});

/**
 * Strict rate limit for settings modification
 */
export const settingsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 settings changes per minute
  message: 'Too many settings modifications, please try again later',
  keyGenerator: (req: Request | AuthenticatedRequest) => {
    // Always use user ID for settings (must be authenticated)
    const authReq = req as AuthenticatedRequest;
    return `settings:${authReq.user?.userId || 'unknown'}`;
  }
});

/**
 * Rate limit for email operations
 */
export const emailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 emails per hour
  message: 'Email rate limit exceeded, please try again later'
});

/**
 * Rate limit for API key creation
 */
export const apiKeyCreationRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 API keys per day
  message: 'API key creation limit exceeded, please try again tomorrow',
  keyGenerator: (req: Request | AuthenticatedRequest) => {
    const authReq = req as AuthenticatedRequest;
    return `apikey:${authReq.user?.userId || 'unknown'}`;
  }
});

/**
 * Rate limit for password reset requests
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per 15 minutes
  message: 'Too many password reset requests, please try again later',
  enableBruteForceProtection: true,
  keyGenerator: (req: Request) => {
    // Use email or IP for password reset
    const email = req.body?.email as unknown;
    if (typeof email === 'string' && email) {
      return `reset:${email}`;
    }
    return defaultKeyGenerator(req);
  }
});
