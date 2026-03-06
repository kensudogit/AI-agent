import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getScenario, getSystemPrompt } from '@/lib/negotiation';
import { negotiationChatBodySchema } from '@/lib/schemas';
import { apiError, parseJsonBody, validationError, openaiStatusToHttp } from '@/lib/api';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;

    const parseResult = negotiationChatBodySchema.safeParse(parsed.data);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }
    const { messages, scenarioId, userRole, difficulty = 'standard' } = parseResult.data;

    if (!process.env.OPENAI_API_KEY) {
      return apiError('OPENAI_API_KEY not configured', 503);
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return apiError('Invalid scenarioId', 400);
    }

    const systemPrompt = getSystemPrompt(scenario, userRole, difficulty);
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let stream: Awaited<ReturnType<typeof openai.chat.completions.create>>;
    try {
      stream = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: openaiMessages,
        stream: true,
        temperature: 0.8,
      });
    } catch (apiErr: unknown) {
      const status = (apiErr as { status?: number })?.status;
      return apiError(apiErr instanceof Error ? apiErr.message : 'OpenAI API error', openaiStatusToHttp(status));
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(`0${JSON.stringify({ content: delta })}\n`));
            }
          }
        } catch (streamErr) {
          console.error('Negotiation stream error:', streamErr);
          controller.enqueue(
            encoder.encode(`e${JSON.stringify({ error: streamErr instanceof Error ? streamErr.message : 'Stream error' })}\n`)
          );
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
