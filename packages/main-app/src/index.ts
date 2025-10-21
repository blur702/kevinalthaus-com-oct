import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import {
  compressionMiddleware,
  rateLimitMiddleware,
  timingMiddleware,
  securityHeadersMiddleware,
  keepAliveMiddleware,
  cacheMiddleware
} from './middleware/performance';
import { authRouter, authMiddleware } from './auth';
import { requireRole } from './auth/rbac-middleware';
import { Role } from '@monorepo/shared';
import { usersRouter } from './users';
import { uploadsRouter } from './uploads';
import { healthCheck } from './db';
import { ensureUploadDirectory } from './middleware/upload';
import { discoverPlugins } from './plugins';
import { pluginManager } from './plugins/manager';
import { adminPluginsRouter } from './routes/adminPlugins';

// Simple console logger until shared package is available
const logger = {
  info: (message: string, ...args: unknown[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[WARN] ${message}`, ...args)
};

const app = express();

// Initialize upload directory
void (async () => {
  try {
    await ensureUploadDirectory();
    logger.info('Upload directory initialized');
  } catch (error) {
    logger.error('Failed to initialize upload directory:', error);
  }
})();

// Parse CORS_ORIGIN from environment
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'];

const corsCredentials = process.env.CORS_CREDENTIALS === 'true';

// Performance and security middleware (order matters)
app.use(timingMiddleware);
app.use(compressionMiddleware);
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

const helmetConfig: { contentSecurityPolicy?: { directives: typeof cspDirectives }; hsts?: typeof hstsSettings } = {};

if (process.env.HELMET_CSP_ENABLED === 'true') {
  helmetConfig.contentSecurityPolicy = { directives: cspDirectives };
}

if (process.env.HELMET_HSTS_ENABLED === 'true') {
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

// Health check endpoints
app.get('/health', async (_req, res) => {
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
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive' });
});

app.get('/health/ready', async (_req, res) => {
  const dbHealthy = await healthCheck();
  if (dbHealthy) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Kevin Althaus Main Application',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/uploads', uploadsRouter);

// Admin UI for plugin management
pluginManager.init(app);
app.use('/admin/plugins', authMiddleware, requireRole(Role.ADMIN), adminPluginsRouter);

// Discover plugins (manifests only for now)
void (async () => {
  try {
    await discoverPlugins(app);
  } catch (e) {
    logger.warn('Plugin discovery failed');
  }
})();

// 404 handler - must be after all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404
  });
});

// Global error handling middleware - must be last
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    statusCode: 500
  });
});

export default app;
