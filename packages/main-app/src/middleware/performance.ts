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

  private generateKey(req: Request): string {
    return `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
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

// Response caching middleware for GET requests
export const cacheMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== 'GET') {
    return next();
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
      const headers: Record<string, string> = {};
      Object.entries(res.getHeaders()).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      });
      responseCache.set(req, data, headers);
      res.set('X-Cache', 'MISS');
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
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
  });
  
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
