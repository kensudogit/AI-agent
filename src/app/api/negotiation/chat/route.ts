import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getScenario, getSystemPrompt } from '@/lib/negotiation';
import type { ScenarioId, UserRole, Difficulty } from '@/lib/negotiation';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  messages: { role: 'user' | 'assistant'; content: string }[];
  scenarioId: ScenarioId;
  userRole: UserRole;
  difficulty?: Difficulty;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { messages, scenarioId, userRole, difficulty = 'standard' } = body;

    if (!Array.isArray(messages)) {
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
      const code = status === 401 ? 401 : status === 429 ? 429 : 502;
      return NextResponse.json(
        { error: apiErr instanceof Error ? apiErr.message : 'OpenAI API error' },
        { status: code }
      );
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
