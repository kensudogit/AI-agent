import type { ToolDefinition } from '@/types/agent';
import { MAX_CALC_EXPRESSION_LENGTH } from '@/lib/constants';

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

/** 計算式として許可する文字のみに制限（インジェクション対策） */
const CALC_ALLOWED = /^[0-9+\-*/().%\s]+$/;

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_current_time':
      return new Date().toISOString();
    case 'calculate': {
      const expr = String(args.expression ?? '').slice(0, MAX_CALC_EXPRESSION_LENGTH);
      if (!expr.trim()) {
        return 'Error: empty expression';
      }
      if (!CALC_ALLOWED.test(expr)) {
        return `Error: disallowed characters in expression (only numbers, + - * / ( ) . % and spaces)`;
      }
      try {
        const result = Function(`"use strict"; return (${expr})`)();
        const num = Number(result);
        if (Number.isFinite(num)) return String(num);
        return String(result);
      } catch {
        return `Error: invalid expression "${expr.slice(0, 50)}${expr.length > 50 ? '...' : ''}"`;
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
