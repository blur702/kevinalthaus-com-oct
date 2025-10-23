import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import crypto from 'crypto';

const useConnString = !!process.env.DATABASE_URL;

// Validate database password when not using connection string (skip in tests)
if (!useConnString && !process.env.POSTGRES_PASSWORD && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'POSTGRES_PASSWORD environment variable is required when not using DATABASE_URL. ' +
      'Please set POSTGRES_PASSWORD in your .env file or provide a DATABASE_URL connection string.'
  );
}

const pool = new Pool(
  useConnString
    ? {
        connectionString: process.env.DATABASE_URL,
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
  // Generate query fingerprint for correlation without exposing sensitive data
  const queryHash = crypto.createHash('sha256').update(text).digest('hex').substring(0, 12);

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
    // Strip potential SQL fragments from error message (common in syntax errors)
    // Replace quoted strings which often contain SQL snippets
    const sanitizedMessage = errorMessage.replace(/".*?"/g, '[SQL_REDACTED]');

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
