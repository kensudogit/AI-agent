import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { query } from '@/lib/db';
import { getScenario, type StructuredFeedback } from '@/lib/negotiation';
import { negotiationFeedbackBodySchema } from '@/lib/schemas';
import { apiError, parseJsonBody, validationError, openaiStatusToHttp } from '@/lib/api';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;

    const parseResult = negotiationFeedbackBodySchema.safeParse(parsed.data);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }
    const { messages, scenarioId, userRole, difficulty = 'standard', saveSession = true } = parseResult.data;

    if (!process.env.OPENAI_API_KEY) {
      return apiError('OPENAI_API_KEY not configured', 503);
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return apiError('Invalid scenarioId', 400);
    }

    const roleLabel = userRole === 'sales' ? '営業側' : '顧客側';
    const log = messages
      .map((m) => `[${m.role === 'user' ? roleLabel : 'AI'}]: ${m.content}`)
      .join('\n');

    const systemPrompt = `あなたは商談トレーニングのプロコーチです。模擬商談のログを分析し、参加者（ユーザー）へのフィードバックを日本語で出力してください。

【評価方針】厳格・辛辣に評価すること。
- 甘い評価は禁止。問題点は遠慮なく指摘し、「〜できていなかった」「〜が不足していた」と明確に書く。
- 良かった点は本当に評価できる場合のみ1〜2個に留め、形式的な褒めは不要。
- 改善点は具体的に突き、言い訳の余地がないようにする。言い換え例や「こう言うべきだった」を必ず含める。
- overall_score は厳しめに付ける。5は極めて稀、凡庸な交渉は2〜3、明らかな問題があれば1〜2とする。
- advice は手厳しく、改善を迫る一文にする。おざなりな励ましは不要。

【重要】必ず以下のJSON形式のみで出力し、それ以外の文字は含めないでください。
{
  "good_points": ["本当に良かった点のみ1〜2個"],
  "improve_points": ["改善点1（「〜すべきだった」など具体的な言い換え例を記載）", "改善点2"],
  "advice": "厳しく一言アドバイス（1〜2文）",
  "overall_score": 1から5の整数（5は極めて稀、厳しめに付ける）
}

ルール:
- good_points は0〜2個、improve_points は1〜3個の短文
- シナリオ: ${scenario.title}、ユーザー役割: ${roleLabel}
- 改善点には必ず「こう言うべきだった」などの具体的な言い回し例を入れる`;

    let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下の模擬商談ログを分析し、指定のJSON形式でフィードバックを出力してください。\n\n${log}` },
        ],
        temperature: 0.4,
      });
    } catch (apiErr: unknown) {
      const status = (apiErr as { status?: number })?.status;
      return apiError(apiErr instanceof Error ? apiErr.message : 'OpenAI API error', openaiStatusToHttp(status));
    }

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
        // sessionId は null のまま返す（フィードバックは成功）
      }
    }

    return NextResponse.json({
      feedback: structured,
      sessionId,
    });
  } catch (err) {
    console.error('Negotiation feedback API error:', err);
    return apiError(err instanceof Error ? err.message : 'Feedback failed', 500);
  }
}
