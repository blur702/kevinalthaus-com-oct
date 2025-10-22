import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import crypto from 'crypto';

const useConnString = !!process.env.DATABASE_URL;

// Validate database password when not using connection string
if (!useConnString && !process.env.POSTGRES_PASSWORD) {
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
  console.info('[DB] Using', useConnString ? 'DATABASE_URL' : 'individual env vars', 'for database configuration');
}

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
    console.log('[DB] Query executed', {
      queryHash,
      duration: `${duration}ms`,
      rowCount: result.rowCount,
    });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const sanitizedError = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DB] Query error', {
      queryHash,
      duration: `${duration}ms`,
      error: sanitizedError,
    });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
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
