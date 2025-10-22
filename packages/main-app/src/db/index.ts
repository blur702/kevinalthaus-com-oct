import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const useConnString = !!process.env.DATABASE_URL;
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

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    console.log('[DB] Query executed', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[DB] Query error', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      error,
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
