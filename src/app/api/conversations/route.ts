import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await query<{ id: string; title: string; created_at: string; updated_at: string }>(
      'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50'
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Conversations list error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = (body.title as string) || 'New conversation';
    const { rows } = await query<{ id: string }>(
      'INSERT INTO conversations (title) VALUES ($1) RETURNING id',
      [title]
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('Conversation create error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
