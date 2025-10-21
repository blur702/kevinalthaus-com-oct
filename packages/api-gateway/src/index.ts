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

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_generate_secure_random_string';
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
app.use(timingMiddleware);
app.use(compressionMiddleware);

// Configure Helmet with env toggles
const helmetConfig: helmet.HelmetOptions = {};

if (process.env.HELMET_CSP_ENABLED === 'true') {
  helmetConfig.contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  };
}

if (process.env.HELMET_HSTS_ENABLED === 'true') {
  helmetConfig.hsts = {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  };
}

app.use(helmet(helmetConfig));
app.use(securityHeadersMiddleware);
app.use(keepAliveMiddleware);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: corsCredentials,
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache middleware for GET requests
app.use(cacheMiddleware);

// Stricter rate limit for auth endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limit
app.use('/api/', rateLimitMiddleware);

// Health check endpoints
app.get('/health', async (_req, res) => {
  // Check downstream services
  const checks: Record<string, string> = {};

  try {
    const mainAppResponse = await fetch(`${MAIN_APP_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    checks.mainApp = mainAppResponse.ok ? 'healthy' : 'unhealthy';
  } catch {
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

app.get('/health/ready', (_req, res) => {
  res.json({ status: 'ready' });
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
    const decoded = jwt.verify(token, JWT_SECRET) as {
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

      // Forward user context headers if they exist
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

// Auth routes (no JWT required, but stricter rate limiting)
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