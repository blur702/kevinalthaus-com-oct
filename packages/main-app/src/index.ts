import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import {
  compressionMiddleware,
  rateLimitMiddleware,
  timingMiddleware,
  securityHeadersMiddleware,
  keepAliveMiddleware,
  cacheMiddleware,
} from './middleware/performance';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { uploadsRouter } from './uploads';
import { healthCheck } from './db';
import { discoverPlugins } from './plugins';
import { pluginManager } from './plugins/manager';
import { pluginsRouter } from './routes/plugins';
import { adminPluginsRouter } from './routes/adminPlugins';
import { createLogger, LogLevel } from '@monorepo/shared';
import { asyncHandler } from './utils/asyncHandler';
import { requestIdMiddleware } from './middleware/requestId';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

// Internal gateway token for service-to-service authentication
const INTERNAL_GATEWAY_TOKEN = process.env.INTERNAL_GATEWAY_TOKEN;
if (!INTERNAL_GATEWAY_TOKEN && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'INTERNAL_GATEWAY_TOKEN is required for main-app in production. Must match the token configured in API Gateway.'
  );
}

// Middleware to verify requests come from the API gateway
function verifyInternalToken(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip verification in development/test if token not configured
  if (!INTERNAL_GATEWAY_TOKEN && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
    next();
    return;
  }

  const headerVal = req.headers['x-internal-token'];
  const providedToken = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const normalized = typeof providedToken === 'string' ? providedToken.trim() : '';

  // Use timing-safe comparison to prevent timing attacks
  // Hash both tokens to ensure fixed-length comparison
  const expectedHash = crypto.createHash('sha256').update(INTERNAL_GATEWAY_TOKEN || '').digest();
  const providedHash = crypto.createHash('sha256').update(normalized).digest();

  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(expectedHash, providedHash);
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    // In this case, tokens don't match
    isValid = false;
  }

  if (!isValid) {
    logger.warn('Unauthorized direct access attempt - missing or invalid internal token', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Direct access to this service is not allowed',
    });
    return;
  }

  next();
}

const app = express();

// Trust proxy configuration - can be number of hops, specific IPs, or CIDR ranges
// Defaults to 1 (first proxy hop) for typical reverse proxy setup
// Set TRUST_PROXY env var to customize (e.g., "1", "loopback", or specific IPs/CIDRs)
const trustProxyConfig = process.env.TRUST_PROXY
  ? Number.isNaN(Number(process.env.TRUST_PROXY))
    ? process.env.TRUST_PROXY
    : Number(process.env.TRUST_PROXY)
  : 1;
app.set('trust proxy', trustProxyConfig);

// Parse CORS_ORIGIN from environment
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'];

const corsCredentials = process.env.CORS_CREDENTIALS === 'true';

// Startup validation: reject wildcard CORS with credentials
if (corsOrigins.includes('*') && corsCredentials) {
  logger.error(
    'FATAL: Invalid CORS configuration detected. CORS_ORIGIN includes wildcard (*) while CORS_CREDENTIALS is true. ' +
    'This is a security violation - browsers will reject this configuration. ' +
    'Either remove the wildcard from CORS_ORIGIN or set CORS_CREDENTIALS=false.'
  );
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

// Performance and security middleware (order matters)
app.use(requestIdMiddleware);
app.use(compressionMiddleware);
app.use(timingMiddleware);
app.use(rateLimitMiddleware);

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

const helmetConfig: {
  contentSecurityPolicy?: { directives: typeof cspDirectives };
  hsts?: typeof hstsSettings;
} = {};

const isProduction = process.env.NODE_ENV === 'production';

// In production, CSP and HSTS default to enabled unless explicitly disabled
// In development, they must be explicitly enabled
const cspEnabled = isProduction
  ? process.env.HELMET_CSP_ENABLED !== 'false'
  : process.env.HELMET_CSP_ENABLED === 'true';

const hstsEnabled = isProduction
  ? process.env.HELMET_HSTS_ENABLED !== 'false'
  : process.env.HELMET_HSTS_ENABLED === 'true';

// Warn if security features are disabled in production
if (isProduction) {
  if (!cspEnabled) {
    logger.warn('Content Security Policy (CSP) is explicitly disabled in production. This is not recommended.');
  }
  if (!hstsEnabled) {
    logger.warn('HTTP Strict Transport Security (HSTS) is explicitly disabled in production. This is not recommended.');
  }
}

if (cspEnabled) {
  helmetConfig.contentSecurityPolicy = { directives: cspDirectives };
}

if (hstsEnabled) {
  helmetConfig.hsts = hstsSettings;
}

// Apply helmet with configuration if any options are set, otherwise use defaults
if (Object.keys(helmetConfig).length > 0) {
  app.use(helmet(helmetConfig));
} else {
  app.use(helmet());
}
app.use(securityHeadersMiddleware);
app.use(keepAliveMiddleware);
  app.use(
    cors((req, callback) => {
      const allowAll = corsOrigins.includes('*');

      // Handle wildcard origin
      if (allowAll) {
        if (corsCredentials) {
          // Reject wildcard with credentials - security violation
          // Browsers will block this, so we must reject the configuration
          callback(null, { origin: false, credentials: false });
          return;
        }
        // Allow wildcard without credentials
        callback(null, { origin: true, credentials: false });
        return;
      }

      // Non-wildcard: check specific origin against allowlist
      const origin = req.header('Origin');
      let isAllowed = false;

      if (origin) {
        // Request has Origin header - check if it's in allowlist
        isAllowed = corsOrigins.includes(origin);
      }

      // Only send credentials when origin is allowed
      const credentialsForResponse = isAllowed ? corsCredentials : false;
      callback(null, { origin: isAllowed, credentials: credentialsForResponse });
    })
  );
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' })); // Reduced from 10mb to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '100kb' })); // Reduced from 10mb
app.use(cookieParser());

// Cache middleware for GET requests
app.use(cacheMiddleware);

// Verify internal token on all requests except health checks
// Health checks need to be accessible for container orchestration
app.use((req, res, next) => {
  const allowedHealthPaths = ['/health', '/health/', '/health/live', '/health/ready'];
  if (allowedHealthPaths.includes(req.path)) {
    next();
  } else {
    verifyInternalToken(req, res, next);
  }
});

// Health check endpoints
app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const dbHealthy = await healthCheck();
    const status = dbHealthy ? 'healthy' : 'degraded';

    res.status(dbHealthy ? 200 : 503).json({
      status,
      service: 'main-app',
      timestamp: new Date().toISOString(),
      version: process.env.VERSION || '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
      },
    });
  })
);

app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive' });
});

app.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    const dbHealthy = await healthCheck();
    if (dbHealthy) {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  })
);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Kevin Althaus Main Application',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/uploads', uploadsRouter);
// pluginsRouter already has authMiddleware and requireRole(Role.ADMIN) applied at line 37 of routes/plugins.ts
app.use('/api/plugins', pluginsRouter);

// Admin UI for plugin management
pluginManager.init(app);
app.use('/admin/plugins', adminPluginsRouter);

// Discover plugins (manifests only for now)
void (async () => {
  try {
    await discoverPlugins(app);
  } catch (e) {
    logger.error('Plugin discovery failed', e as Error, {
      message: (e as Error).message,
      stack: (e as Error).stack,
    });
    // Consider exiting if plugin discovery is critical for your application
    // process.exit(1);
  }
})();

// 404 handler - must be after all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404,
  });
});

// Global error handling middleware - must be last
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err, {
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  const isLocalDev =
    process.env.NODE_ENV === 'development' && (process.env.DEPLOY_ENV ?? 'local') === 'local';
  const body: Record<string, unknown> = {
    error: 'Internal Server Error',
    statusCode: 500,
  };
  if (isLocalDev) {
    body.message = err.message || 'Unknown error';
    body.stack = err.stack;
  } else {
    body.message = 'Something went wrong';
  }

  res.status(500).json(body);
});

export default app;
