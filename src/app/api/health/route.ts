import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Health = {
  status: 'ok' | 'degraded';
  openai: boolean;
  db: boolean;
  timestamp: string;
};

export async function GET() {
  const openai = Boolean(process.env.OPENAI_API_KEY);
  let db = false;
  try {
    await query('SELECT 1');
    db = true;
  } catch {
    // DB 未設定 or 接続失敗
  }

  const status: Health['status'] = openai ? 'ok' : 'degraded';
  const body: Health = {
    status,
    openai,
    db,
    timestamp: new Date().toISOString(),
  };

  const httpStatus = status === 'ok' ? 200 : 503;
  return NextResponse.json(body, { status: httpStatus });
}
