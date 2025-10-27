import { Request, Response, NextFunction } from 'express';
import type { ParsedQs } from 'qs';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  headers: Record<string, string>;
  varyHeaders?: string[]; // List of request header names that this entry varies on
}

interface CacheMetadata {
  varyHeaders: string[];
  timestamp: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private metadata = new Map<string, CacheMetadata>(); // Maps base key to vary headers
  private maxSize = 500; // Smaller cache for main app
  private defaultTTL = 180000; // 3 minutes

  private canonicalizeQuery(query: ParsedQs): string {
    if (Object.keys(query).length === 0) {
      return '';
    }

    // Use WeakSet to track circular references
    const seen = new WeakSet<object>();

    const canonicalizeValue = (val: unknown): string => {
      if (val === null || typeof val === 'undefined') {
        return '';
      }
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return JSON.stringify(val);
      }
      if (Array.isArray(val)) {
        // Check for circular reference
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
        const mapped = (val as unknown[]).map((v) => canonicalizeValue(v));
        seen.delete(val);
        // Preserve array insertion order for cache key canonicalization
        return `[${mapped.join(',')}]`;
      }
      if (typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        // Check for circular reference
        if (seen.has(obj)) {
          return '[Circular]';
        }
        seen.add(obj);
        const keys = Object.keys(obj).sort();
        const parts = keys.map((k) => `${k}:${canonicalizeValue(obj[k])}`);
        seen.delete(obj);
        return `{${parts.join(',')}}`;
      }
      return JSON.stringify(String(val));
    };

    const sortedKeys = Object.keys(query as Record<string, unknown>).sort();
    const pairs: string[] = [];
    for (const key of sortedKeys) {
      const value = (query as Record<string, unknown>)[key];
      pairs.push(`${key}=${canonicalizeValue(value)}`);
    }
    return pairs.join('&');
  }

  private generateBaseKey(req: Request): string {
    const canonicalQuery = this.canonicalizeQuery(req.query);
    return `${req.method}:${req.originalUrl.split('?')[0]}:${canonicalQuery}`;
  }

  private generateKey(req: Request, varyHeaders?: string[]): string {
    let key = this.generateBaseKey(req);

    // Add vary part if headers are specified
    if (varyHeaders && varyHeaders.length > 0) {
      const varyValues = varyHeaders.map(headerName => {
        const value = req.headers[headerName.toLowerCase()];
        if (Array.isArray(value)) {
          return value.join(',');
        }
        return value || '';
      });
      key += `:vary:${varyValues.join('|')}`;
    }

    return key;
  }

  get(req: Request): CacheEntry | null {
    // First, check metadata to see if this base key has vary headers
    const baseKey = this.generateBaseKey(req);
    const meta = this.metadata.get(baseKey);

    // If metadata exists and is not expired, use the vary headers to construct full key
    const varyHeaders = meta && Date.now() - meta.timestamp <= this.defaultTTL ? meta.varyHeaders : undefined;
    const key = this.generateKey(req, varyHeaders);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      this.metadata.delete(baseKey);
      return null;
    }

    // Use embedded varyHeaders from CacheEntry for subsequent lookups
    // If the entry has varyHeaders but they differ from metadata, regenerate key
    if (entry.varyHeaders && entry.varyHeaders.length > 0) {
      const embeddedKey = this.generateKey(req, entry.varyHeaders);
      if (embeddedKey !== key) {
        // Key mismatch - the metadata was stale or wrong
        return null;
      }
    }

    return entry;
  }

  set(req: Request, data: unknown, headers: Record<string, string>, varyHeaders?: string[]): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple FIFO)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    if (this.metadata.size >= this.maxSize) {
      const oldestMetaKey = this.metadata.keys().next().value;
      if (oldestMetaKey) {
        this.metadata.delete(oldestMetaKey);
      }
    }

    const key = this.generateKey(req, varyHeaders);
    const baseKey = this.generateBaseKey(req);
    const timestamp = Date.now();

    this.cache.set(key, {
      data,
      timestamp,
      headers,
      varyHeaders,
    });

    // Store metadata if vary headers exist
    if (varyHeaders && varyHeaders.length > 0) {
      this.metadata.set(baseKey, {
        varyHeaders,
        timestamp,
      });
    }
  }

  clear(): void {
    this.cache.clear();
    this.metadata.clear();
  }

  clearByPrefix(prefix: string): number {
    let cleared = 0;
    const normalized = prefix.startsWith('/') ? prefix : `/${prefix}`;
    for (const key of Array.from(this.cache.keys())) {
      // keys are METHOD:URL:QUERY...; match URL prefix for GETs
      if (key.startsWith(`GET:${normalized}`)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }
}

const responseCache = new ResponseCache();

// Helper to check if Cache-Control header prohibits caching
function isCacheControlNoCacheable(cacheControl: string | string[] | undefined): boolean {
  if (!cacheControl) {
    return false;
  }
  const ccStr = Array.isArray(cacheControl) ? cacheControl.join(', ') : cacheControl;
  const ccLower = ccStr.toLowerCase();
  return (
    ccLower.includes('no-store') || ccLower.includes('no-cache') || ccLower.includes('private')
  );
}

// Helper to check if response Cache-Control allows caching
function isCacheControlCacheable(cacheControl: string | string[] | undefined): boolean {
  if (!cacheControl) {
    return false;
  }
  const ccStr = Array.isArray(cacheControl) ? cacheControl.join(', ') : cacheControl;
  const ccLower = ccStr.toLowerCase();

  // Must not contain no-store, no-cache, or private
  if (ccLower.includes('no-store') || ccLower.includes('no-cache') || ccLower.includes('private')) {
    return false;
  }

  // Should contain public or max-age > 0
  if (ccLower.includes('public')) {
    return true;
  }

  // Check for max-age > 0
  const maxAgeMatch = ccLower.match(/max-age=(\d+)/);
  if (maxAgeMatch && parseInt(maxAgeMatch[1], 10) > 0) {
    return true;
  }

  return false;
}

// Response caching middleware for GET requests
export const cacheMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  // Bypass cache for authenticated requests to prevent user-specific data leakage
  // Check for common auth indicators: Authorization header, populated req.user, or auth cookies
  const hasAuthHeader = Boolean(req.headers.authorization);
  const hasUserContext = Boolean((req as Request & { user?: unknown }).user);

  // Check for cookie-based authentication
  let hasAuthCookie = false;
  const reqWithCookies = req as Request & { cookies?: Record<string, string> };
  // Get auth cookie names from env or use defaults (case-insensitive)
  const authCookieNamesEnv = process.env.CACHE_AUTH_COOKIES || '';
  const authCookieNames = authCookieNamesEnv
    ? authCookieNamesEnv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : ['session', 'sid', 'jwt', 'token', 'auth', 'accesstoken', 'refreshtoken'];

  if (reqWithCookies.cookies) {
    // Prefer parsed cookies from cookie-parser middleware
    const cookieNames = Object.keys(reqWithCookies.cookies).map(k => k.toLowerCase());
    // Use exact match only to avoid false positives (e.g., "discount" matching "count")
    hasAuthCookie = authCookieNames.some(authCookie => cookieNames.includes(authCookie));
  } else if (req.headers.cookie) {
    // Fallback: parse and check for exact cookie names
    const cookieHeader = req.headers.cookie;
    try {
      // Simple cookie parsing to extract names
      const cookieNames = cookieHeader
        .split(';')
        .map(c => c.trim().split('=')[0].toLowerCase())
        .filter(Boolean);
      hasAuthCookie = authCookieNames.some(authCookie => cookieNames.includes(authCookie));
    } catch {
      // If parsing fails, skip caching to be safe
      hasAuthCookie = true;
    }
  }

  if (hasAuthHeader || hasUserContext || hasAuthCookie) {
    next();
    return;
  }

  // Check request Cache-Control header - bypass cache if client requests fresh data
  if (isCacheControlNoCacheable(req.headers['cache-control'])) {
    // Skip reading from cache
    next();
    return;
  }

  const cached = responseCache.get(req);
  if (cached) {
    // Set cached headers
    Object.entries(cached.headers).forEach(([key, value]) => {
      res.set(key, value);
    });
    res.set('X-Cache', 'HIT');
    res.json(cached.data);
    return;
  }

  // Track whether we've already cached to prevent double-caching
  let alreadyCached = false;

  const maybeCache = (data: unknown): void => {
    if (alreadyCached || res.statusCode !== 200) {
      return;
    }

    // Check response Cache-Control before caching
    const responseCacheControlHeader = res.getHeader('Cache-Control');
    const responseCacheControl =
      typeof responseCacheControlHeader === 'number'
        ? String(responseCacheControlHeader)
        : responseCacheControlHeader;
    const shouldCache = isCacheControlCacheable(responseCacheControl);

    if (shouldCache) {
      // Handle Vary header for content negotiation
      const varyHeader = res.getHeader('Vary');
      let varyHeaders: string[] | undefined;
      if (varyHeader) {
        // Refuse to cache if Vary: *
        if (varyHeader === '*') {
          res.set('X-Cache', 'SKIP');
          return;
        }
        // Parse Vary header into individual header names
        const varyStr = typeof varyHeader === 'string' ? varyHeader : Array.isArray(varyHeader) ? varyHeader.join(',') : '';
        varyHeaders = varyStr
          .split(',')
          .map(h => h.trim().toLowerCase())
          .filter((h, i, arr) => h && arr.indexOf(h) === i); // Remove duplicates
      }

      const headers: Record<string, string> = {};
      Object.entries(res.getHeaders()).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (typeof value === 'number') {
          headers[key] = String(value);
        } else if (Array.isArray(value)) {
          headers[key] = value.join(', ');
        } else if (value !== null && value !== undefined) {
          headers[key] = String(value);
        }
      });
      responseCache.set(req, data, headers, varyHeaders);
      res.set('X-Cache', 'MISS');
      alreadyCached = true;
    } else {
      res.set('X-Cache', 'SKIP');
    }
  };

  // Override res.json to cache response
  const originalJson = res.json.bind(res);
  res.json = function (data: unknown) {
    maybeCache(data);
    return originalJson(data);
  } as typeof res.json;

  // Override res.send to cache response
  const originalSend = res.send.bind(res);
  res.send = function (body?: unknown) {
    maybeCache(body);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return originalSend(body as Parameters<typeof originalSend>[0]);
  } as typeof res.send;

  // Override res.end to cache response
  const originalEnd = res.end.bind(res);
  res.end = function (
    ...args: Parameters<typeof originalEnd>
  ): ReturnType<typeof originalEnd> {
    if (args.length > 0 && typeof args[0] !== 'undefined') {
      maybeCache(args[0]);
    }
    return originalEnd(...args);
  } as typeof res.end;

  next();
};

// Compression middleware with optimized settings
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const compressionMiddleware = compression({
  level: 6, // Balance between compression ratio and speed
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req: Request, res: Response) => {
    // Don't compress if cache-control is set to no-transform
    const cacheControl = res.getHeader('Cache-Control');
    if (typeof cacheControl === 'string' && cacheControl.includes('no-transform')) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return compression.filter(req, res);
  },
});

// Rate limiting middleware (more restrictive for main app)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req: Request) => req.path === '/health',
});

// Request/Response timing middleware
export const timingMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  // Store original res.end with proper typing
  type EndFunction = typeof res.end;
  const originalEnd: EndFunction = res.end.bind(res);

  // Override res.end to set timing header before headers are sent
  res.end = function (this: Response, ...args: Parameters<EndFunction>): ReturnType<EndFunction> {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);

    // Call original res.end with original arguments
    return originalEnd(...args);
  } as EndFunction;

  next();
};

// Security headers middleware
export const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Additional security headers beyond helmet
  res.set({
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });

  next();
};

// Connection keep-alive optimization
export const keepAliveMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  res.set('Connection', 'keep-alive');
  res.set('Keep-Alive', 'timeout=5, max=1000');
  next();
};

// Clear cache utility (for admin endpoints)
export const clearCache = (): void => {
  responseCache.clear();
};

// More granular invalidation by URL prefix for write operations
export const invalidateCacheByPrefix = (prefix: string): number => {
  return responseCache.clearByPrefix(prefix);
};
