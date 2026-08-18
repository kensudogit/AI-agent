export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id?: string;
  role: MessageRole;
  content: string;
  tool_calls?: unknown;
  tool_call_id?: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
