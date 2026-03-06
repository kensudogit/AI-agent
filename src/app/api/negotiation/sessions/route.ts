import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { apiError } from '@/lib/api';
import { MAX_LIST_LIMIT } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const limit = Math.min(50, MAX_LIST_LIMIT);
    const { rows } = await query<{
      id: string;
      scenario_id: string;
      user_role: string;
      difficulty: string;
      title: string;
      feedback_advice: string | null;
      overall_score: number | null;
      created_at: string;
    }>(
      `SELECT id, scenario_id, user_role, difficulty, title, feedback_advice, overall_score, created_at
       FROM negotiation_sessions
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Negotiation sessions list error:', err);
    return apiError(err instanceof Error ? err.message : 'Database unavailable', 503);
  }
}
