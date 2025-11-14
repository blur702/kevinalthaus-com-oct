import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import type { CookieOptions } from 'express-serve-static-core';
import { createLogger } from '@monorepo/shared';
import { AuthenticatedRequest } from '../auth';
import { analyticsService } from '../services/analyticsServiceRegistry';

// Configuration from environment variables
const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED !== 'false'; // default: true
const ANALYTICS_IP_ANONYMIZE = process.env.ANALYTICS_IP_ANONYMIZE !== 'false'; // default: true
const ANALYTICS_TRACK_AUTHENTICATED = process.env.ANALYTICS_TRACK_AUTHENTICATED !== 'false'; // default: true
const ANALYTICS_EXCLUDED_PATHS = (process.env.ANALYTICS_EXCLUDED_PATHS || '/health,/health/live,/health/ready')
  .split(',')
  .map((p) => p.trim());
const ANALYTICS_SESSION_COOKIE = process.env.ANALYTICS_SESSION_COOKIE || 'ka_analytics_sid';
const ANALYTICS_ANON_COOKIE = process.env.ANALYTICS_ANON_COOKIE || 'ka_analytics_aid';
const SESSION_IDLE_MINUTES = Math.max(parseInt(process.env.ANALYTICS_SESSION_IDLE_MINUTES || '30', 10), 5);
const SESSION_MAX_AGE_MS = SESSION_IDLE_MINUTES * 60 * 1000;
const ANON_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year persistence
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cookieBaseOptions: CookieOptions = {
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

const sessionCookieOptions: CookieOptions = {
  ...cookieBaseOptions,
  httpOnly: true,
  maxAge: SESSION_MAX_AGE_MS,
};

const anonymousCookieOptions: CookieOptions = {
  ...cookieBaseOptions,
  httpOnly: false,
  maxAge: ANON_COOKIE_MAX_AGE_MS,
};

const logger = createLogger();

/**
 * Anonymize IP address for GDPR compliance
 * - IPv4: Replace last octet with 0 (e.g., 192.168.1.100 -> 192.168.1.0)
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

function isValidUuid(value?: string | null): value is string {
  if (!value) {
    return false;
  }
  return SESSION_ID_PATTERN.test(value);
}

function detectDeviceType(userAgent: string | null | undefined): string | null {
  if (!userAgent) {
    return null;
  }

  const ua = userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) {
    return 'tablet';
  }
  if (/mobi|iphone|android/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

function getQueryParam(req: Request, key: string): string | null {
  const value = req.query?.[key];
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : null;
  }
  return typeof value === 'string' ? value : null;
}

function parseReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) {
    return null;
  }

  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return null;
  }
}

function resolveAnonymousId(req: Request, res: Response): string {
  const existingAnonId = req.cookies?.[ANALYTICS_ANON_COOKIE];

  if (isValidUuid(existingAnonId)) {
    // Only set cookie if headers haven't been sent
    if (!res.headersSent) {
      res.cookie(ANALYTICS_ANON_COOKIE, existingAnonId, anonymousCookieOptions);
    }
    return existingAnonId;
  }

  const anonId = randomUUID();
  // Only set cookie if headers haven't been sent
  if (!res.headersSent) {
    res.cookie(ANALYTICS_ANON_COOKIE, anonId, anonymousCookieOptions);
  }
  return anonId;
}

async function ensureAnalyticsSession(
  req: Request,
  res: Response,
  context: {
    userId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    fullUrl: string;
    path: string;
    referrer: string | null;
  }
): Promise<string | null> {
  const anonymousId = resolveAnonymousId(req, res);
  const sessionCookieValue = req.cookies?.[ANALYTICS_SESSION_COOKIE];
  const utmSource = getQueryParam(req, 'utm_source');
  const utmMedium = getQueryParam(req, 'utm_medium');
  const utmCampaign = getQueryParam(req, 'utm_campaign');
  const deviceType = detectDeviceType(context.userAgent);
  const referrerHost = parseReferrerHost(context.referrer);

  if (sessionCookieValue && isValidUuid(sessionCookieValue)) {
    try {
      // Update last activity timestamp on each request
      // Note: session_end should only be set on explicit logout or by idle-timeout processing
      await analyticsService.updateSession(sessionCookieValue, {
        last_activity: new Date(),
        exit_page: context.path,
        ip_address: context.ipAddress ?? undefined,
        user_agent: context.userAgent ?? undefined,
        device_type: deviceType ?? undefined,
        referrer_source: utmSource ?? referrerHost ?? undefined,
        referrer_medium: utmMedium ?? undefined,
        referrer_campaign: utmCampaign ?? undefined,
      });
      // Only set cookie if headers haven't been sent
      if (!res.headersSent) {
        res.cookie(ANALYTICS_SESSION_COOKIE, sessionCookieValue, sessionCookieOptions);
      }
      return sessionCookieValue;
    } catch (error) {
      logger.warn('Failed to update analytics session, will attempt to create new session', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const session = await analyticsService.createSession({
      user_id: context.userId ?? undefined,
      anonymous_id: anonymousId,
      session_start: new Date(),
      ip_address: context.ipAddress ?? undefined,
      user_agent: context.userAgent ?? undefined,
      device_type: deviceType ?? undefined,
      referrer_source: utmSource ?? referrerHost ?? undefined,
      referrer_medium: utmMedium ?? undefined,
      referrer_campaign: utmCampaign ?? undefined,
      landing_page: context.fullUrl,
    });

    // Only set cookie if headers haven't been sent
    if (!res.headersSent) {
      res.cookie(ANALYTICS_SESSION_COOKIE, session.id, sessionCookieOptions);
    }
    return session.id;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create analytics session', err, {
      path: context.path,
    });
    return null;
  }
}

/**
 * Page view tracking middleware
 * Captures page views on all GET requests with privacy controls
 * - Non-blocking (doesn't wait for DB insert)
 * - Gracefully handles errors
 * - Supports IP anonymization
 * - Respects privacy settings
 */
export function pageViewTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
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
  const ipAddress = ANALYTICS_IP_ANONYMIZE ? anonymizeIp(rawIp) : rawIp || null;
  const userAgent = (req.headers['user-agent']) || null;
  const referrer = (req.headers['referer']) || null;

  void (async () => {
    try {
      const sessionId = await ensureAnalyticsSession(req, res, {
        userId,
        ipAddress,
        userAgent,
        fullUrl: url,
        path,
        referrer,
      });

      if (!sessionId) {
        return;
      }

      await analyticsService.recordPageView({
        session_id: sessionId,
        user_id: userId ?? undefined,
        page_url: url,
        page_path: path,
        referrer: referrer ?? undefined,
        user_agent: userAgent ?? undefined,
        ip_address: ipAddress ?? undefined,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to record analytics page view', err, {
        path,
        userId,
      });
    }
  })();

  // Continue processing request immediately
  next();
}

// Export helpers for testing
export const __internal = {
  anonymizeIp,
  resolveAnonymousId,
  ensureAnalyticsSession,
};
