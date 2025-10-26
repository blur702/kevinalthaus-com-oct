import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const useConnString = !!process.env.DATABASE_URL;

// Validate database password when not using connection string (skip in tests)
if (!useConnString && !process.env.POSTGRES_PASSWORD && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'POSTGRES_PASSWORD environment variable is required when not using DATABASE_URL. ' +
      'Please set POSTGRES_PASSWORD in your .env file or provide a DATABASE_URL connection string.'
  );
}

// Parse PostgreSQL SSL mode from environment
function getSSLConfig(): boolean | { rejectUnauthorized: boolean; ca?: string } {
  const sslMode = process.env.PGSSLMODE || 'prefer';

  switch (sslMode) {
    case 'disable':
      return false;
    case 'prefer':
      // Try SSL but fall back to non-SSL if it fails
      return { rejectUnauthorized: false };
    case 'require':
      // Require SSL but don't verify the certificate
      return { rejectUnauthorized: false };
    case 'verify-ca':
    case 'verify-full': {
      // Require SSL and verify the certificate
      const ca = process.env.PGSSLROOTCERT;
      if (!ca) {
        throw new Error(
          `PGSSLROOTCERT is required when PGSSLMODE is '${sslMode}'. ` +
          'Provide the path to the root certificate file.'
        );
      }

      try {
        // Validate and sanitize the certificate path
        const resolvedPath = path.resolve(path.normalize(ca));

        // Ensure the path is absolute
        if (!path.isAbsolute(resolvedPath)) {
          throw new Error('PGSSLROOTCERT must be an absolute path');
        }

        // Check if file exists and is a regular file
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const stats = fs.statSync(resolvedPath);
        if (!stats.isFile()) {
          throw new Error('PGSSLROOTCERT must point to a regular file');
        }

        // Read the certificate file
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const caContent = fs.readFileSync(resolvedPath, 'utf8');
        return { rejectUnauthorized: true, ca: caContent };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(
            `SSL certificate file not found at PGSSLROOTCERT=${ca}`
          );
        }
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          throw new Error(
            `Permission denied reading SSL certificate at PGSSLROOTCERT=${ca}`
          );
        }
        throw new Error(
          `Failed to read SSL certificate from PGSSLROOTCERT=${ca}: ${(error as Error).message}`
        );
      }
    }
    default:
      throw new Error(
        `Invalid PGSSLMODE '${sslMode}'. ` +
        'Valid values: disable, prefer, require, verify-ca, verify-full'
      );
  }
}

const sslConfig = getSSLConfig();

const pool = new Pool(
  useConnString
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      }
    : {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'kevinalthaus',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
        ssl: sslConfig,
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      }
);

// Handle pool errors
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.info(
    '[DB] Using',
    useConnString ? 'DATABASE_URL' : 'individual env vars',
    'for database configuration'
  );
}

// Query fingerprint secret for HMAC (required in production)
const FINGERPRINT_SECRET = process.env.FINGERPRINT_SECRET;
if (!FINGERPRINT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'FINGERPRINT_SECRET environment variable is required in production for secure query fingerprinting. ' +
      'Please set FINGERPRINT_SECRET in your .env file to a secure random value.'
  );
}
const fingerprintSecret = FINGERPRINT_SECRET || 'dev-default-secret-change-me-in-production';

// Logging configuration for query execution
// LOG_LEVEL: controls verbosity (debug logs all queries, info/warn/error use sampling)
// QUERY_LOG_SAMPLE_RATE: log every Nth successful query (default: 10)
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const QUERY_LOG_SAMPLE_RATE = parseInt(process.env.QUERY_LOG_SAMPLE_RATE || '10', 10);

// Simple counter for sampling successful queries to reduce log noise in production
let queryCounter = 0;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  // Generate query fingerprint using HMAC for secure, non-reversible fingerprinting
  const queryHash = crypto.createHmac('sha256', fingerprintSecret).update(text).digest('hex').substring(0, 16);

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // Sample successful queries (log every Nth query to reduce noise in production)
    // In debug mode, log all queries for troubleshooting
    queryCounter++;
    if (LOG_LEVEL === 'debug' || queryCounter % QUERY_LOG_SAMPLE_RATE === 0) {
      // eslint-disable-next-line no-console
      console.log('[DB] Query executed', {
        queryHash,
        duration: `${duration}ms`,
        rowCount: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    // Sanitize error: strip SQL text and sensitive data from error messages
    // Never log the full error object which may contain query text or parameters
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Strip potential SQL fragments from error message
    let sanitizedMessage = errorMessage
      // Remove double-quoted strings
      .replace(/"[^"]*"/g, '[REDACTED]')
      // Remove single-quoted strings
      .replace(/'[^']*'/g, '[REDACTED]')
      // Remove backtick-quoted strings
      .replace(/`[^`]*`/g, '[REDACTED]')
      // Remove numeric literals
      .replace(/\b\d+(\.\d+)?\b/g, '[NUM]')
      // Remove SQL comments (-- style)
      .replace(/--[^\n]*/g, '')
      // Remove SQL comments (/* */ style)
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // Trim whitespace
    sanitizedMessage = sanitizedMessage.trim();

    console.error('[DB] Query error', {
      queryHash,
      duration: `${duration}ms`,
      error: sanitizedMessage,
      // SECURITY NOTE: Do NOT log: text, params, or full error object
      // These may contain sensitive data (passwords, tokens, PII)
    });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    const originalError = error;
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      // Log rollback error but do not mask the original
      // eslint-disable-next-line no-console
      console.error('[DB] ROLLBACK failed', rbErr);
    }
    throw originalError;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
