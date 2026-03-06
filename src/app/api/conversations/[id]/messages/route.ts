import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { apiError } from '@/lib/api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError('Conversation id required', 400);
    }
    const { rows } = await query<{ id: string; role: string; content: string; created_at: string }>(
      'SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Messages list error:', err);
    return apiError(err instanceof Error ? err.message : 'Database unavailable', 503);
  }
}
