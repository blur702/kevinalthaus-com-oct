import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { timingSafeEqual, createHash } from 'crypto';
import { Server } from 'http';
import { Pool } from 'pg';

import { createLogger, LogLevel, Role, ensurePortAvailable, config } from '@monorepo/shared';

// Plugin context interface
interface PluginContext {
  app: express.Application;
  db: Pool;
  logger: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, err?: Error | unknown, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
  services: {
    blog: null;
    editor: null;
    taxonomy: null;
    email: null;
  };
  config: Record<string, unknown>;
}

// Dynamic SSDD Validator plugin loader
let SSDDValidatorPlugin: { new (): { onActivate(context: PluginContext): Promise<void> } };
(function resolvePlugin() {
  try {
    const explicitPath = config.PLUGIN_SSDD_PATH?.trim();
    const defaultPath = require('path').resolve(__dirname, '../../../plugins/ssdd-validator/dist/index');
    const mod = require(explicitPath || defaultPath);
    SSDDValidatorPlugin = (mod && (mod.default || mod)) || null;
    if (!SSDDValidatorPlugin) {
      throw new Error('Plugin module did not export a default constructor');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[plugin-engine] Failed to resolve SSDD Validator plugin module', e);
    process.exit(1);
  }
})();

const app = express();

// Initialize logger
const logger = createLogger({
  level: LogLevel.INFO,
  format: 'text',
  service: 'plugin-engine',
});

// Initialize database connection for plugins
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error('[plugin-engine] DATABASE_URL is required');
  process.exit(1);
}

// Create PG pool after validating env and logger is ready
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
pool.on('error', (err) => {
  logger.error('[plugin-engine] PG pool error', err as unknown as Error);
});

const PORT = Number(config.PLUGIN_ENGINE_PORT ?? 3004);
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

// Internal gateway token for service-to-service authentication
const INTERNAL_GATEWAY_TOKEN = process.env.INTERNAL_GATEWAY_TOKEN;
if (!INTERNAL_GATEWAY_TOKEN && config.NODE_ENV !== 'development' && config.NODE_ENV !== 'test') {
  throw new Error(
    'INTERNAL_GATEWAY_TOKEN is required for plugin-engine in production. Must match the token configured in API Gateway.'
  );
}

// Middleware to verify requests come from the API gateway
function verifyInternalToken(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip verification in development/test if token not configured
  if (!INTERNAL_GATEWAY_TOKEN && (config.NODE_ENV === 'development' || config.NODE_ENV === 'test')) {
    next();
    return;
  }

  const headerVal = req.headers['x-internal-token'];
  const provided = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const providedStr = typeof provided === 'string' ? provided : '';
  const expectedStr = INTERNAL_GATEWAY_TOKEN || '';

  // Require non-empty tokens before hashing
  if (!providedStr || !expectedStr) {
    // eslint-disable-next-line no-console
    console.warn('[plugin-engine] Unauthorized direct access attempt - empty token', {
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

  // Hash both tokens to standardize with main-app and ensure fixed-length comparison
  const providedHash = createHash('sha256').update(providedStr).digest();
  const expectedHash = createHash('sha256').update(expectedStr).digest();

  // Use timing-safe comparison on hashed values
  let valid = false;
  try {
    valid = timingSafeEqual(providedHash, expectedHash);
  } catch {
    // timingSafeEqual throws if buffers have different lengths (should never happen with hashes)
    valid = false;
  }

  if (!valid) {
    // eslint-disable-next-line no-console
    console.warn('[plugin-engine] Unauthorized direct access attempt', {
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

app.use(morgan('combined'));
app.use(helmet());
// CORS disabled - service is internal and protected by API gateway
// app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '256kb' }));

// Verify internal token on all requests except health checks
app.use((req, res, next) => {
  if (req.path === '/health') {
    next();
  } else {
    verifyInternalToken(req, res, next);
  }
});

// Extract user context from X-User-* headers (set by API gateway)
app.use((req, _res, next) => {
  const rawUserId = req.headers['x-user-id'];
  const rawUserRole = req.headers['x-user-role'];
  const rawUserEmail = req.headers['x-user-email'];

  const userId = typeof rawUserId === 'string' ? rawUserId.trim() : Array.isArray(rawUserId) ? String(rawUserId[0]).trim() : '';
  const userEmail = typeof rawUserEmail === 'string' ? rawUserEmail.trim() : Array.isArray(rawUserEmail) ? String(rawUserEmail[0]).trim() : '';
  const roleHeader = typeof rawUserRole === 'string' ? rawUserRole.trim() : Array.isArray(rawUserRole) ? String(rawUserRole[0]).trim() : '';

  if (userId && userEmail && userId.toLowerCase() !== 'undefined' && userEmail.toLowerCase() !== 'undefined' && userId.toLowerCase() !== 'null' && userEmail.toLowerCase() !== 'null') {
    let roleValue: Role | undefined;
    if (roleHeader) {
      const roleStr = roleHeader.toUpperCase();
      const validRoles = new Set<string>(Object.values(Role) as string[]);
      if (validRoles.has(roleStr)) {
        roleValue = roleStr as Role;
      } else {
        // eslint-disable-next-line no-console
        console.warn('[plugin-engine] Invalid x-user-role received, ignoring', { roleStr });
      }
    }
    req.user = {
      id: userId,
      ...(roleValue ? { role: roleValue } : {}),
      email: userEmail,
    } as any;
  }
  next();
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildMetadata(args: unknown[]): Record<string, unknown> | undefined {
  if (args.length === 0) {
    return undefined;
  }

  if (args.length === 1 && isRecord(args[0])) {
    return args[0];
  }

  const metadata: Record<string, unknown> = {};

  args.forEach((arg, index) => {
    const key = `arg${index}`;
    if (isRecord(arg)) {
      metadata[key] = arg;
    } else if (arg instanceof Error) {
      metadata[key] = {
        message: arg.message,
        stack: arg.stack,
      };
    } else {
      metadata[key] = arg;
    }
  });

  return metadata;
}


// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'plugin-engine' });
});

// Load and activate SSDD Validator plugin
async function loadPlugins(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('[plugin-engine] Loading SSDD Validator plugin...');

    const plugin = new SSDDValidatorPlugin();
    const context: PluginContext = {
      app,
      db: pool,
      logger: {
        info: (message: string, ...args: unknown[]) => logger.info(message, buildMetadata(args)),
        warn: (message: string, ...args: unknown[]) => logger.warn(message, buildMetadata(args)),
        error: (message: string, err?: Error | unknown, ...args: unknown[]) => {
          logger.error(message, err, buildMetadata(args));
        },
        debug: (message: string, ...args: unknown[]) => logger.debug(message, buildMetadata(args)),
      },
      services: {
        blog: null,
        editor: null,
        taxonomy: null,
        email: null,
      },
      config: {},
    };

    // Activate the plugin (this registers its routes)
    await plugin.onActivate(context);

    // eslint-disable-next-line no-console
    console.log('[plugin-engine] SSDD Validator plugin loaded successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[plugin-engine] Failed to load SSDD Validator plugin:', error);
    process.exit(1);
  }
}

// Simple echo to validate proxy path: /plugins/*
app.all('/plugins/*', (req, res) => {
  res.json({
    message: 'Plugin Engine stub',
    method: req.method,
    path: req.path,
    body: req.body as unknown,
  });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Plugin Engine', version: '1.0.0' });
});

// Validate PORT is a valid number in range
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  // eslint-disable-next-line no-console
  console.error(`[plugin-engine] Invalid PORT value. PORT must be an integer between 1 and 65535, got: ${PORT}`);
  process.exit(1);
}

// Quick DB connectivity check before starting
async function verifyDbConnectivity(): Promise<void> {
  try {
    await pool.query('SELECT 1');
    // eslint-disable-next-line no-console
    logger.info('[plugin-engine] Database connectivity OK');
  } catch (err) {
    // eslint-disable-next-line no-console
    logger.error('[plugin-engine] Database connectivity check failed', err as Error);
    process.exit(1);
  }
}

// Start server with proper error handling
let server: Server;

async function startServer(): Promise<void> {
  try {
    await ensurePortAvailable({
      port: PORT,
      serviceName: 'Plugin Engine',
      killExisting: true,
    });

    // Verify DB connectivity before starting server
    try {
      await verifyDbConnectivity();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[plugin-engine] Database connectivity check failed during startup', error);
      process.exit(1);
    }

    // Load plugins before starting server
    try {
      await loadPlugins();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[plugin-engine] Failed to load plugins during startup', error);
      process.exit(1);
    }

    server = app
      .listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`[plugin-engine] listening on ${PORT}`);
      })
      .on('error', (err: Error) => {
        // eslint-disable-next-line no-console
        console.error('[plugin-engine] Failed to start server', err);
        process.exit(1);
      });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[plugin-engine] Failed to ensure port availability', error);
    process.exit(1);
  }
}

// Start the server
void startServer();

// Graceful shutdown handler
function gracefulShutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`[plugin-engine] Received ${signal}. Shutting down...`);
  const timer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.warn('[plugin-engine] Forcing shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  server.close((err?: Error) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[plugin-engine] Error closing server', err);
      clearTimeout(timer);
      process.exit(1);
    }
    // Close DB pool
    void pool
      .end()
      .then(() => {
        clearTimeout(timer);
        // eslint-disable-next-line no-console
        console.log('[plugin-engine] Shutdown complete');
        process.exit(0);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[plugin-engine] Error closing DB pool', e);
        clearTimeout(timer);
        process.exit(1);
      });
  });
}

// Signal handlers
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

// Global error handlers
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[plugin-engine] Uncaught Exception - exiting immediately', err);
  // Node.js recommends immediate exit after uncaught exception
  // Use setImmediate to ensure log is flushed before exit
  setImmediate(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  // Normalize rejection reason to Error for consistent logging
  const err = reason instanceof Error ? reason : new Error(String(reason));
  // eslint-disable-next-line no-console
  console.error('[plugin-engine] Unhandled Rejection - exiting immediately', err);
  // Mirror uncaughtException behavior: exit immediately after logging
  // Use setImmediate to ensure log is flushed before exit
  setImmediate(() => process.exit(1));
});
