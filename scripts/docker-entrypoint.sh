#!/bin/sh
set -e

# PostgreSQL の起動を待つ
echo "Waiting for PostgreSQL..."
until node -e "
const pg = require('pg');
const c = process.env.DATABASE_URL || (process.env.DB_HOST ? \`postgresql://\${process.env.DB_USER}:\${process.env.DB_PASSWORD}@\${process.env.DB_HOST}:\${process.env.DB_PORT||'5432'}/\${process.env.DB_NAME}\` : '');
if (!c) process.exit(0);
const client = new pg.Client({ connectionString: c, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
client.connect().then(() => client.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done
echo "PostgreSQL is ready."

# スキーマ初期化（DATABASE_URL がある場合）
if [ -n "$DATABASE_URL" ] || [ -n "$DB_HOST" ]; then
  node ./scripts/docker-init-db.mjs || true
fi

exec node server.js