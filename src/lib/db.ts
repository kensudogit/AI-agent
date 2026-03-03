import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'ai_agent',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  const result = await pool.query(text, params);
  return { rows: result.rows as T[] };
}

export async function getPool(): Promise<Pool> {
  return pool;
}

export default pool;
