import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

/**
 * Local Postgres often has SSL disabled; hosted DBs (Railway, RDS, Neon, …) need TLS.
 *
 * DATABASE_SSL=true|false — override everything
 * DATABASE_URL query: sslmode=disable | require | … (when parseable)
 * Otherwise: localhost / 127.* / *.local → no TLS; other hosts → TLS (cloud-style)
 */
function sslOptionForDatabaseUrl(url: string | undefined): boolean | { rejectUnauthorized: boolean } {
  const flag = process.env.DATABASE_SSL;
  if (flag === 'true') return { rejectUnauthorized: false };
  if (flag === 'false') return false;

  if (!url) return false;

  try {
    const normalized = url.replace(/^postgresql:/i, 'postgres:');
    const parsed = new URL(normalized);
    const sslmode = parsed.searchParams.get('sslmode')?.toLowerCase();
    if (sslmode === 'disable' || sslmode === 'allow') return false;
    if (sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full') {
      return { rejectUnauthorized: sslmode !== 'require' };
    }

    const host = (parsed.hostname || '').toLowerCase();
    const isLoopbackOrLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '' ||
      host.endsWith('.local');
    /** Typical docker-compose service names for Postgres without TLS */
    const isCommonDockerDbHost =
      host === 'postgres' || host === 'db' || host === 'database' || host === 'pgsql';

    if (isLoopbackOrLocal || isCommonDockerDbHost) return false;

    return { rejectUnauthorized: false };
  } catch {
    return { rejectUnauthorized: false };
  }
}

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: sslOptionForDatabaseUrl(connectionString),
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
