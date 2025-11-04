import { Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { createLogger } from '@monorepo/shared';
import { AuthenticatedRequest } from '../auth';

// Configuration from environment variables
const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED !== 'false'; // default: true
const ANALYTICS_IP_ANONYMIZE = process.env.ANALYTICS_IP_ANONYMIZE !== 'false'; // default: true
const ANALYTICS_TRACK_AUTHENTICATED = process.env.ANALYTICS_TRACK_AUTHENTICATED !== 'false'; // default: true
const ANALYTICS_EXCLUDED_PATHS = (process.env.ANALYTICS_EXCLUDED_PATHS || '/health,/health/live,/health/ready')
  .split(',')
  .map(p => p.trim());

const logger = createLogger();

/**
 * Anonymize IP address for GDPR compliance
 * - IPv4: Replace last octet with 0 (e.g., 192.168.1.100 → 192.168.1.0)
 * - IPv6: Mask last 80 bits by replacing last 5 groups with zeros
 */
function anonymizeIp(ip: string | undefined): string | null {
  if (!ip) {
    return null;
  }

  // Handle localhost
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    return null;
  }

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
    return null; // Invalid IPv4
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 3) {
      // Keep first 3 groups, zero out the rest
      const anonymized = parts.slice(0, 3).join(':') + '::';
      return anonymized;
    }
    return null; // Invalid IPv6
  }

  return null; // Unknown format
}

/**
 * Page view tracking middleware
 * Captures page views on all GET requests with privacy controls
 * - Non-blocking (doesn't wait for DB insert)
 * - Gracefully handles errors
 * - Supports IP anonymization
 * - Respects privacy settings
 */
export function pageViewTrackingMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Skip if analytics is disabled
  if (!ANALYTICS_ENABLED) {
    next();
    return;
  }

  // Only track GET requests
  if (req.method !== 'GET') {
    next();
    return;
  }

  // Skip excluded paths (health checks, etc.)
  if (ANALYTICS_EXCLUDED_PATHS.includes(req.path)) {
    next();
    return;
  }

  // Skip API routes to avoid double-counting
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }

  // Extract user ID from authenticated request
  const userId = (req as AuthenticatedRequest).user?.userId || null;

  // Skip tracking authenticated users if disabled
  if (!ANALYTICS_TRACK_AUTHENTICATED && userId) {
    next();
    return;
  }

  // Extract request data
  const url = req.originalUrl || req.url;
  const path = req.path;
  const rawIp = req.ip;
  const ipAddress = ANALYTICS_IP_ANONYMIZE ? anonymizeIp(rawIp) : (rawIp || null);
  const userAgent = req.headers['user-agent'] || null;
  const referrer = req.headers['referer'] || null; // Note: 'referer' is the correct header name

  // Insert page view asynchronously (non-blocking)
  // Use void to explicitly ignore the promise
  void (async () => {
    try {
      await query(
        `INSERT INTO page_views (url, path, user_id, ip_address, user_agent, referrer)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [url, path, userId, ipAddress, userAgent, referrer]
      );
    } catch (error) {
      // Log error but don't throw - tracking should never break the request
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to insert page view', err, {
        path,
        userId,
      });
    }
  })();

  // Continue processing request immediately
  next();
}
