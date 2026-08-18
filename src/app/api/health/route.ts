import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isNextProductionBuild } from '@/lib/next-build';
import { CLAUDE_MODEL, isAnthropicConfigured } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Health = {
  status: 'ok' | 'degraded';
  anthropic: boolean;
  model: string;
  db: boolean;
  timestamp: string;
};

export async function GET() {
  const anthropic = isAnthropicConfigured();
  let db = false;
  if (!isNextProductionBuild()) {
    try {
      await query('SELECT 1');
      db = true;
    } catch {
      // DB 未設定 or 接続失敗
    }
  }

  const status: Health['status'] = anthropic ? 'ok' : 'degraded';
  const body: Health = {
    status,
    anthropic,
    model: CLAUDE_MODEL,
    db,
    timestamp: new Date().toISOString(),
  };

  const httpStatus = status === 'ok' ? 200 : 503;
  return NextResponse.json(body, { status: httpStatus });
}
