import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude (Anthropic Messages API) の共通クライアント。
 *
 * - モデルは ANTHROPIC_MODEL で上書き可能。未設定時は claude-opus-5。
 * - claude-opus-5 では temperature / top_p / top_k は使用不可（送ると 400）。
 *   応答のトーンや揺らぎはシステムプロンプトで制御する。
 * - 思考はデフォルトで ON。max_tokens は「思考 + 本文」の合計上限なので、
 *   本文だけを想定した小さい値にすると応答が途中で切れる。
 */

/** 既定モデル。ANTHROPIC_MODEL で差し替え可能。 */
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

let cached: Anthropic | null = null;

/** プロセス内で使い回すクライアント。 */
export function getAnthropic(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  }
  return cached;
}

/** API キーが設定されているか（ヘルスチェック・各ルートのガードで使用）。 */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Anthropic SDK の型付き例外から HTTP ステータスとメッセージを決める。
 * 文字列マッチではなく例外クラスで判定する。
 */
export function toApiError(err: unknown, fallbackMessage = 'Anthropic API error'): {
  message: string;
  status: number;
} {
  if (err instanceof Anthropic.AuthenticationError) {
    return { message: 'ANTHROPIC_API_KEY が無効です', status: 401 };
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { message: err.message, status: 403 };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { message: 'レート制限に達しました。時間をおいて再試行してください', status: 429 };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { message: err.message, status: 400 };
  }
  if (err instanceof Anthropic.NotFoundError) {
    return { message: `モデルまたはエンドポイントが見つかりません: ${CLAUDE_MODEL}`, status: 404 };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { message: 'Anthropic API に接続できませんでした', status: 502 };
  }
  if (err instanceof Anthropic.APIError) {
    // 5xx など上記以外の API エラー
    return { message: err.message, status: (err.status ?? 0) >= 500 ? 502 : err.status ?? 502 };
  }
  return { message: err instanceof Error ? err.message : fallbackMessage, status: 500 };
}

/**
 * 会話履歴から system ロールを分離する。
 * Claude では system はトップレベルのパラメータで、messages に入れられない。
 * 先頭が assistant の場合も落とす（最初は必ず user）。
 */
export function splitSystemMessages(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
): { system: string | undefined; messages: Anthropic.MessageParam[] } {
  const systemParts: string[] = [];
  const rest: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      if (m.content.trim()) systemParts.push(m.content);
      continue;
    }
    // 最初のメッセージは user でなければならない
    if (rest.length === 0 && m.role !== 'user') continue;
    rest.push({ role: m.role, content: m.content });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: rest,
  };
}

/** client.messages.stream() のパラメータ型（SDK から導出） */
export type MessageStreamParams = Parameters<Anthropic['messages']['stream']>[0];

/**
 * ストリームを開き、最初のイベントまで進めて返す。
 *
 * 認証エラーやレート制限は最初のイベントを待つ時点で throw されるため、
 * HTTP レスポンスを返す前に捕捉して正しいステータスコードで返せる。
 * 返した iterator は続きの消費に使う（stream.finalMessage() も併用可）。
 */
export async function openMessageStream(params: MessageStreamParams) {
  const stream = getAnthropic().messages.stream(params);
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  return { stream, iterator, first };
}
