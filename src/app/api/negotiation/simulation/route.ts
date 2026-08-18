import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getScenario } from '@/lib/negotiation';
import { getScenarioSimulationStatic } from '@/lib/scenarioSimulation';
import { negotiationSimulationBodySchema } from '@/lib/schemas';
import { apiError, parseJsonBody, validationError, openaiStatusToHttp } from '@/lib/api';
import type { Difficulty, UserRole } from '@/lib/negotiation';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export const runtime = 'nodejs';
export const maxDuration = 90;

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: '易：相手は比較的協力的で譲歩しやすい。',
  standard: '標準：現実的な予算・条件懸念がありつつ前向きにもなる。',
  hard: '難：相手は厳しく、具体的な根拠・数値・次アクションがないと譲歩しない。',
};

function roleInstruction(userRole: UserRole): string {
  if (userRole === 'sales') {
    return 'ユーザーは「営業側」を演じます。対話例ではユーザー側のセリフを「あなた（営業）」として示し、AI が演じるのは顧客側です。';
  }
  return 'ユーザーは「顧客側」を演じます。対話例ではユーザー側のセリフを「あなた（顧客）」として示し、AI が演じるのは営業側です。';
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;

    const parseResult = negotiationSimulationBodySchema.safeParse(parsed.data);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { scenarioId, userRole, difficulty = 'standard' } = parseResult.data;

    if (!process.env.OPENAI_API_KEY) {
      return apiError('OPENAI_API_KEY not configured', 503);
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return apiError('Invalid scenarioId', 400);
    }

    const stat = getScenarioSimulationStatic(scenarioId);

    const userPayload = [
      `【シナリオ】${scenario.title}`,
      `【概要】${scenario.description}`,
      `【シミュレーション前提】${stat.premise}`,
      `【典型的な展開】`,
      ...stat.phases.map((p, i) => `${i + 1}. ${p.label}: ${p.description}`),
      `【交渉の焦点になりやすい論点】`,
      ...stat.focusPoints.map((f, i) => `- ${f}`),
      stat.sampleCue ? `【セリフのきっかけ例】${stat.sampleCue}` : '',
      '',
      `【難易度】${DIFF_LABEL[difficulty]}`,
      `【役割】${roleInstruction(userRole)}`,
      '',
      '上記に基づき、模擬商談の「詳細シミュレーション」を Markdown で出力してください。',
      '必須セクション:',
      '### シミュレーションのねらい（この練習で鍛えること）',
      '### 想定シーン設定（相手の立場・前提・緊張度）',
      '### 対話例（営業／顧客を交互に、合計 8〜12 ターン。発話者ラベルは「営業:」「顧客:」のみ使用）',
      '### このシナリオでのチェックリスト（箇条書き 5 項目程度）',
      '### ユーザーが演じる側へのヒント（3 点）',
      '',
      '対話は日本語のビジネス口調で、難易度に応じて相手の厳しさ・詰めの強さを反映してください。',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'あなたは日本の営業・商談研修のファシリテーターです。指定された条件だけに基づき、実務に即した模擬商談シミュレーションを出力します。憶測で会社名や実在サービス名を捏造しないでください。',
          },
          { role: 'user', content: userPayload },
        ],
        max_tokens: 4_096,
        temperature: 0.65,
      });

      const text =
        completion.choices[0]?.message?.content?.trim() ||
        'シミュレーションの生成に失敗しました。';

      return Response.json({
        simulation: text,
        scenarioTitle: scenario.title,
      });
    } catch (apiErr: unknown) {
      const status = (apiErr as { status?: number })?.status;
      return apiError(
        apiErr instanceof Error ? apiErr.message : 'OpenAI API error',
        openaiStatusToHttp(status)
      );
    }
  } catch (err) {
    console.error('negotiation simulation API:', err);
    return apiError(err instanceof Error ? err.message : 'Simulation failed', 500);
  }
}
