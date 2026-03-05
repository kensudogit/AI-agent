'use client';

import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const sections = [
  {
    id: 1,
    title: 'ファイルのアップロード・編集',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    items: [
      'リモコン盤の「▲ アップロード」ボタンからHTMLファイルをアップロード',
      'アップロード後、サーバーのアップロードフォルダにファイルが保存されます (元のファイルは変更されません)',
      '左側のエディタでHTMLソースを編集可能',
      '右側のプレビューでリアルタイムに変更内容を確認',
      '「保存」ボタンで編集内容を保存 (Ctrl+Sでも保存可能) ※アップロード先のファイルが更新されます',
    ],
  },
  {
    id: 2,
    title: '自由配置モード',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    items: [
      'リモコン盤の「■ 自由配置モード」ボタンをクリック',
      'HTMLソースとプレビューウィンドウを自由に移動・リサイズ可能',
      'ウィンドウのヘッダーをドラッグして移動',
      'ウィンドウの端や角をドラッグしてリサイズ',
      '配置は自動保存され、次回起動時にも復元されます',
      '「▲ 通常モード」で元の分割表示に戻せます',
    ],
  },
  {
    id: 3,
    title: '画面比較機能',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    ),
    items: [
      'リモコン盤の「■ 画面比較」ボタンをクリック',
      '比較対象ディレクトリパスを入力 (例: C:\\universities)',
      '「■ファイル読み込み」でHTML/CSSファイルを自動検出(最大27ファイル)',
      'HTMLファイルとCSSファイルが自動的に関連付けられます',
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
