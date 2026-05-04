/**
 * 全テーブルの行を JSON で標準出力（.env の DATABASE_URL または DB_* を利用）
 * 使い方: npx tsx scripts/dump-db.ts
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile() {
  const p = resolve(process.cwd(), '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const TABLES = [
  'conversations',
  'messages',
  'negotiation_sessions',
  'negotiation_messages',
] as const;

async function main() {
  loadEnvFile();
  const { query } = await import('../src/lib/db');

  const hasUrl = !!process.env.DATABASE_URL;
  const hasLocal =
    process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER || process.env.DB_PASSWORD;
  if (!hasUrl && !hasLocal) {
    console.error('DATABASE_URL または DB_HOST 等が .env にありません。');
    process.exit(1);
  }

  for (const table of TABLES) {
    const orderBy =
      table === 'conversations'
        ? 'updated_at DESC'
        : table === 'messages' || table === 'negotiation_messages'
          ? 'created_at DESC'
          : 'created_at DESC';
    const { rows } = await query(`SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT 500`);
    console.log(`\n========== ${table} (${rows.length} rows, max 500) ==========\n`);
    console.log(JSON.stringify(rows, null, 2));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
