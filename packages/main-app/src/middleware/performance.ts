import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  headers: Record<string, string>;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 500; // Smaller cache for main app
  private defaultTTL = 180000; // 3 minutes

  private canonicalizeQuery(query: Record<string, unknown>): string {
    if (Object.keys(query).length === 0) {
      return '';
    }

    // Sort keys lexicographically
    const sortedKeys = Object.keys(query).sort();

    // Build deterministic representation
    const pairs: string[] = [];
    for (const key of sortedKeys) {
      const value = query[key];

      // Handle arrays consistently
      if (Array.isArray(value)) {
        // Sort array values for determinism
        const sortedArray = [...value].sort();
        pairs.push(`${key}=${JSON.stringify(sortedArray)}`);
      } else if (value !== null && value !== undefined) {
        // Handle primitives and objects
        pairs.push(`${key}=${JSON.stringify(value)}`);
      }
    }

    return pairs.join('&');
  }

  private generateKey(req: Request): string {
    const canonicalQuery = this.canonicalizeQuery(req.query as Record<string, unknown>);
    return `${req.method}:${req.originalUrl.split('?')[0]}:${canonicalQuery}`;
  }

  get(req: Request): CacheEntry | null {
    const key = this.generateKey(req);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }

  set(req: Request, data: unknown, headers: Record<string, string>): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple FIFO)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.generateKey(req);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      headers
    });
  }

  clear(): void {
    this.cache.clear();
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
  return ccLower.includes('no-store') || ccLower.includes('no-cache') || ccLower.includes('private');
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
export const cacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    return next();
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

  // Override res.json to cache response
  const originalJson = res.json.bind(res);
  res.json = function(data: unknown) {
    if (res.statusCode === 200) {
      // Check response Cache-Control before caching
      const responseCacheControlHeader = res.getHeader('Cache-Control');
      const responseCacheControl = typeof responseCacheControlHeader === 'number' ? String(responseCacheControlHeader) : responseCacheControlHeader;
      const shouldCache = isCacheControlCacheable(responseCacheControl);

      if (shouldCache) {
        const headers: Record<string, string> = {};
        Object.entries(res.getHeaders()).forEach(([key, value]) => {
          if (typeof value === 'string') {
            headers[key] = value;
          }
        });
        responseCache.set(req, data, headers);
        res.set('X-Cache', 'MISS');
      } else {
        // Not cacheable, set header to indicate why
        res.set('X-Cache', 'SKIP');
      }
    }
    return originalJson(data);
  };

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
  }
});

// Rate limiting middleware (more restrictive for main app)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req: Request) => req.path === '/health'
});

// Request/Response timing middleware
export const timingMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  // Store original res.end with proper typing
  type EndFunction = typeof res.end;
  const originalEnd: EndFunction = res.end.bind(res);

  // Override res.end to set timing header before headers are sent
  res.end = function(this: Response, ...args: Parameters<EndFunction>): ReturnType<EndFunction> {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);

    // Call original res.end with original arguments
    return originalEnd(...args);
  } as EndFunction;

  next();
};

// Security headers middleware
export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  // Additional security headers beyond helmet
  res.set({
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'cross-origin'
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
