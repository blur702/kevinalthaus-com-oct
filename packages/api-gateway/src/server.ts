// Load environment variables from root .env file first, before any other imports
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Robust .env discovery: search upward from multiple start points
function findEnv(startDir: string, maxUp = 6): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < maxUp; i++) {
    const candidate = path.join(dir, '.env');
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {
      // ignore and continue
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

const candidates = [process.cwd(), __dirname];
let loaded = false;
for (const start of candidates) {
  const found = findEnv(start, 8);
  if (found) {
    const result = dotenv.config({ path: found });
    if (!result.error) {
      loaded = true;
      // avoid noisy console in production; use logger later
      // eslint-disable-next-line no-console
      console.log('Loaded .env from:', found);
      break;
    }
  }
}

if (!loaded) {
  // If no .env found, only continue if required vars are present in environment
  const required = ['JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Failed to locate .env and required env vars are missing:', missing.join(', '));
    process.exit(1);
  }
}

import app from './index';
import { Server } from 'http';
import { createLogger, LogLevel } from '@monorepo/shared';

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

function startServer(): void {
  try {
    // TEMPORARILY DISABLED: Port check has bug reporting PID: 0
    // await ensurePortAvailable({
    //   port: PORT,
    //   serviceName: 'API Gateway',
    //   killExisting: true,
    // });

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
try {
  startServer();
} catch (err) {
  logger.error('Unhandled error during server startup', err as Error);
  process.exit(1);
}

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
