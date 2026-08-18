import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { getScenario, getSystemPrompt } from '@/lib/negotiation';
import { negotiationChatBodySchema } from '@/lib/schemas';
import { apiError, parseJsonBody, validationError } from '@/lib/api';
import {
  CLAUDE_MODEL,
  isAnthropicConfigured,
  openMessageStream,
  toApiError,
} from '@/lib/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * claude-opus-5 では temperature を指定できないため、応答の揺らぎ・自然さは
 * プロンプトで指示する（旧実装の temperature: 0.8 の代替）。
 */
const VARIETY_INSTRUCTION = `毎回同じ言い回しを繰り返さず、実際の商談のように自然に表現を変えてください。定型文のような応答は避けること。`;

const REFUSAL_NOTICE = '\n\n（この内容には応答できませんでした。表現を変えて再度お試しください。）';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;

    const parseResult = negotiationChatBodySchema.safeParse(parsed.data);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }
    const { messages, scenarioId, userRole, difficulty = 'standard' } = parseResult.data;

    if (!isAnthropicConfigured()) {
      return apiError('ANTHROPIC_API_KEY not configured', 503);
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return apiError('Invalid scenarioId', 400);
    }

    const systemPrompt = `${getSystemPrompt(scenario, userRole, difficulty)}\n\n${VARIETY_INSTRUCTION}`;
    const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 最初のイベントまで進めて、認証エラー等を HTTP ステータスで返せるようにする
    let opened;
    try {
      opened = await openMessageStream({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        // ロールプレイは応答速度優先。思考は有効のまま effort を下げる。
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        messages: claudeMessages,
      });
    } catch (apiErr: unknown) {
      const { message, status } = toApiError(apiErr);
      return apiError(message, status);
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (kind: '0' | 'e', payload: unknown) =>
          controller.enqueue(encoder.encode(`${kind}${JSON.stringify(payload)}\n`));

        try {
          let result = opened.first;
          while (!result.done) {
            const event = result.value;
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send('0', { content: event.delta.text });
            }
            result = await opened.iterator.next();
          }

          // イテレータは待機中の reader がいない状態でエラーが起きると、例外ではなく
          // done:true で静かに終了する。finalMessage() を待って確実に検出する。
          const message = await opened.stream.finalMessage();
          if (message.stop_reason === 'refusal') {
            send('0', { content: REFUSAL_NOTICE });
          }
        } catch (streamErr) {
          console.error('Negotiation stream error:', streamErr);
          send('e', { error: toApiError(streamErr, 'Stream error').message });
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Negotiation chat API error:', err);
    return apiError(err instanceof Error ? err.message : 'Chat failed', 500);
  }
}
