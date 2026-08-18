import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/db';
import { getScenario, type StructuredFeedback } from '@/lib/negotiation';
import { negotiationFeedbackBodySchema } from '@/lib/schemas';
import { apiError, parseJsonBody, validationError } from '@/lib/api';
import { CLAUDE_MODEL, getAnthropic, isAnthropicConfigured, toApiError } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 構造化出力（output_config.format）でフィードバックの JSON 形状を保証する。
 * 数値・文字列長の制約（minimum / minItems など）は未対応のため、
 * 件数やスコア基準はシステムプロンプト側で指示する。
 */
const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    good_points: { type: 'array', items: { type: 'string' } },
    improve_points: { type: 'array', items: { type: 'string' } },
    advice: { type: 'string' },
    overall_score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
  },
  required: ['good_points', 'improve_points', 'advice', 'overall_score'],
  additionalProperties: false,
} as const;

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;

    const parseResult = negotiationFeedbackBodySchema.safeParse(parsed.data);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }
    const { messages, scenarioId, userRole, difficulty = 'standard', saveSession = true } = parseResult.data;

    if (!isAnthropicConfigured()) {
      return apiError('ANTHROPIC_API_KEY not configured', 503);
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return apiError('Invalid scenarioId', 400);
    }

    const roleLabel = userRole === 'sales' ? '営業側' : '顧客側';
    const log = messages
      .map((m) => `[${m.role === 'user' ? roleLabel : 'AI'}]: ${m.content}`)
      .join('\n');

    const systemPrompt = `あなたは商談トレーニングの「厳格審査役」です。忖度・気遣い・慰めは一切不要です。模擬商談ログを冷徹に分析し、参加者（ユーザー）への講評を日本語でJSONのみ出力してください。

【絶対方針：辛辣・厳格】
- 商談のプロ基準で裁く。ユーザーに都合の良い解釈はしない。
- 「まあまあ」「頑張っていた」系の評価は禁止。曖昧な発言・論点のすり替え・傾聴不足・クロージング放棄は容赦なく突く。
- good_points は原則0〜1個のみ。明確な強み（具体例・数字・次アクションの合意など）がログに無ければ空配列 [] でよい。形式的な褒め・社交辞令は禁止。
- improve_points は必ず3〜5個。各項目は1〜2文で鋭く。「〜だったが実際は〜」「こう言うべきだった：『…』」のように言い換え例を必ず1つ以上含める。
- overall_score の基準（厳守）:
  - 5: ほぼ付与しない。プロの商談記録レベルで初めて検討。
  - 4: 極めて稀。論点整理・相手の懸念への具体的回答・合意形成が一貫している場合のみ。
  - 3: 「及第」ではなく「まだ足りない」ライン。凡庸・平凡は2以下。
  - 2: 多くのセッションはここ。課題が目立つ通常の練習レベル。
  - 1: 論点がずれている・一方的・準備不足が明白な場合。
- advice は1〜2文で辛辣に締める。「次は〜しろ」「そのままでは通らない」など、改善を強いる口調。励まし・お疲れ様は禁止。

【重要】必ず有効なJSONオブジェクト1つだけを出力し、前置き・解説・マークダウン、その他の文字は一切含めない。
キーは good_points（配列）, improve_points（配列・3〜5要素）, advice（文字列）, overall_score（1〜5の整数）のみ。
overall_score は会話内容から上記基準で決定すること。固定値や安易な高得点は禁止。

コンテキスト:
- シナリオ: ${scenario.title}
- ユーザー役割: ${roleLabel}
- 難易度設定: ${difficulty}（難易度に関わらず上記の厳格基準は変えない）`;

    let raw = '';
    try {
      const completion = await getAnthropic().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        system: systemPrompt,
        thinking: { type: 'adaptive' },
        // 採点の一貫性を重視するので effort は高め。format で JSON 形状を保証する。
        output_config: {
          effort: 'high',
          format: { type: 'json_schema', schema: FEEDBACK_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: `以下の模擬商談ログを分析し、指定のJSON形式でフィードバックを出力してください。

${log}`,
          },
        ],
      });

      raw =
        completion.content
          .find((b): b is Anthropic.TextBlock => b.type === 'text')
          ?.text.trim() ?? '';
    } catch (apiErr: unknown) {
      const { message, status } = toApiError(apiErr);
      return apiError(message, status);
    }

    let structured: StructuredFeedback = {
      good_points: [],
      improve_points: [],
      advice: 'フィードバックを解析できませんでした。',
      raw,
    };

    // format 指定により raw はそのまま JSON のはず。念のため従来のフォールバックも残す。
    const jsonText = raw.startsWith('{') ? raw : (raw.match(/\{[\s\S]*\}/)?.[0] ?? '');
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText) as {
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
            typeof parsed.overall_score === 'number' &&
            parsed.overall_score >= 1 &&
            parsed.overall_score <= 5
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
