import app from './index';
import { Server } from 'http';
import { runMigrations } from './db/migrations';
import { closePool } from './db';
import { createLogger, LogLevel } from '@monorepo/shared';
import { ensureUploadDirectory } from './middleware/upload';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

const PORT = process.env.MAIN_APP_PORT || process.env.PORT || 3001;
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

let server: Server;
let isShuttingDown = false; // Idempotency guard for graceful shutdown

// Initialize database and start server
async function start(): Promise<void> {
  try {
    // Initialize upload directory before starting server
    await ensureUploadDirectory();
    logger.info('Upload directory initialized');

    // Run database migrations
    await runMigrations();
    logger.info('Database migrations completed');

    // Start server
    server = app.listen(PORT, () => {
      logger.info(`Main app server running on port ${PORT}`);
    }).on('error', (err: Error) => {
      logger.error('Failed to start server', err, {
        port: PORT,
        stack: err.stack
      });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start application', error as Error);
    process.exit(1);
  }
}

void start();

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
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

    // Close database pool directly
    closePool()
      .then(() => {
        logger.info('Database pool closed');
        clearTimeout(shutdownTimer);
        process.exit(0);
      })
      .catch((dbError) => {
        logger.error('Error closing database pool', dbError as Error);
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

    // Close database pool
    closePool()
      .then(() => {
        logger.info('Database pool closed');
        clearTimeout(shutdownTimer); // Clear timeout on successful shutdown
        process.exit(0);
      })
      .catch((dbError) => {
        logger.error('Error closing database pool', dbError as Error);
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
  void gracefulShutdown('unhandledRejection');
});

// Export getter function instead of potentially undefined server instance
export function getServer(): Server | undefined {
  return server;
}
