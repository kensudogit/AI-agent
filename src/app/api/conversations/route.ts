import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { conversationBodySchema } from '@/lib/schemas';
import { apiError, parseJsonBody, validationError } from '@/lib/api';
import { MAX_LIST_LIMIT } from '@/lib/constants';

export async function GET() {
  try {
    const { rows } = await query<{ id: string; title: string; created_at: string; updated_at: string }>(
      `SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ${Math.min(50, MAX_LIST_LIMIT)}`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Conversations list error:', err);
    return apiError(err instanceof Error ? err.message : 'Database unavailable', 503);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;

    const parseResult = conversationBodySchema.safeParse(parsed.data ?? {});
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }
    const title = parseResult.data.title ?? 'New conversation';

    const { rows } = await query<{ id: string }>(
      'INSERT INTO conversations (title) VALUES ($1) RETURNING id',
      [title]
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('Conversation create error:', err);
    return apiError(err instanceof Error ? err.message : 'Database unavailable', 503);
  }
}
