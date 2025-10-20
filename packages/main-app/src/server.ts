import app from './index';
import { logger } from '@monorepo/shared';
import { Server } from 'http';

const PORT = process.env.PORT || 3001;
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

// Start server and capture potential listen errors
const server: Server = app.listen(PORT, () => {
  logger.info(`Main app server running on port ${PORT}`);
}).on('error', (err: Error) => {
  logger.error('Failed to start server:', {
    error: err.message,
    port: PORT,
    stack: err.stack
  });
  process.exit(1);
});

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.warn('Forcing shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

// Register signal handlers for graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export { server };