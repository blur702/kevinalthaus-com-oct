import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { randomBytes } from 'crypto';
import {
  compressionMiddleware,
  rateLimitMiddleware,
  timingMiddleware,
  securityHeadersMiddleware,
  keepAliveMiddleware,
  cacheMiddleware,
} from './middleware/performance';
import { requestIdMiddleware } from './middleware/requestId';

const app = express();

// Enforce JWT secret handling

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required for API Gateway. Set the same secret for both gateway and main-app.');
}
const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3001';
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const PLUGIN_ENGINE_URL = process.env.PLUGIN_ENGINE_URL || 'http://localhost:3004';

// Internal gateway token for service-to-service authentication
let INTERNAL_GATEWAY_TOKEN = process.env.INTERNAL_GATEWAY_TOKEN;
if (!INTERNAL_GATEWAY_TOKEN) {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    INTERNAL_GATEWAY_TOKEN = randomBytes(32).toString('hex');
    // eslint-disable-next-line no-console
    console.warn('');
    // eslint-disable-next-line no-console
    console.warn('═══════════════════════════════════════════════════════════════');
    // eslint-disable-next-line no-console
    console.warn('⚠️  [Gateway] INTERNAL_GATEWAY_TOKEN not set - using random ephemeral token');
    // eslint-disable-next-line no-console
    console.warn('═══════════════════════════════════════════════════════════════');
    // eslint-disable-next-line no-console
    console.warn('This is acceptable for development but has implications:');
    // eslint-disable-next-line no-console
    console.warn('  - Token becomes invalid on gateway restart');
    // eslint-disable-next-line no-console
    console.warn('  - Must match across all services for verification');
    // eslint-disable-next-line no-console
    console.warn('  - Not suitable for any production or staging environment');
    // eslint-disable-next-line no-console
    console.warn('');
    // eslint-disable-next-line no-console
    console.warn('Set INTERNAL_GATEWAY_TOKEN in .env to match across services:');
    // eslint-disable-next-line no-console
    console.warn('  Generate a token with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    // eslint-disable-next-line no-console
    console.warn('  Then set: INTERNAL_GATEWAY_TOKEN=<generated-token>');
    // eslint-disable-next-line no-console
    console.warn('═══════════════════════════════════════════════════════════════');
    // eslint-disable-next-line no-console
    console.warn('');
  } else {
    throw new Error(
      'INTERNAL_GATEWAY_TOKEN is required for API Gateway in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
}

// Validate proxy targets from env
const ALLOWED_PROXY_TARGETS = [MAIN_APP_URL, PYTHON_SERVICE_URL, PLUGIN_ENGINE_URL];

// Parse CORS_ORIGIN from environment
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'];

const corsCredentials = process.env.CORS_CREDENTIALS === 'true';

// Performance and security middleware (order matters)
app.use(requestIdMiddleware);
app.use(timingMiddleware);

// Upstream safety: strip any X-User-* headers early to avoid accidental use
app.use((req, _res, next) => {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-role'];
  delete req.headers['x-user-email'];
  next();
});

app.use(compressionMiddleware);

// Configure Helmet with env toggles - single source of truth
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", 'https://fonts.googleapis.com'],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
};

const hstsSettings = {
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true,
};

const helmetOptions: {
  contentSecurityPolicy?: { directives: typeof cspDirectives };
  hsts?: typeof hstsSettings;
} = {};

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

// Helper function to check downstream service health with independent AbortController
async function checkServiceHealth(url: string, timeoutMs: number = 5000): Promise<boolean> {
  // Create fresh AbortController for this check to ensure independent timeout per service
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    return response.ok;
  } catch (error) {
    // Service unreachable or timed out
    return false;
  } finally {
    // Always clear timeout in finally to prevent memory leaks
    clearTimeout(timeoutId);
  }
}

// Health check endpoints
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.get('/health', async (_req, res): Promise<void> => {
  // Check downstream services in parallel with independent timeouts
  const [mainAppHealthy, pythonServiceHealthy] = await Promise.all([
    checkServiceHealth(MAIN_APP_URL),
    checkServiceHealth(PYTHON_SERVICE_URL),
  ]);

  const checks = {
    mainApp: mainAppHealthy ? 'healthy' : 'unhealthy',
    pythonService: pythonServiceHealthy ? 'healthy' : 'unhealthy',
  };

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
  // Check critical dependencies (main-app is required for readiness)
  const mainAppHealthy = await checkServiceHealth(MAIN_APP_URL);

  if (!mainAppHealthy) {
    res.status(503).json({ status: 'not ready', dependencies: { mainApp: 'unhealthy' } });
    return;
  }

  res.json({ status: 'ready', dependencies: { mainApp: 'healthy' } });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Kevin Althaus API Gateway',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Consolidated proxy factory
interface ProxyOptions {
  target: string;
  pathRewrite?: Record<string, string>;
  includeForwardingHeaders?: boolean;
  timeout?: number;
}

function createProxy(options: ProxyOptions): express.RequestHandler {
  const { target, pathRewrite, includeForwardingHeaders = false, timeout } = options;

  // Validate target is in allowlist
  if (!ALLOWED_PROXY_TARGETS.includes(target)) {
    throw new Error(`Proxy target ${target} is not allowed. Must be one of: ${ALLOWED_PROXY_TARGETS.join(', ')}`);
  }

  const proxyOptions: Options = {
    target,
    changeOrigin: true,
    logLevel: 'warn',
    pathRewrite,
    ...(timeout && { timeout, proxyTimeout: timeout }),
    onProxyReq: (proxyReq, req) => {
      // Set internal gateway token to verify request origin
      proxyReq.setHeader('X-Internal-Token', INTERNAL_GATEWAY_TOKEN!);

      // Propagate request id if present
      const rid = req.headers['x-request-id'];
      if (rid) {
        proxyReq.setHeader(
          'x-request-id',
          Array.isArray(rid) ? rid[0] : String(rid)
        );
      }

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

      // Conditionally add forwarding headers
      if (includeForwardingHeaders) {
        proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
        proxyReq.setHeader('X-Forwarded-Host', req.get('Host') || '');
        proxyReq.setHeader('X-Real-IP', req.ip || '');
      }
    },
  };

  return createProxyMiddleware(proxyOptions) as unknown as express.RequestHandler;
}

// Helper function to extract cookie value
function getCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const eqIndex = cookie.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = cookie.substring(0, eqIndex);
    const value = cookie.substring(eqIndex + 1);
    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch (error) {
        // Return undefined for malformed percent-encoding
        return undefined;
      }
    }
  }
  return undefined;
}

// JWT verification middleware for protected routes
function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check for token in cookie (preferred for browser clients)
  const cookieToken = getCookie(req.headers.cookie, 'accessToken');
  if (cookieToken) {
    token = cookieToken;
  }
  // 2. Fallback to Authorization header (for API clients)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided',
    });
    return;
  }

  try {
    if (!JWT_SECRET) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'JWT configuration error',
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Validate decoded payload structure
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      typeof (decoded as { userId?: unknown }).userId !== 'string' ||
      typeof (decoded as { email?: unknown }).email !== 'string' ||
      typeof (decoded as { role?: unknown }).role !== 'string'
    ) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload',
      });
      return;
    }

    const payload = decoded as { userId: string; email: string; role: string };

    // Forward user context to downstream services
    req.headers['x-user-id'] = payload.userId;
    req.headers['x-user-role'] = payload.role;
    req.headers['x-user-email'] = payload.email;

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

// Plugins proxy (optional service)
// Plugins API: proxy to dedicated plugin engine. Protected by JWT.
app.use(
  '/api/plugins',
  jwtMiddleware,
  createProxy({ target: PLUGIN_ENGINE_URL, pathRewrite: { '^/api/plugins': '/plugins' } })
);

// Auth routes (no JWT required, but stricter rate limiting)
app.use(
  '/api/auth',
  authRateLimit,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/auth': '/api/auth' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// Protected routes with JWT verification
app.use(
  '/api/users',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/users': '/api/users' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// (removed) Previous proxy to main-app for /api/plugins to avoid duplicate registrations

app.use(
  '/api/settings',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/settings': '/api/settings' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// Python service proxy (JWT required)
app.use(
  '/api/python',
  jwtMiddleware,
  createProxy({
    target: PYTHON_SERVICE_URL,
    pathRewrite: { '^/api/python': '/' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

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
