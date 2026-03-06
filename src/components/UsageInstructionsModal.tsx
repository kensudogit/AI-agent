'use client';

import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const sections = [
  {
    id: 1,
    title: 'チャットで会話する',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    items: [
      'トップページ中央下の入力欄にメッセージを入力します。入力後、「送信」ボタンをクリックするか、キーボードの Enter キーで送信できます（Shift+Enter は改行）。',
      '送信すると、あなたのメッセージが青い吹き出しで表示され、AI の返答がストリーミング（少しずつ表示）で流れます。応答中は「...」が表示されます。',
      'マイクボタン（入力欄の左側）を押すと音声入力が始まります。対応ブラウザ（Chrome など）では、話し終えると自動で文字に変換され、その内容が送信されます。再度マイクを押すと録音を停止できます。',
      'AI が「計算」や「現在時刻」などのツールを使うと、返答に [ツール名] と結果が表示されます。例：「[calculate] 8」「[get_current_time] 2025-02-23T...」。',
      '会話例：「今何時？」「3+5を計算して」「明日の天気を教えて」（ツールで答えられる内容は結果が返ります）。自由な質問や依頼をそのまま入力してかまいません。',
      '会話はデータベースを設定している場合、自動で会話として保存されます。同じブラウザで続きから会話できる場合があります。',
    ],
  },
  {
    id: 2,
    title: '模擬商談を使う',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    items: [
      '画面上部ヘッダーにある「模擬商談 →」リンクをクリックし、模擬商談ページへ移動します。',
      '開始前に、次の3つを選択します。（1）シナリオ：B2B SaaS・価格納期交渉・初回訪問・人材紹介・広告契約・外注契約などから選びます。（2）自分の役割：営業側（あなたが営業）か顧客側（あなたが顧客）。（3）難易度：易・標準・難（相手 AI の態度が協力的〜厳しめに変わります）。',
      '「開始」ボタンを押すとセッションが始まります。AI が商談の最初の一言を表示するので、その内容に合わせて返答を入力します。画面上部に経過時間（タイマー）が表示されます。',
      '入力欄に商談のセリフを入力して送信するか、マイクで話して音声入力します。AI は選択したシナリオ・役割・難易度に合わせて相手役を演じます。やり取りを続けて商談を進めてください。',
      '一通り商談が終わったら「フィードバックを取得」ボタンを押します。AI がログを分析し、良かった点・改善点・アドバイス・総合スコア（1〜5）を表示します。評価は厳しめに付けられます。',
      '「履歴」ボタンで過去の模擬商談セッション一覧を表示できます。各セッションをクリックすると、会話ログとフィードバック内容を振り返れます（DB 設定時のみ保存されます）。',
    ],
  },
  {
    id: 3,
    title: 'その他・注意事項',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    items: [
      'この「利用手順」は、トップページまたは模擬商談ページのヘッダーにある「利用手順」ボタン（本のアイコン）でいつでも開けます。モーダル外をクリックするか、Esc キーで閉じられます。',
      'チャットの会話・模擬商談のセッションは、サーバーで PostgreSQL（DATABASE_URL）が設定されている場合にのみ保存されます。未設定の場合は利用はできますが、履歴は残りません。',
      'チャット・模擬商談の応答には OpenAI API を使用します。OPENAI_API_KEY が未設定または無効な場合、「OPENAI_API_KEY not configured」や 503 などのエラーになります。管理者は環境変数を確認してください。',
      'エラーが表示された場合は、画面を再読み込みするか、しばらく待ってから再試行してください。502 や「message port closed」が出る場合は、サーバー側のログやヘルスチェック（/api/health）を確認すると原因の切り分けに役立ちます。',
    ],
  },
];

export default function UsageInstructionsModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[85vh] flex flex-col rounded-lg shadow-xl overflow-hidden bg-white dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-modal-title"
      >
        {/* ヘッダー: 緑背景・本アイコン・タイトル・下向き chevron */}
        <header className="flex items-center justify-between shrink-0 px-4 py-3 bg-emerald-600 text-white">
          <div className="flex items-center gap-2">
            <span className="text-white" aria-hidden>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
              </svg>
            </span>
            <h2 id="usage-modal-title" className="text-lg font-semibold">
              利用手順
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
            </svg>
          </button>
        </header>

        {/* 本文: スクロール可能 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {sections.map((section) => (
            <section key={section.id} className="space-y-2">
              <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold">
                  {section.id}
                </span>
                <span className="flex items-center gap-2">
                  {section.title}
                  <span className="text-emerald-600 dark:text-emerald-400">{section.icon}</span>
                </span>
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700 dark:text-slate-300 pl-1">
                {section.items.map((item, i) => (
                  <li key={i} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
