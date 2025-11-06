// Load environment variables from root .env file first, before any other imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import app from './index';
import { Server } from 'http';
import { createLogger, LogLevel, ensurePortAvailable } from '@monorepo/shared';

// Validate and extract log level from environment
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL;
  const validLevels = Object.values(LogLevel);
  if (envLevel && validLevels.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  return LogLevel.INFO;
}

// Validate and extract log format from environment
function getLogFormat(): 'json' | 'text' {
  const envFormat = process.env.LOG_FORMAT;
  if (envFormat === 'json' || envFormat === 'text') {
    return envFormat;
  }
  return 'text';
}

const logger = createLogger({
  level: getLogLevel(),
  service: 'api-gateway',
  format: getLogFormat(),
});

const PORT = Number(process.env.API_GATEWAY_PORT || process.env.PORT || 3000);

// Validate PORT is a valid number in range
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  logger.error(
    'Invalid PORT value',
    new Error(`PORT must be an integer between 1 and 65535, got: ${PORT}`)
  );
  process.exit(1);
}
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

// Ensure port is available before starting server
let server: Server;

async function startServer(): Promise<void> {
  try {
    // Check and kill any existing process on this port
    await ensurePortAvailable({
      port: PORT,
      serviceName: 'API Gateway',
      killExisting: true,
    });

    server = app
      .listen(PORT, () => {
        logger.info(`API Gateway server running on port ${PORT}`);
      })
      .on('error', (err: Error) => {
        logger.error('Failed to start API Gateway', err);
        process.exit(1);
      });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to ensure port availability', err);
    process.exit(1);
  }
}

// Start the server
startServer().catch((err) => {
  logger.error('Unhandled error during server startup', err);
  process.exit(1);
});

function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}. Shutting down API Gateway...`);
  const timer = setTimeout(() => {
    logger.warn('Forcing API Gateway shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  server.close((err?: Error) => {
    if (err) {
      logger.error('Error closing API Gateway server', err);
      clearTimeout(timer);
      process.exit(1);
    }
    clearTimeout(timer);
    logger.info('API Gateway shutdown complete');
    process.exit(0);
  });
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception in API Gateway - exiting immediately', err);
  // Node.js recommends immediate exit after uncaught exception
  // Use setImmediate to ensure log is flushed before exit
  setImmediate(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  // Normalize rejection reason to Error for consistent logging
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled Rejection in API Gateway - exiting immediately', err);
  // Mirror uncaughtException behavior: exit immediately after logging
  // Use setImmediate to ensure log is flushed before exit
  setImmediate(() => process.exit(1));
});
