'use client';

import { useEffect, useState, useCallback } from 'react';

const LS_GOAL = 'ai-agent-negotiation-session-goal';
const LS_NOTES = 'ai-agent-negotiation-prep-notes';

/**
 * 本番に近い準備：ゴールとメモをブラウザに保存（リロード後も残る）。
 */
export default function NegotiationPrepPanel() {
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      setGoal(localStorage.getItem(LS_GOAL) ?? '');
      setNotes(localStorage.getItem(LS_NOTES) ?? '');
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_GOAL, goal);
    } catch {
      /* ignore */
    }
  }, [goal]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_NOTES, notes);
    } catch {
      /* ignore */
    }
  }, [notes]);

  const clearAll = useCallback(() => {
    setGoal('');
    setNotes('');
    try {
      localStorage.removeItem(LS_GOAL);
      localStorage.removeItem(LS_NOTES);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400" aria-hidden>
            📋
          </span>
          商談準備（本日のゴール・メモ）
        </span>
        <span className="text-xs text-slate-400">{open ? '閉じる' : '開く'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-slate-100 dark:border-slate-700/80">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">本日のゴール（1行）</span>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例: 次回デモの日程だけ確定させる / 単価のレンジを口頭で合意する"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              maxLength={200}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">メモ（質問リスト・禁止事項・上司指示など）</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                '・確認したいこと\n・譲れない条件\n・次に言う一言のメモ'
              }
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y min-h-[88px]"
              maxLength={4000}
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block text-right">{notes.length}/4000</span>
          </label>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
          >
            ゴールとメモをクリア
          </button>
        </div>
      )}
    </div>
  );
}
