import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { query } from '@/lib/db';
import { getScenario, type ScenarioId, type UserRole, type StructuredFeedback } from '@/lib/negotiation';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  messages: { role: 'user' | 'assistant'; content: string }[];
  scenarioId: ScenarioId;
  userRole: UserRole;
  difficulty?: string;
  saveSession?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { messages, scenarioId, userRole, difficulty = 'standard', saveSession = true } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 503 }
      );
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: 'Invalid scenarioId' }, { status: 400 });
    }

    const roleLabel = userRole === 'sales' ? '営業側' : '顧客側';
    const log = messages
      .map((m) => `[${m.role === 'user' ? roleLabel : 'AI'}]: ${m.content}`)
      .join('\n');

    const systemPrompt = `あなたは商談トレーニングのプロコーチです。模擬商談のログを分析し、参加者（ユーザー）へのフィードバックを日本語で出力してください。

【重要】必ず以下のJSON形式のみで出力し、それ以外の文字は含めないでください。
{
  "good_points": ["良かった点1", "良かった点2"],
  "improve_points": ["改善点1（具体的な言い換え例があれば記載）", "改善点2"],
  "advice": "一言アドバイス（1〜2文）",
  "overall_score": 1から5の整数（5が最高）
}

ルール:
- good_points と improve_points はそれぞれ1〜3個の短文
- シナリオ: ${scenario.title}、ユーザー役割: ${roleLabel}
- 具体的な言い回しの例を改善点に含めると効果的`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `以下の模擬商談ログを分析し、指定のJSON形式でフィードバックを出力してください。\n\n${log}` },
      ],
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    let structured: StructuredFeedback = {
      good_points: [],
      improve_points: [],
      advice: 'フィードバックを解析できませんでした。',
      raw,
    };

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as {
          good_points?: string[];
          improve_points?: string[];
          advice?: string;
          overall_score?: number;
        };
        structured = {
          good_points: Array.isArray(parsed.good_points) ? parsed.good_points : [],
          improve_points: Array.isArray(parsed.improve_points) ? parsed.improve_points : [],
          advice: typeof parsed.advice === 'string' ? parsed.advice : structured.advice,
          overall_score:
            typeof parsed.overall_score === 'number' && parsed.overall_score >= 1 && parsed.overall_score <= 5
              ? parsed.overall_score
              : undefined,
          raw,
        };
      } catch {
        structured.advice = raw.slice(0, 300) || structured.advice;
      }
    } else {
      structured.advice = raw.slice(0, 400) || structured.advice;
    }

    let sessionId: string | null = null;
    if (saveSession) {
      try {
        const title = messages.find((m) => m.role === 'user')?.content?.slice(0, 100) || scenario.title;
        const { rows: sessionRows } = await query<{ id: string }>(
          `INSERT INTO negotiation_sessions (scenario_id, user_role, difficulty, title, feedback_raw, feedback_good, feedback_improve, feedback_advice, overall_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            scenarioId,
            userRole,
            difficulty,
            title,
            structured.raw ?? null,
            JSON.stringify(structured.good_points),
            JSON.stringify(structured.improve_points),
            structured.advice ?? null,
            structured.overall_score ?? null,
          ]
        );
        sessionId = sessionRows[0]?.id ?? null;
        if (sessionId) {
          for (const m of messages) {
            await query(
              'INSERT INTO negotiation_messages (session_id, role, content) VALUES ($1, $2, $3)',
              [sessionId, m.role, m.content]
            );
          }
        }
      } catch (e) {
        console.error('Save negotiation session error:', e);
      }
    }

    return NextResponse.json({
      feedback: structured,
      sessionId,
    });
  } catch (err) {
    console.error('Negotiation feedback API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Feedback failed' },
      { status: 500 }
    );
  }
}
