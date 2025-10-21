import app from './index';
import { Server } from 'http';
import { runMigrations } from './db/migrations';
import { closePool } from './db';

// Simple console logger until shared package is available
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args)
};

const PORT = process.env.MAIN_APP_PORT || process.env.PORT || 3001;
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

let server: Server;

// Initialize database and start server
async function start() {
  try {
    // Run database migrations
    await runMigrations();
    logger.info('Database migrations completed');

    // Start server
    server = app.listen(PORT, () => {
      logger.info(`Main app server running on port ${PORT}`);
    }).on('error', (err: Error) => {
      logger.error('Failed to start server:', {
        error: err.message,
        port: PORT,
        stack: err.stack
      });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Capture timeout timer so we can clear it if shutdown completes successfully
  const shutdownTimer = setTimeout(() => {
    logger.warn('Forcing shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  server.close(async (err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      clearTimeout(shutdownTimer); // Clear timeout even on error
      process.exit(1);
    }

    logger.info('Server closed successfully');

    // Close database pool
    try {
      await closePool();
      logger.info('Database pool closed');
    } catch (dbError) {
      logger.error('Error closing database pool:', dbError);
    }

    clearTimeout(shutdownTimer); // Clear timeout on successful shutdown
    process.exit(0);
  });
}

// Register signal handlers for graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1); // Exit immediately after logging, no cleanup attempt
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export { server };