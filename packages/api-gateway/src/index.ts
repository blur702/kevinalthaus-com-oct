import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import {
  compressionMiddleware,
  rateLimitMiddleware,
  timingMiddleware,
  securityHeadersMiddleware,
  keepAliveMiddleware,
  cacheMiddleware
} from './middleware/performance';
import { requestIdMiddleware } from './middleware/requestId';

const app = express();

// Enforce JWT secret handling
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('JWT_SECRET is required for API Gateway in non-development environments');
  }
  JWT_SECRET = 'development_only_insecure_key_do_not_use_in_prod';
  // eslint-disable-next-line no-console
  console.warn('[Gateway] WARNING: Using development-only JWT secret. Set JWT_SECRET for production.');
}
const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3001';
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Validate proxy targets from env
const ALLOWED_PROXY_TARGETS = [MAIN_APP_URL, PYTHON_SERVICE_URL];

// Parse CORS_ORIGIN from environment
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'];

const corsCredentials = process.env.CORS_CREDENTIALS === 'true';

// Performance and security middleware (order matters)
app.use(requestIdMiddleware);
app.use(timingMiddleware);
app.use(compressionMiddleware);

// Configure Helmet with env toggles - single source of truth
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
};

const hstsSettings = {
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true,
};

const helmetOptions: { contentSecurityPolicy?: { directives: typeof cspDirectives }; hsts?: typeof hstsSettings } = {};

if (process.env.HELMET_CSP_ENABLED === 'true') {
  helmetOptions.contentSecurityPolicy = { directives: cspDirectives };
}

if (process.env.HELMET_HSTS_ENABLED === 'true') {
  helmetOptions.hsts = hstsSettings;
}

// Apply helmet with options if any are set, otherwise use defaults
if (Object.keys(helmetOptions).length > 0) {
  app.use(helmet(helmetOptions));
} else {
  app.use(helmet());
}
app.use(securityHeadersMiddleware);
app.use(keepAliveMiddleware);
  app.use(
    cors((req, callback) => {
      const allowAll = corsOrigins.includes('*');
      if (allowAll) {
        callback(null, { origin: '*', credentials: false });
        return;
      }
      const origin = req.header('Origin');
      // Require a present Origin header and membership in the allowlist
      const isAllowed = Boolean(origin) && corsOrigins.includes(String(origin));
      callback(null, { origin: isAllowed ? origin : false, credentials: corsCredentials });
    })
  );
app.use(morgan('combined'));
// Body size limits must match downstream main-app limits to prevent gateway accepting
// requests that main-app will reject (1MB for JSON, 100KB for URL-encoded)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Cache middleware for GET requests
app.use(cacheMiddleware);

// Stricter rate limit for auth endpoints
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
}) as express.RequestHandler;

// General rate limit
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
app.use('/api/', rateLimitMiddleware);

// Health check endpoints
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.get('/health', async (_req, res): Promise<void> => {
  // Check downstream services
  const checks: Record<string, string> = {};

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const mainAppResponse = await fetch(`${MAIN_APP_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      checks.mainApp = mainAppResponse.ok ? 'healthy' : 'unhealthy';
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    checks.mainApp = 'unhealthy';
  }

  const allHealthy = Object.values(checks).every((status) => status === 'healthy');
  const status = allHealthy ? 'healthy' : 'degraded';

  res.status(allHealthy ? 200 : 503).json({
    status,
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || '1.0.0',
    uptime: process.uptime(),
    checks,
  });
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive' });
});

// Readiness should probe downstream dependencies
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.get('/health/ready', async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const mainAppResponse = await fetch(`${MAIN_APP_URL}/health`, {
        signal: controller.signal,
      });
      if (!mainAppResponse.ok) {
        res.status(503).json({ status: 'not ready', dependencies: { mainApp: 'unhealthy' } });
        return;
      }
      res.json({ status: 'ready', dependencies: { mainApp: 'healthy' } });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    res.status(503).json({ status: 'not ready', dependencies: { mainApp: 'unhealthy' } });
  }
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Kevin Althaus API Gateway',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// JWT verification middleware for protected routes
function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as {
      userId: string;
      email: string;
      role: string;
    };

    // Forward user context to downstream services
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-email'] = decoded.email;

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

// Proxy configuration helper
function createSecureProxy(target: string, pathRewrite?: Record<string, string>): Options {
  if (!ALLOWED_PROXY_TARGETS.includes(target)) {
    throw new Error(`Proxy target ${target} is not allowed`);
  }

  return {
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: 30000,
    proxyTimeout: 30000,
    onProxyReq: (proxyReq, req) => {
      // Forward all headers including user context
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
      proxyReq.setHeader('X-Forwarded-Host', req.get('Host') || '');
      proxyReq.setHeader('X-Real-IP', req.ip || '');

      // Drop any incoming spoofed X-User-* headers from clients
      proxyReq.removeHeader('X-User-Id');
      proxyReq.removeHeader('X-User-Role');
      proxyReq.removeHeader('X-User-Email');

      // Forward user context headers only from verified JWT middleware
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-Id', req.headers['x-user-id'] as string);
      }
      if (req.headers['x-user-role']) {
        proxyReq.setHeader('X-User-Role', req.headers['x-user-role'] as string);
      }
      if (req.headers['x-user-email']) {
        proxyReq.setHeader('X-User-Email', req.headers['x-user-email'] as string);
      }
    },
  };
}

// Upstream safety: strip any X-User-* headers early to avoid accidental use
app.use((req, _res, next) => {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-role'];
  delete req.headers['x-user-email'];
  next();
});

// Auth routes (no JWT required, but stricter rate limiting)
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
app.use('/api/auth', authRateLimit, createProxyMiddleware(
  createSecureProxy(MAIN_APP_URL, { '^/api/auth': '/api/auth' })
));

// Protected routes with JWT verification
app.use('/api/users', jwtMiddleware, createProxyMiddleware(
  createSecureProxy(MAIN_APP_URL, { '^/api/users': '/api/users' })
));

app.use('/api/plugins', jwtMiddleware, createProxyMiddleware(
  createSecureProxy(MAIN_APP_URL, { '^/api/plugins': '/api/plugins' })
));

app.use('/api/settings', jwtMiddleware, createProxyMiddleware(
  createSecureProxy(MAIN_APP_URL, { '^/api/settings': '/api/settings' })
));

// Python service proxy (JWT required)
app.use('/api/python', jwtMiddleware, createProxyMiddleware(
  createSecureProxy(PYTHON_SERVICE_URL, { '^/api/python': '/' })
));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[Gateway] Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
