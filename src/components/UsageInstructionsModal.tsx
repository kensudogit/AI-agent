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
      '画面下の入力欄にメッセージを入力し、「送信」ボタンまたは Enter キーで送信します。',
      'マイクボタンを押すと音声入力ができます（対応ブラウザのみ）。話し終えると自動で送信されます。',
      'AI が計算・検索などのツールを使うと、結果が [ツール名] 付きで表示されます。',
      '例：「今何時？」「3+5を計算して」など、質問や依頼をそのまま入力できます。',
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
      'ヘッダーの「模擬商談 →」リンクから模擬商談ページへ移動します。',
      'シナリオ・自分の役割（営業側／顧客側など）・難易度を選び、「開始」でセッションを始めます。',
      'AI 相手に商談のやり取りを進めます。入力欄でメッセージを送信し、音声入力も利用できます。',
      '「フィードバックを取得」で、AI からアドバイスやスコアを確認できます。',
      '「履歴」から過去のセッション一覧を表示し、内容を振り返れます。',
    ],
  },
  {
    id: 3,
    title: 'その他',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    items: [
      'この「利用手順」はヘッダーの「利用手順」ボタンでいつでも開けます。',
      'チャットの会話は、データベースを設定している場合に自動で保存されます。',
      'OPENAI_API_KEY が未設定の場合はチャット・模擬商談は利用できません。エラーが出る場合は環境変数を確認してください。',
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
