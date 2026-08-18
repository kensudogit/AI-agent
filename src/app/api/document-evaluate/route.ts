import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import {
  extractDocumentText,
  isAllowedDocumentName,
} from '@/lib/documentExtract';
import {
  MAX_DOCUMENT_EXTRACT_CHARS,
  MAX_DOCUMENT_UPLOAD_BYTES,
} from '@/lib/constants';
import { apiError } from '@/lib/api';
import { CLAUDE_MODEL, getAnthropic, isAnthropicConfigured, toApiError } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 120;

const SYSTEM_PROMPT = `あなたは文書レビューおよび評価の専門家です。ユーザーがアップロードしたドキュメントから抽出されたテキストを読み、以下を日本語で簡潔かつ具体的に出力してください。

## 出力構成（見出しはそのまま使用）
### 要約
### 構成・読みやすさの評価
### リスク・不明点・不足情報
### 改善提案
### 総合コメント

・判断できない事項は「テキスト情報のみでは断定できない」と明記する。
・表や数値が多い場合は、傾向や注意点に触れる。
・個人情報や機密らしき記載があればマスキングせず指摘のみ（実際の運用では別途マスキングを検討する旨を一文で添える）。`;

export async function POST(req: NextRequest) {
  try {
    if (!isAnthropicConfigured()) {
      return apiError('ANTHROPIC_API_KEY not configured', 503);
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return apiError('multipart/form-data が必要です', 400);
    }

    const file = formData.get('file');
    const instructionRaw = formData.get('instruction');
    const instruction =
      typeof instructionRaw === 'string' ? instructionRaw.trim().slice(0, 4_000) : '';

    if (!(file instanceof Blob)) {
      return apiError('file が指定されていません', 400);
    }

    const fileName =
      typeof (file as File).name === 'string' && (file as File).name
        ? (file as File).name
        : 'document';

    if (!isAllowedDocumentName(fileName)) {
      return apiError('PDF (.pdf) または Excel (.xlsx / .xls) のみ対応しています', 400);
    }

    const size = file.size;
    if (size > MAX_DOCUMENT_UPLOAD_BYTES) {
      return apiError(
        `ファイルサイズは ${Math.floor(MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024))}MB 以下にしてください`,
        400
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    let extracted;
    try {
      extracted = await extractDocumentText(fileName, buffer, MAX_DOCUMENT_EXTRACT_CHARS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '抽出に失敗しました';
      return apiError(msg, 400);
    }

    const userPayload = [
      `ファイル名: ${fileName}`,
      extracted.meta.kind === 'pdf' && extracted.meta.pages != null
        ? `ページ数: ${extracted.meta.pages}`
        : '',
      extracted.meta.kind === 'excel' && extracted.meta.sheetCount != null
        ? `シート数: ${extracted.meta.sheetCount}`
        : '',
      extracted.truncated ? '※抽出結果は長さのため一部省略されています。' : '',
      '',
      '--- 抽出テキスト ---',
      extracted.text,
      '',
      '--- ユーザーからの追加指示 ---',
      instruction || '(なし)',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      // max_tokens は「思考 + 本文」の合計上限。長文レビューが途中で切れないよう確保する。
      const completion = await getAnthropic().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        messages: [{ role: 'user', content: userPayload }],
      });

      const evaluation =
        completion.content
          .find((b): b is Anthropic.TextBlock => b.type === 'text')
          ?.text.trim() ||
        'モデルから評価テキストが返りませんでした。';

      return Response.json({
        evaluation,
        meta: {
          fileName,
          kind: extracted.meta.kind,
          pages: extracted.meta.pages,
          sheetCount: extracted.meta.sheetCount,
          truncated: extracted.truncated,
          extractedChars: extracted.text.length,
        },
      });
    } catch (apiErr: unknown) {
      const { message, status } = toApiError(apiErr);
      return apiError(message, status);
    }
  } catch (err) {
    console.error('document-evaluate:', err);
    return apiError(err instanceof Error ? err.message : '評価処理に失敗しました', 500);
  }
}
