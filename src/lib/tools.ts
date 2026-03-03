import type { ToolDefinition } from '@/types/agent';

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date and time in ISO format',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Evaluate a mathematical expression. Example: "2 + 3 * 4"',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string', description: 'Math expression' } },
        required: ['expression'],
        additionalProperties: false,
      },
    },
  },
];

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_current_time':
      return new Date().toISOString();
    case 'calculate': {
      const expr = String(args.expression ?? '');
      const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
      try {
        const result = Function(`"use strict"; return (${sanitized})`)();
        return String(result);
      } catch {
        return `Error: invalid expression "${expr}"`;
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
