// Load environment variables from root .env file first, before any other imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import app from './index';
import { Server } from 'http';
import { runMigrations } from './db/migrations';
import { pool, closePool } from './db';
import { createLogger, LogLevel, PORTS, ensurePortAvailable } from '@monorepo/shared';
import { ensureUploadDirectory } from './middleware/upload';
import { initializeRedisRateLimiter, closeRedisRateLimiter } from './middleware/rateLimitRedis';
import { secretsService } from './services/secretsService';
import { settingsCacheService } from './services/settingsCacheService';
import { BlogService } from './services/BlogService';
import { EditorService } from './services/EditorService';
import { TaxonomyService } from './services/TaxonomyService';
import { StorageService } from './services/StorageService';

function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL;
  const valid = Object.values(LogLevel);
  if (envLevel && valid.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  return LogLevel.INFO;
}

function getLogFormat(): 'json' | 'text' {
  const envFormat = process.env.LOG_FORMAT;
  return envFormat === 'json' || envFormat === 'text' ? envFormat : 'text';
}

const logger = createLogger({
  level: getLogLevel(),
  service: 'main-app',
  format: getLogFormat(),
});

const PORT = Number(process.env.MAIN_APP_PORT || process.env.PORT || PORTS.MAIN_APP);

// Validate PORT is a valid number in range
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  logger.error(
    'Invalid PORT value',
    new Error(`PORT must be an integer between 1 and 65535, got: ${PORT}`)
  );
  process.exit(1);
}

// Validate JWT secret is provided and non-empty
if (
  process.env.NODE_ENV !== 'test' &&
  (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).trim() === '')
) {
  logger.error('Missing JWT_SECRET environment variable', new Error('JWT_SECRET is required'));
  process.exit(1);
}

const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

let server: Server | undefined;
let isShuttingDown = false; // Idempotency guard for graceful shutdown

// Initialize Blog Service
export const blogService = new BlogService(pool);

// Initialize Editor Service
export const editorService = new EditorService();

// Initialize Taxonomy Service
export const taxonomyService = new TaxonomyService(pool);

// Initialize Storage Service
export const storageService = new StorageService('./storage', pool);

// Initialize services (Vault, Redis, Email, Settings Cache, Blog, Storage)
async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing services...');

    // Initialize Redis rate limiter
    initializeRedisRateLimiter();
    logger.info('Redis rate limiter initialized');

    // Initialize Vault secrets service
    try {
      await secretsService.initialize();
      logger.info('Vault secrets service initialized');
    } catch (error) {
      logger.warn(`Vault initialization failed - will use fallback mechanisms: ${(error as Error).message}`);
      // Don't exit - service will use environment variable fallbacks
    }

    // Initialize email service (lazy initialization on first use)
    logger.info('Email service ready (will initialize on first use)');

    // Initialize settings cache
    try {
      await settingsCacheService.refreshCache();
      logger.info('Settings cache initialized');
    } catch (error) {
      logger.warn(`Settings cache initialization failed - will use defaults: ${(error as Error).message}`);
      // Don't exit - service will use secure defaults
    }

    // Initialize blog service
    try {
      await blogService.initialize();
      logger.info('Blog service initialized');
    } catch (error) {
      logger.warn(`Blog service initialization failed: ${(error as Error).message}`);
      // Don't exit - service will handle errors gracefully
    }

    // Initialize editor service
    try {
      await editorService.initialize();
      logger.info('Editor service initialized');
    } catch (error) {
      logger.warn(`Editor service initialization failed: ${(error as Error).message}`);
      // Don't exit - service will handle errors gracefully
    }

    // Initialize taxonomy service
    try {
      await taxonomyService.initialize();
      logger.info('Taxonomy service initialized');
    } catch (error) {
      logger.warn(`Taxonomy service initialization failed: ${(error as Error).message}`);
      // Don't exit - service will handle errors gracefully
    }

    // Initialize storage service
    try {
      await storageService.initialize();
      logger.info('Storage service initialized');
    } catch (error) {
      logger.warn(`Storage service initialization failed: ${(error as Error).message}`);
      // Don't exit - service will handle errors gracefully
    }

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', error as Error);
    // Don't throw - services have fallback mechanisms
  }
}

// Initialize database and start server
async function start(): Promise<void> {
  try {
    // Ensure port is available before starting
    await ensurePortAvailable({
      port: PORT,
      serviceName: 'Main App',
      killExisting: true,
    });

    // Initialize upload directory before starting server
    await ensureUploadDirectory();
    logger.info('Upload directory initialized');

    // Run database migrations
    await runMigrations();
    logger.info('Database migrations completed');

    // Initialize services
    await initializeServices();

    // Start server
    server = app
      .listen(PORT, () => {
        logger.info(`Main app server running on port ${PORT}`);
      })
      .on('error', (err: Error) => {
        logger.error('Failed to start server', err, {
          port: PORT,
          stack: err.stack,
        });
        process.exit(1);
      });
  } catch (error) {
    logger.error('Failed to start application', error as Error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void start();
}

// Graceful shutdown handler
function gracefulShutdown(signal: string): void {
  // Idempotency guard: prevent concurrent shutdowns
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Capture timeout timer so we can clear it if shutdown completes successfully
  const shutdownTimer = setTimeout(() => {
    logger.warn('Forcing shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  // Check if server exists before attempting to close
  if (!server) {
    logger.warn('Server not initialized, skipping server.close()');

    // Close Redis and database pool directly
    closeRedisRateLimiter()
      .then(() => {
        logger.info('Redis rate limiter closed');
        return closePool();
      })
      .then(() => {
        logger.info('Database pool closed');
        clearTimeout(shutdownTimer);
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Error during shutdown', error as Error);
        clearTimeout(shutdownTimer);
        process.exit(1);
      });
    return;
  }

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', err);
      clearTimeout(shutdownTimer); // Clear timeout even on error
      process.exit(1);
    }

    logger.info('Server closed successfully');

    // Close Redis rate limiter
    closeRedisRateLimiter()
      .then(() => {
        logger.info('Redis rate limiter closed');

        // Close database pool
        return closePool();
      })
      .then(() => {
        logger.info('Database pool closed');
        clearTimeout(shutdownTimer); // Clear timeout on successful shutdown
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Error during shutdown', error as Error);
        clearTimeout(shutdownTimer);
        process.exit(1);
      });
  });
}

// Register signal handlers for graceful shutdown
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  process.exit(1); // Exit immediately after logging, no cleanup attempt
});

process.on('unhandledRejection', (reason, promise) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled Rejection', err, { promise: String(promise) });
  // Exit immediately after logging per Node.js guidance to avoid undefined state
  process.exit(1);
});

// Export getter function instead of potentially undefined server instance
export function getServer(): Server | undefined {
  return server;
}
