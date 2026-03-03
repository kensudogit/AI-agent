import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../src/lib/db';

async function main() {
  const sql = readFileSync(join(__dirname, '../src/lib/schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Database schema initialized.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
