import type Anthropic from '@anthropic-ai/sdk';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id?: string;
  role: MessageRole;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/** ストリーム中に検出したツール呼び出し（Claude の tool_use ブロック） */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** ツール定義は SDK の型をそのまま使う（独自定義しない） */
export type ToolDefinition = Anthropic.Tool;
