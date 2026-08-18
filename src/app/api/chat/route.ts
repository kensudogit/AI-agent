import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/db';
import { AGENT_TOOLS, runTool } from '@/lib/tools';
import { chatBodySchema, type ChatBody } from '@/lib/schemas';
import { apiError, validationError, parseJsonBody } from '@/lib/api';
import {
  CLAUDE_MODEL,
  getAnthropic,
  isAnthropicConfigured,
  openMessageStream,
  splitSystemMessages,
  toApiError,
} from '@/lib/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** ツール実行 → 再問い合わせを繰り返す上限（暴走防止） */
const MAX_TOOL_ROUNDS = 4;

const REFUSAL_NOTICE = '\n\n（この内容には応答できませんでした。表現を変えて再度お試しください。）';

/**
 * 既定のシステムプロンプト。旧実装には system が無く、応答言語がモデル任せだった
 * （Claude では前置きが英語になることがある）。日本語と簡潔さを明示する。
 */
const DEFAULT_SYSTEM = `あなたは日本語で応答するアシスタントです。ユーザーが他の言語で書いた場合を除き、前置きも含めて必ず日本語で答えてください。

回答は簡潔にまとめ、不要な前置き・復唱・自己言及は書かないこと。ツールを使う場合は、実行前の宣言は不要です。結果を踏まえた答えだけを返してください。`;

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody<ChatBody>(req);
    if (!parsed.ok) return parsed.response;

    const parseResult = chatBodySchema.safeParse(parsed.data);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }
    const { messages, conversationId } = parseResult.data;

    if (!isAnthropicConfigured()) {
      return apiError('ANTHROPIC_API_KEY not configured', 503);
    }

    // Claude では system は messages ではなくトップレベルのパラメータ
    const { system: clientSystem, messages: initialMessages } = splitSystemMessages(messages);
    const system = clientSystem ? `${DEFAULT_SYSTEM}\n\n${clientSystem}` : DEFAULT_SYSTEM;
    if (initialMessages.length === 0) {
      return apiError('user メッセージが必要です', 400);
    }

    const client = getAnthropic();
    const baseParams = {
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      // claude-opus-5 は思考がデフォルト ON。thinking を無効化するとツール呼び出しが
      // 本文テキストとして出力される既知の不具合があるため、effort で深さを調整する。
      thinking: { type: 'adaptive' as const },
      output_config: { effort: 'medium' as const },
      system,
      ...(AGENT_TOOLS.length > 0 ? { tools: AGENT_TOOLS } : {}),
    };

    const convo: Anthropic.MessageParam[] = [...initialMessages];

    // 最初のイベントまで進めておくことで、401/429 などを HTTP ステータスとして返せる
    let opened;
    try {
      opened = await openMessageStream({ ...baseParams, messages: convo });
    } catch (apiErr: unknown) {
      const { message, status } = toApiError(apiErr);
      return apiError(message, status);
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (kind: '0' | '1' | 'e', payload: unknown) =>
          controller.enqueue(encoder.encode(`${kind}${JSON.stringify(payload)}\n`));

        let fullContent = '';

        /** ストリームイベントを消費し、text_delta だけをクライアントへ流す */
        const consume = async (
          iterator: AsyncIterator<Anthropic.MessageStreamEvent>,
          firstResult?: IteratorResult<Anthropic.MessageStreamEvent>
        ) => {
          let result = firstResult ?? (await iterator.next());
          while (!result.done) {
            const event = result.value;
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullContent += event.delta.text;
              send('0', { content: event.delta.text });
            }
            result = await iterator.next();
          }
        };

        try {
          let stream = opened.stream;
          await consume(opened.iterator, opened.first);
          let message = await stream.finalMessage();

          // ツールが呼ばれた場合は実行結果を返して会話を続ける（エージェントループ）
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            if (message.stop_reason !== 'tool_use') break;

            // thinking ブロックを含む content をそのまま履歴へ戻す（改変不可）
            convo.push({ role: 'assistant', content: message.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of message.content) {
              if (block.type !== 'tool_use') continue;
              const result = await runTool(
                block.name,
                (block.input ?? {}) as Record<string, unknown>
              );
              send('1', { tool: block.name, result });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              });
            }
            if (toolResults.length === 0) break;

            convo.push({ role: 'user', content: toolResults });

            stream = client.messages.stream({ ...baseParams, messages: convo });
            await consume(stream[Symbol.asyncIterator]());
            message = await stream.finalMessage();
          }

          // 安全性判定で拒否された場合、content は空になり得る。無言で終わらせない。
          if (message.stop_reason === 'refusal') {
            fullContent += REFUSAL_NOTICE;
            send('0', { content: REFUSAL_NOTICE });
          }

          if (conversationId) {
            try {
              await query(
                'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                [conversationId, 'user', messages[messages.length - 1]?.content ?? '']
              );
              await query(
                'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                [conversationId, 'assistant', fullContent]
              );
              await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [
                conversationId,
              ]);
            } catch (dbErr) {
              console.error('Chat DB persistence error:', dbErr);
              // 永続化失敗してもストリームは成功として返す
            }
          }
        } catch (streamErr) {
          console.error('Chat stream error:', streamErr);
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
    console.error('Chat API error:', err);
    return apiError(err instanceof Error ? err.message : 'Chat failed', 500);
  }
}
