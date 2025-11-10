/**
 * Redis-based Rate Limiter
 *
 * Provides distributed rate limiting using Redis for multi-instance deployments.
 * Uses sliding window algorithm for accurate rate limiting.
 *
 * Features:
 * - Distributed rate limiting across multiple servers
 * - Sliding window algorithm for smooth rate limiting
 * - Progressive blocking for brute force protection
 * - Automatic fallback to in-memory if Redis unavailable
 * - Compatible with existing rate limiter interface
 */

import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { AuthenticatedRequest } from '../auth';
import { createLogger, LogLevel } from '@monorepo/shared';

const logger = createLogger({
  level: LogLevel.INFO,
  service: 'redis-rate-limiter',
  format: 'json'
});

// Redis client instance
let redisClient: Redis | null = null;
let redisAvailable = false;

// In-memory fallback store
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blockedUntil?: number;
}

const fallbackStore = new Map<string, RateLimitEntry>();

// Clean up old fallback entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fallbackStore.entries()) {
    if (entry.blockedUntil && entry.blockedUntil < now) {
      fallbackStore.delete(key);
    } else if (now - entry.firstRequest > 3600000) { // 1 hour
      fallbackStore.delete(key);
    }
  }
}, 300000); // 5 minutes

/**
 * Initialize Redis client for rate limiting
 */
export function initializeRedisRateLimiter(): void {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        // Exponential backoff with max 5 seconds
        const delay = Math.min(times * 100, 5000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT'];
        return targetErrors.some(targetError => err.message.includes(targetError));
      },
      // Disable offline queue to fail fast if Redis is down
      enableOfflineQueue: false,
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
      logger.info('Redis rate limiter connected');
    });

    redisClient.on('error', (error: Error) => {
      redisAvailable = false;
      logger.error('Redis rate limiter error', error);
    });

    redisClient.on('close', () => {
      redisAvailable = false;
      logger.warn('Redis rate limiter connection closed');
    });

  } catch (error) {
    logger.error('Failed to initialize Redis rate limiter', error as Error);
    redisAvailable = false;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient !== null;
}

/**
 * Get Redis client (for testing or manual operations)
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisRateLimiter(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisAvailable = false;
    logger.info('Redis rate limiter connection closed');
  }
}

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
 * Redis-based rate limiting implementation using sliding window
 */
async function checkRateLimitRedis(
  key: string,
  windowMs: number,
  max: number,
  blockDuration: number,
  enableBruteForceProtection: boolean
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}> {
  if (!redisClient || !redisAvailable) {
    throw new Error('Redis not available');
  }

  const now = Date.now();
  const windowStart = now - windowMs;

  // Use Redis sorted set for sliding window
  const rateLimitKey = `ratelimit:${key}`;
  const blockKey = `ratelimit:block:${key}`;

  try {
    // Check if currently blocked
    const blockedUntil = await redisClient.get(blockKey);
    if (blockedUntil) {
      const blockedUntilTime = parseInt(blockedUntil, 10);
      if (blockedUntilTime > now) {
        const retryAfter = Math.ceil((blockedUntilTime - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetTime: new Date(blockedUntilTime),
          retryAfter,
        };
      } else {
        // Block expired, remove it
        await redisClient.del(blockKey);
      }
    }

    // Remove old entries from sorted set
    await redisClient.zremrangebyscore(rateLimitKey, 0, windowStart);

    // Count current requests in window
    const count = await redisClient.zcard(rateLimitKey);

    // Calculate reset time
    const resetTime = new Date(now + windowMs);

    // Check if limit exceeded
    if (count >= max) {
      // Calculate block duration
      let actualBlockDuration = blockDuration;

      if (enableBruteForceProtection) {
        // Progressive blocking: get violation count
        const violations = Math.floor(count / max);
        actualBlockDuration = blockDuration * Math.min(Math.pow(2, violations - 1), 32); // Cap at 32x
      }

      const blockedUntilTime = now + actualBlockDuration;
      const retryAfter = Math.ceil(actualBlockDuration / 1000);

      // Set block with TTL
      await redisClient.setex(
        blockKey,
        Math.ceil(actualBlockDuration / 1000),
        blockedUntilTime.toString()
      );

      logger.warn('Redis rate limit exceeded', {
        key,
        count,
        max,
        windowMs,
        blockedFor: actualBlockDuration,
        retryAfter,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(blockedUntilTime),
        retryAfter,
      };
    }

    // Add current request to sorted set with timestamp as score
    const requestId = `${now}:${Math.random()}`;
    await redisClient.zadd(rateLimitKey, now, requestId);

    // Set TTL on the sorted set (cleanup)
    await redisClient.expire(rateLimitKey, Math.ceil(windowMs / 1000) + 60);

    return {
      allowed: true,
      remaining: Math.max(0, max - count - 1),
      resetTime,
    };

  } catch (error) {
    logger.error(`Redis rate limit check failed for key: ${key}`, error as Error);
    throw error;
  }
}

/**
 * In-memory fallback rate limiting (same as original implementation)
 */
function checkRateLimitMemory(
  key: string,
  windowMs: number,
  max: number,
  blockDuration: number,
  enableBruteForceProtection: boolean
): {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
} {
  const now = Date.now();

  // Get or create rate limit entry
  let entry = fallbackStore.get(key);

  // Check if currently blocked
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(entry.blockedUntil),
      retryAfter,
    };
  }

  if (!entry || now - entry.firstRequest > windowMs) {
    // Create new window
    entry = {
      count: 0,
      firstRequest: now,
    };
    fallbackStore.set(key, entry);
  }

  // Increment counter
  entry.count++;

  // Calculate remaining requests
  const remaining = Math.max(0, max - entry.count);
  const resetTime = new Date(entry.firstRequest + windowMs);

  // Check if limit exceeded
  if (entry.count > max) {
    // Calculate block duration with progressive increase
    let actualBlockDuration = blockDuration;

    if (enableBruteForceProtection) {
      const violations = Math.floor(entry.count / max);
      actualBlockDuration = blockDuration * Math.min(Math.pow(2, violations - 1), 32);
    }

    entry.blockedUntil = now + actualBlockDuration;
    const retryAfter = Math.ceil(actualBlockDuration / 1000);

    logger.warn('Memory fallback rate limit exceeded', {
      key,
      count: entry.count,
      max,
      windowMs,
      blockedFor: actualBlockDuration,
      retryAfter,
    });

    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(entry.blockedUntil),
      retryAfter,
    };
  }

  return {
    allowed: true,
    remaining,
    resetTime,
  };
}

/**
 * Rate limiting middleware factory (Redis-based with fallback)
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
    blockDuration = windowMs * 2,
    enableBruteForceProtection = false,
  } = options;

  return async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Check if should skip
    if (skip && skip(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);

    try {
      // Try Redis first, fall back to memory if unavailable
      let result;

      if (isRedisAvailable()) {
        result = await checkRateLimitRedis(
          key,
          windowMs,
          max,
          blockDuration,
          enableBruteForceProtection
        );
      } else {
        logger.warn('Redis unavailable, using in-memory fallback for rate limiting');
        result = checkRateLimitMemory(
          key,
          windowMs,
          max,
          blockDuration,
          enableBruteForceProtection
        );
      }

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(result.remaining));
      res.set('X-RateLimit-Reset', result.resetTime.toISOString());

      if (!result.allowed) {
        if (result.retryAfter) {
          res.set('Retry-After', String(result.retryAfter));
        }

        logger.warn('Rate limit blocked request', {
          key,
          resetTime: result.resetTime.toISOString(),
          retryAfter: result.retryAfter,
        });

        if (handler) {
          handler(req, res);
        } else {
          res.status(429).json({
            error: 'Rate limit exceeded',
            message,
            retryAfter: result.retryAfter,
          });
        }
        return;
      }

      // Track response status for conditional counting
      if (skipFailedRequests || skipSuccessfulRequests) {
        const originalSend = res.send;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.send = function(data: any): Response {
          // TODO: Implement decrement logic for Redis
          // For now, this only works with memory fallback
          if (!isRedisAvailable()) {
            const entry = fallbackStore.get(key);
            if (entry) {
              if (res.statusCode >= 400 && skipFailedRequests) {
                entry.count--;
              } else if (res.statusCode < 400 && skipSuccessfulRequests) {
                entry.count--;
              }
            }
          }
          return originalSend.call(this, data);
        };
      }

      next();

    } catch (error) {
      logger.error(`Rate limit check failed for key: ${key}, allowing request`, error as Error);
      // On error, allow the request to proceed (fail open)
      next();
    }
  };
}

/**
 * Predefined rate limiters
 */

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.E2E_TESTING === 'true' || process.env.NODE_ENV === 'test' ? 10000 : 5,
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true,
  enableBruteForceProtection: false, // Disable for E2E testing
  blockDuration: 30 * 60 * 1000,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.E2E_TESTING === 'true' || process.env.NODE_ENV === 'test' ? 100000 : 100,
  message: 'API rate limit exceeded',
});

export const settingsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many settings modifications, please try again later',
  keyGenerator: (req: Request | AuthenticatedRequest) => {
    const authReq = req as AuthenticatedRequest;
    return `settings:${authReq.user?.userId || 'unknown'}`;
  },
});

export const emailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Email rate limit exceeded, please try again later',
});

export const apiKeyCreationRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: 'API key creation limit exceeded, please try again tomorrow',
  keyGenerator: (req: Request | AuthenticatedRequest) => {
    const authReq = req as AuthenticatedRequest;
    return `apikey:${authReq.user?.userId || 'unknown'}`;
  },
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many password reset requests, please try again later',
  enableBruteForceProtection: true,
  keyGenerator: (req: Request) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const email = req.body?.email;
    if (email) {
      return `reset:${String(email)}`;
    }
    return defaultKeyGenerator(req);
  },
});
