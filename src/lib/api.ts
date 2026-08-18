import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** 統一エラーレスポンス: メッセージとステータス */
export function apiError(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

/** バリデーションエラー（Zod）を 400 で返す */
export function validationError(err: ZodError) {
  const first = err.errors[0];
  const message = first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed';
  return NextResponse.json({ error: message, details: err.errors }, { status: 400 });
}

/** リクエスト body を JSON で読んでパースに失敗したとき */
export function badRequest(message: string = 'Invalid JSON body') {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** 安全に JSON body を取得。失敗時は null とレスポンスのどちらか */
export async function parseJsonBody<T>(req: Request): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    const data = await req.json();
    return { ok: true, data };
  } catch {
    return { ok: false, response: badRequest() };
  }
}
