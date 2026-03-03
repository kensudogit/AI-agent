import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { query } from '@/lib/db';
import { AGENT_TOOLS, runTool } from '@/lib/tools';
import type { Message } from '@/types/agent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, conversationId } = body as {
      messages: Message[];
      conversationId?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 503 }
      );
    }

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
      const obj: Record<string, unknown> = {
        role: m.role,
        content: m.content,
      };
      if (m.tool_calls) obj.tool_calls = m.tool_calls;
      if (m.tool_call_id) obj.tool_call_id = m.tool_call_id;
      return obj as unknown as OpenAI.Chat.ChatCompletionMessageParam;
    });

    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: openaiMessages,
      stream: true,
      tools: AGENT_TOOLS.length > 0 ? AGENT_TOOLS : undefined,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        let toolCalls: { id: string; name: string; args: string }[] = [];
        let currentTool = { id: '', name: '', args: '' };

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullContent += delta.content;
            controller.enqueue(encoder.encode(`0${JSON.stringify({ content: delta.content })}\n`));
          }
          if (delta.tool_calls?.length) {
            for (const tc of delta.tool_calls) {
              if (tc.id) currentTool.id = tc.id;
              if (tc.function?.name) currentTool.name = tc.function.name;
              if (tc.function?.arguments) currentTool.args += tc.function.arguments;
              if (tc.id && tc.function?.name) {
                toolCalls.push({ ...currentTool });
                currentTool = { id: '', name: '', args: '' };
              }
            }
          }
        }

        if (toolCalls.length > 0) {
          for (const tc of toolCalls) {
            let args: Record<string, unknown> = {};
            try {
              args = tc.args ? JSON.parse(tc.args) : {};
            } catch {
              args = { expression: tc.args };
            }
            const result = await runTool(tc.name, args);
            controller.enqueue(
              encoder.encode(`1${JSON.stringify({ tool: tc.name, result })}\n`)
            );
          }
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
            await query(
              'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
              [conversationId]
            );
          } catch {
            // ignore persistence errors
          }
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
