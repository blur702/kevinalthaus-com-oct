import express, { Request, Response, NextFunction } from 'express';
import type {} from '@monorepo/shared/src/types/express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { createLogger, LogLevel } from '@monorepo/shared';
import {
  compressionMiddleware,
  rateLimitMiddleware,
  timingMiddleware,
  securityHeadersMiddleware,
  keepAliveMiddleware,
  cacheMiddleware,
} from './middleware/performance';
import * as Sentry from '@sentry/node';
import { requestIdMiddleware } from './middleware/requestId';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseSampleRate(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : defaultValue;
}

function setupSentry(): boolean {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  const enabled = Boolean(dsn) && parseBoolean(process.env.SENTRY_ENABLED, true);

  if (!enabled) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.VERSION || 'api-gateway@unknown',
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.05),
    sampleRate: parseSampleRate(process.env.SENTRY_ERROR_SAMPLE_RATE, 1.0),
    sendDefaultPii: parseBoolean(process.env.SENTRY_SEND_DEFAULT_PII, false),
  });

  return true;
}

const app = express();
export const isSentryEnabled = setupSentry();

// Normalize LOG_LEVEL to valid enum value
const normalizedLogLevel = (() => {
  const rawLevel = (process.env.LOG_LEVEL || '').trim().toUpperCase();
  const validLevels: Record<string, LogLevel> = {
    DEBUG: LogLevel.DEBUG,
    INFO: LogLevel.INFO,
    WARN: LogLevel.WARN,
    ERROR: LogLevel.ERROR,
  };
  return validLevels[rawLevel] || LogLevel.INFO;
})();

// Normalize LOG_FORMAT to 'json' or 'text'
const normalizedLogFormat = (() => {
  const rawFormat = (process.env.LOG_FORMAT || '').trim().toLowerCase();
  return (rawFormat === 'json' || rawFormat === 'text') ? rawFormat : 'text';
})();

// Initialize structured logger
const logger = createLogger({
  level: normalizedLogLevel,
  format: normalizedLogFormat,
  service: 'api-gateway',
});

logger.info(
  `[Gateway] Booting with NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}, E2E_TESTING=${process.env.E2E_TESTING ?? 'undefined'}, RATE_LIMIT_BYPASS_E2E=${process.env.RATE_LIMIT_BYPASS_E2E ?? 'undefined'}`
);

// Enforce JWT secret handling

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required for API Gateway. Set the same secret for both gateway and main-app.');
}
const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3003';
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const PLUGIN_ENGINE_URL = process.env.PLUGIN_ENGINE_URL || 'http://localhost:3004';

// Internal gateway token for service-to-service authentication
let INTERNAL_GATEWAY_TOKEN = process.env.INTERNAL_GATEWAY_TOKEN;
if (!INTERNAL_GATEWAY_TOKEN) {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Persist a shared dev token to a well-known file so all services reuse the same value
    const baseDir = process.cwd();
    const tokenFile = path.resolve(baseDir, '.internal_gateway_token');
    try {
      if (fs.existsSync(tokenFile)) {
        const existing = fs.readFileSync(tokenFile, 'utf8').trim();
        if (existing && existing.length >= 32) {
          INTERNAL_GATEWAY_TOKEN = existing;
        }
      }
      if (!INTERNAL_GATEWAY_TOKEN) {
        const generated = randomBytes(32).toString('hex');
        fs.writeFileSync(tokenFile, generated + '\n', { mode: 0o600 });
        INTERNAL_GATEWAY_TOKEN = generated;
      }
      process.env.INTERNAL_GATEWAY_TOKEN = INTERNAL_GATEWAY_TOKEN;
      logger.warn('[Gateway] Using persistent INTERNAL_GATEWAY_TOKEN for development');
    } catch (err) {
      logger.warn('[Gateway] Failed to persist dev INTERNAL_GATEWAY_TOKEN; using ephemeral token');
      INTERNAL_GATEWAY_TOKEN = randomBytes(32).toString('hex');
      process.env.INTERNAL_GATEWAY_TOKEN = INTERNAL_GATEWAY_TOKEN;
    }
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
const allowAllCors = corsOrigins.includes('*');
const corsOriginSet = new Set(corsOrigins);

const corsCredentials = process.env.CORS_CREDENTIALS === 'true';

// Security check: reject wildcard origins with credentials in production
if (process.env.NODE_ENV === 'production' && corsOrigins.includes('*') && corsCredentials) {
  throw new Error(
    'Security Error: Wildcard CORS origin (*) cannot be used with credentials in production. ' +
    'Set CORS_ORIGIN to an explicit allowlist of origins.'
  );
}

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
    if (allowAllCors) {
      callback(null, { origin: '*', credentials: false });
      return;
    }
    const origin = req.header('Origin');
    const normalizedOrigin = origin?.trim();
    // Require a present Origin header and membership in the allowlist
    const isAllowed = normalizedOrigin ? corsOriginSet.has(normalizedOrigin) : false;
    callback(null, { origin: isAllowed ? normalizedOrigin : false, credentials: corsCredentials });
  })
);

if (process.env.REQUEST_LOGGING === 'morgan') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const morgan = require('morgan') as typeof import('morgan');
  app.use(morgan('combined'));
}

// Cache middleware for GET requests
app.use(cacheMiddleware);

// Stricter rate limit for auth endpoints
// In development/test mode, use more permissive limits to allow automated testing
const RATE_LIMIT_BYPASS_ENABLED = (() => {
  if (process.env.DISABLE_AUTH_RATE_LIMIT === 'true') {
    return true;
  }
  const explicitFlag =
    process.env.RATE_LIMIT_BYPASS_E2E ??
    process.env.E2E_TESTING ??
    (process.env.NODE_ENV !== 'production' ? 'true' : 'false');
  return String(explicitFlag).toLowerCase() !== 'false';
})();

const baseAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
}) as express.RequestHandler;

const authRateLimit: express.RequestHandler = (req, res, next) => {
  if (RATE_LIMIT_BYPASS_ENABLED) {
    return next();
  }
  return baseAuthRateLimit(req, res, next);
};

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
const HEALTH_CACHE_MS = Number(process.env.HEALTH_CACHE_MS || 5000);

interface HealthCacheEntry<T> {
  data: T;
  expiresAt: number;
}

type HealthPayload = {
  status: 'healthy' | 'degraded';
  service: string;
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, 'healthy' | 'unhealthy'>;
};

type ReadyPayload =
  | { status: 'ready'; dependencies: { mainApp: 'healthy' } }
  | { status: 'not ready'; dependencies: { mainApp: 'unhealthy' } };

const healthCache: {
  overall?: HealthCacheEntry<HealthPayload>;
  ready?: HealthCacheEntry<ReadyPayload>;
} = {};

async function getOverallHealth(): Promise<HealthPayload> {
  const now = Date.now();
  if (healthCache.overall && healthCache.overall.expiresAt > now) {
    return healthCache.overall.data;
  }

  const [mainAppHealthy, pythonServiceHealthy] = await Promise.all([
    checkServiceHealth(MAIN_APP_URL),
    checkServiceHealth(PYTHON_SERVICE_URL),
  ]);

  const checks = {
    mainApp: mainAppHealthy ? 'healthy' : 'unhealthy',
    pythonService: pythonServiceHealthy ? 'healthy' : 'unhealthy',
  };

  const allHealthy = Object.values(checks).every((status) => status === 'healthy');
  const payload: HealthPayload = {
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || '1.0.0',
    uptime: process.uptime(),
    checks,
  };

  healthCache.overall = { data: payload, expiresAt: now + HEALTH_CACHE_MS };
  return payload;
}

async function getReadiness(): Promise<ReadyPayload> {
  const now = Date.now();
  if (healthCache.ready && healthCache.ready.expiresAt > now) {
    return healthCache.ready.data;
  }

  const mainAppHealthy = await checkServiceHealth(MAIN_APP_URL);
  const payload: ReadyPayload = mainAppHealthy
    ? { status: 'ready', dependencies: { mainApp: 'healthy' } }
    : { status: 'not ready', dependencies: { mainApp: 'unhealthy' } };

  healthCache.ready = { data: payload, expiresAt: now + HEALTH_CACHE_MS };
  return payload;
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.get('/health', async (_req, res): Promise<void> => {
  const payload = await getOverallHealth();
  res.status(payload.status === 'healthy' ? 200 : 503).json(payload);
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive' });
});

// Readiness should probe downstream dependencies
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.get('/health/ready', async (_req, res) => {
  const payload = await getReadiness();
  res.status(payload.status === 'ready' ? 200 : 503).json(payload);
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

const keepAliveAgents = {
  http: new http.Agent({ keepAlive: true, maxSockets: 128 }),
  https: new https.Agent({ keepAlive: true, maxSockets: 128 }),
};

function getAgentForTarget(target: string): http.Agent | https.Agent {
  return target.startsWith('https') ? keepAliveAgents.https : keepAliveAgents.http;
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
    agent: getAgentForTarget(target),
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

  // Validate token is non-empty after extraction
  if (!token || token.trim().length === 0) {
    res.status(401).json({
      error: 'Unauthorized',
      message: token === '' ? 'Authorization header contains empty Bearer token' : 'No token provided',
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
  createProxy({ target: PLUGIN_ENGINE_URL, pathRewrite: { '^/api/plugins': '/plugins' }, timeout: 30000 })
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

// Users manager routes (admin panel)
app.use(
  '/api/users-manager',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/users-manager': '/api/users-manager' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// Dashboard stats routes (admin panel)
app.use(
  '/api/dashboard',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/dashboard': '/api/dashboard' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// Analytics routes (admin only, protected by JWT and RBAC in main-app)
app.use(
  '/api/analytics',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/analytics': '/api/analytics' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// (removed) Previous proxy to main-app for /api/plugins to avoid duplicate registrations

// Public settings endpoint (no authentication required, no JWT middleware)
// Handle OPTIONS preflight separately before proxy
app.options('/api/public-settings', (req, res) => {
  const origin = req.header('Origin');
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

// Middleware to add CORS headers to proxied responses
const corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.header('Origin');
  if (origin && corsOrigins.includes(origin)) {
    // Add CORS headers to the response
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = (name: string, value: string | number | readonly string[]) => {
      if (name.toLowerCase() === 'access-control-allow-origin') {
        // Don't override if already set
        return res;
      }
      return originalSetHeader(name, value);
    };

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  next();
};

// Create custom proxy with CORS support for public-settings
const publicSettingsProxyOptions: Options = {
  target: MAIN_APP_URL,
  changeOrigin: true,
  logLevel: 'warn',
  pathRewrite: { '^/api/public-settings': '/api/public-settings' },
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req) => {
    // Set internal gateway token
    proxyReq.setHeader('X-Internal-Token', INTERNAL_GATEWAY_TOKEN);
    // Propagate request id
    const rid = req.headers['x-request-id'];
    if (rid) {
      proxyReq.setHeader('x-request-id', Array.isArray(rid) ? rid[0] : String(rid));
    }
  },
  onProxyRes: (_proxyRes, req, res) => {
    // Add CORS headers to the proxied response
    const origin = req.header('Origin');
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
    }
  },
  onError: (err, req, res) => {
    logger.error('Proxy error for public-settings', err);
    // Add CORS headers even on proxy errors
    const origin = req.header('Origin');
    if (origin && corsOrigins.includes(origin)) {
      logger.info('Setting CORS headers for failed request', { origin });
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    // Return a proper error response
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
};

app.use(
  '/api/public-settings',
  corsMiddleware,
  createProxyMiddleware(publicSettingsProxyOptions) as unknown as express.RequestHandler
);

// Public menus endpoint (allows frontend to fetch navigation without auth)
app.options('/api/public-menus', (req, res) => {
  const origin = req.header('Origin');
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.options('/api/public-menus/:slug', (req, res) => {
  const origin = req.header('Origin');
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

const publicMenusProxyOptions: Options = {
  target: MAIN_APP_URL,
  changeOrigin: true,
  logLevel: 'warn',
  pathRewrite: { '^/api/public-menus': '/api/public-menus' },
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('X-Internal-Token', INTERNAL_GATEWAY_TOKEN);
    const rid = req.headers['x-request-id'];
    if (rid) {
      proxyReq.setHeader('x-request-id', Array.isArray(rid) ? rid[0] : String(rid));
    }
  },
  onProxyRes: (_proxyRes, req, res) => {
    const origin = req.header('Origin');
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
    }
  },
  onError: (err, req, res) => {
    logger.error('Proxy error for public-menus', err);
    const origin = req.header('Origin');
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', String(corsCredentials));
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
};

app.use(
  '/api/public-menus',
  corsMiddleware,
  createProxyMiddleware(publicMenusProxyOptions) as unknown as express.RequestHandler
);

// Authenticated settings endpoints
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

// Taxonomy routes (vocabularies and terms management)
app.use(
  '/api/taxonomy',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/taxonomy': '/api/taxonomy' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// Menu manager routes
app.use(
  '/api/menus',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/menus': '/api/menus' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// Public blog routes (no authentication required)
app.use(
  '/api/blog/public',
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/blog/public': '/api/blog/public' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// Blog routes (protected)
app.use(
  '/api/blog',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/api/blog': '/api/blog' },
    includeForwardingHeaders: true,
    timeout: 30000
  })
);

// SSDD Validator plugin routes
app.use(
  '/api/ssdd-validator',
  jwtMiddleware,
  createProxy({
    target: PLUGIN_ENGINE_URL,
    pathRewrite: { '^/api/ssdd-validator': '/api/ssdd-validator' },
    includeForwardingHeaders: true,
    timeout: 45000 // Longer timeout for USPS/geocoding operations
  })
);

// Admin Files routes (file management)
app.use(
  '/admin/files',
  jwtMiddleware,
  createProxy({
    target: MAIN_APP_URL,
    pathRewrite: { '^/admin/files': '/admin/files' },
    includeForwardingHeaders: true,
    timeout: 60000 // Longer timeout for file uploads
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

if (isSentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = 500;

  logger.error('Request error', err, {
    requestId: req.id,
    method: req.method,
    url: req.url,
    statusCode,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
