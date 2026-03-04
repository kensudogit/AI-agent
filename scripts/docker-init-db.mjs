#!/usr/bin/env node
/**
 * Docker 用: PostgreSQL に schema.sql を実行する（tsx 不要）
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME
    ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME}`
    : null);

if (!connectionString) {
  console.warn('DATABASE_URL or DB_* not set, skipping schema init.');
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  const schemaPath = join(__dirname, '../src/lib/schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  await pool.query(sql);
  console.log('Database schema initialized.');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Schema init error:', err.message);
  process.exit(1);
});
