import { Request, Response, NextFunction } from 'express';
import type { ParsedQs } from 'qs';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  headers: Record<string, string>;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 1000;
  private defaultTTL = 300000; // 5 minutes

  private canonicalizeQuery(query: ParsedQs): string {
    const keys = Object.keys(query as Record<string, unknown>);
    if (keys.length === 0) {return '';}
    const normalize = (val: unknown): string => {
      if (val === null || typeof val === 'undefined') {return '';}
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return JSON.stringify(val);
      }
      if (Array.isArray(val)) {
        const items = (val as unknown[]).map((v) => normalize(v)).sort();
        return `[${items.join(',')}]`;
      }
      if (typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const objKeys = Object.keys(obj).sort();
        const parts = objKeys.map((k) => `${k}:${normalize(obj[k])}`);
        return `{${parts.join(',')}}`;
      }
      return JSON.stringify(String(val));
    };
    const sortedKeys = keys.sort();
    const pairs = sortedKeys.map((k) => `${k}=${normalize((query as Record<string, unknown>)[k])}`);
    return pairs.join('&');
  }

  private generateKey(req: Request): string {
    const base = req.originalUrl.split('?')[0];
    const canonicalQuery = this.canonicalizeQuery(req.query);
    return `${req.method}:${base}:${canonicalQuery}`;
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
      // FIFO eviction (remove oldest inserted entry)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.generateKey(req);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      headers,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const responseCache = new ResponseCache();

// Response caching middleware for GET requests
export const cacheMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip caching for non-GET requests or authenticated requests
  // Check for Authorization header, Cookie header (session auth), and any other auth indicators
  if (req.method !== 'GET' || req.headers.authorization || req.headers.cookie) {
    next();
    return;
  }

  const cached = responseCache.get(req);
  if (cached) {
    // Set cached headers (preserve numeric and array values)
    Object.entries(cached.headers).forEach(([key, value]) => {
      if (typeof value === 'number') {
        res.set(key, String(value));
      } else if (Array.isArray(value)) {
        res.set(key, value.map(String));
      } else {
        res.set(key, value);
      }
    });
    res.set('X-Cache', 'HIT');
    // Prefer json for objects; send for strings/buffers
    const body = cached.data;
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      res.send(body);
    } else {
      res.json(body);
    }
    return;
  }

  // Capture body across json/send/end
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);

  const maybeCache = (data: unknown): void => {
    if (res.statusCode !== 200) {
      return;
    }
    const cacheControl = res.getHeader('Cache-Control');
    const cacheControlStr =
      typeof cacheControl === 'string'
        ? cacheControl.toLowerCase()
        : Array.isArray(cacheControl)
          ? cacheControl.join(', ').toLowerCase()
          : '';
    const shouldSkipCache =
      cacheControlStr.includes('no-store') ||
      cacheControlStr.includes('no-cache') ||
      cacheControlStr.includes('private');
    if (shouldSkipCache) {
      return;
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
    responseCache.set(req, data, headers);
    res.set('X-Cache', 'MISS');
  };

  res.json = function (data: unknown) {
    maybeCache(data);
    return originalJson(data);
  } as typeof res.json;

  res.send = function (body?: unknown) {
    // Preserve semantics: res.send can take Buffer|string|object
    maybeCache(body);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return originalSend(body as Parameters<typeof originalSend>[0]);
  } as typeof res.send;

  res.end = function (
    ...args: Parameters<typeof originalEnd>
  ): ReturnType<typeof originalEnd> {
    // Only cache if a final chunk is provided
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

// Rate limiting middleware
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
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

  // Wrap res.end to set header before response is sent
  type EndFunction = typeof res.end;
  const originalEnd: EndFunction = res.end.bind(res);

  res.end = function (this: Response, ...args: Parameters<EndFunction>): ReturnType<EndFunction> {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
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
