import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

declare global {
  var _pgPool: Pool | undefined;
}

const createPool = (): Pool => {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
};

// Singleton pool to prevent exhausting connections in dev (Next.js hot reload)
const pool: Pool = global._pgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') global._pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('[DB]', { text: text.slice(0, 80), duration: `${duration}ms`, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    console.error('[DB Error]', { text: text.slice(0, 80), error: err });
    throw err;
  }
}

export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
