import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
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
       LIMIT 50`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Negotiation sessions list error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list sessions' },
      { status: 500 }
    );
  }
}
