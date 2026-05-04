/**
 * アプリ全体で使う定数（API 制限・バリデーション・セキュリティ）
 */

/** チャット: リクエストあたりのメッセージ数上限（トークン溢出・負荷対策） */
export const MAX_CHAT_MESSAGES = 100;

/** 1メッセージあたりの content 文字数上限 */
export const MAX_MESSAGE_CONTENT_LENGTH = 50_000;

/** 会話タイトル・セッションタイトルの最大文字数 */
export const MAX_TITLE_LENGTH = 500;

/** 模擬商談: 1セッションあたりのメッセージ数上限 */
export const MAX_NEGOTIATION_MESSAGES = 200;

/** 模擬商談: 1メッセージの入力最大文字数（フロントと揃える） */
export const MAX_NEGOTIATION_INPUT_LENGTH = 2_000;

/** 計算ツール: 式の最大文字数（インジェクション対策） */
export const MAX_CALC_EXPRESSION_LENGTH = 200;

/** 会話一覧・セッション一覧の取得件数上限 */
export const MAX_LIST_LIMIT = 100;

/** チャットにアップロード可能なドキュメントの最大バイト数（PDF / Excel） */
export const MAX_DOCUMENT_UPLOAD_BYTES = 15 * 1024 * 1024;

/** ドキュメントから抽出してモデルに渡すテキストの最大文字数（トークン上限対策） */
export const MAX_DOCUMENT_EXTRACT_CHARS = 100_000;
