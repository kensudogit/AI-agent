import type Anthropic from '@anthropic-ai/sdk';
import { MAX_CALC_EXPRESSION_LENGTH } from '@/lib/constants';

/**
 * Claude に渡すツール定義（Anthropic Messages API 形式）。
 * description には「何をするか」だけでなく「いつ呼ぶか」を書く。呼び出し精度に直結する。
 */
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_current_time',
    description:
      '現在の日付と時刻を ISO 8601 形式で返す。ユーザーが「今日」「現在時刻」「今何時」など、実行時点の日時に依存する質問をしたときに呼び出す。過去や未来の日付計算には使わない。',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'calculate',
    description:
      '数式を評価して結果を返す。四則演算・括弧・剰余のみ対応（例: "2 + 3 * 4"）。ユーザーが計算を求めたとき、または回答に正確な数値計算が必要なときに呼び出す。単位換算や日付計算、変数を含む数式には使えない。',
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: '評価する数式。使用できるのは数字と + - * / ( ) . % と空白のみ。',
        },
      },
      required: ['expression'],
      additionalProperties: false,
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
