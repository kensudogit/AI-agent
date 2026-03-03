import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { rows } = await query<{ id: string; role: string; content: string; created_at: string }>(
      'SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Messages list error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load messages' },
      { status: 500 }
    );
  }
}
