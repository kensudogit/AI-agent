import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError('Session id required', 400);
    }
    const { rows: sessionRows } = await query<{
      id: string;
      scenario_id: string;
      user_role: string;
      difficulty: string;
      title: string;
      feedback_raw: string | null;
      feedback_good: unknown;
      feedback_improve: unknown;
      feedback_advice: string | null;
      overall_score: number | null;
      created_at: string;
    }>(
      'SELECT id, scenario_id, user_role, difficulty, title, feedback_raw, feedback_good, feedback_improve, feedback_advice, overall_score, created_at FROM negotiation_sessions WHERE id = $1',
      [id]
    );
    const session = sessionRows[0];
    if (!session) {
      return apiError('Session not found', 404);
    }
    const { rows: messageRows } = await query<{ role: string; content: string; created_at: string }>(
      'SELECT role, content, created_at FROM negotiation_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [id]
    );
    return NextResponse.json({
      ...session,
      messages: messageRows,
    });
  } catch (err) {
    console.error('Negotiation session get error:', err);
    return apiError(err instanceof Error ? err.message : 'Database unavailable', 503);
  }
}
