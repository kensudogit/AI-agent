import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

export type DocumentExtractMeta = {
  kind: 'pdf' | 'excel';
  pages?: number;
  sheetCount?: number;
  truncatedSheets?: boolean;
};

export type DocumentExtractResult = {
  text: string;
  meta: DocumentExtractMeta;
};

const MAX_EXCEL_SHEETS = 12;
const MAX_EXCEL_ROWS_PER_SHEET = 400;

function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n\n[--- 以降 ${text.length - maxChars} 文字は省略しました ---]`,
    truncated: true,
  };
}

async function extractPdf(buffer: Buffer): Promise<DocumentExtractResult> {
  const data = await pdfParse(buffer);
  const raw = (data.text ?? '').replace(/\u0000/g, '').trim();
  return {
    text: raw || '(PDF からテキストを抽出できませんでした。画像のみの PDF の可能性があります。)',
    meta: { kind: 'pdf', pages: data.numpages },
  };
}

function extractExcel(buffer: Buffer): DocumentExtractResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: true });
  const parts: string[] = [];
  const names = wb.SheetNames.slice(0, MAX_EXCEL_SHEETS);
  let truncatedSheets = wb.SheetNames.length > MAX_EXCEL_SHEETS;

  for (const sheetName of names) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const lines = csv.split(/\r?\n/);
    const body = lines.slice(0, MAX_EXCEL_ROWS_PER_SHEET).join('\n');
    parts.push(`### シート: ${sheetName}`);
    parts.push(body);
    if (lines.length > MAX_EXCEL_ROWS_PER_SHEET) {
      parts.push(`... (${lines.length - MAX_EXCEL_ROWS_PER_SHEET} 行を省略)`);
      truncatedSheets = true;
    }
    parts.push('');
  }

  const text = parts.join('\n').trim() || '(表にデータがありませんでした。)';
  return {
    text,
    meta: {
      kind: 'excel',
      sheetCount: wb.SheetNames.length,
      truncatedSheets,
    },
  };
}

/**
 * PDF または Excel（.xlsx / .xls）からプレーンテキストを抽出する。
 */
export async function extractDocumentText(
  fileName: string,
  buffer: Buffer,
  maxChars: number
): Promise<DocumentExtractResult & { truncated: boolean }> {
  const lower = fileName.toLowerCase();
  let base: DocumentExtractResult;

  if (lower.endsWith('.pdf')) {
    base = await extractPdf(buffer);
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    base = extractExcel(buffer);
  } else {
    throw new Error('PDF (.pdf) または Excel (.xlsx / .xls) のみ対応しています。');
  }

  const { text: t, truncated: tr } = truncateText(base.text, maxChars);
  const sheetTrunc = base.meta.kind === 'excel' && !!base.meta.truncatedSheets;
  return { text: t, meta: base.meta, truncated: tr || sheetTrunc };
}

export function isAllowedDocumentName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pdf') || lower.endsWith('.xlsx') || lower.endsWith('.xls');
}
