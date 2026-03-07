'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NEGOTIATION_SCENARIOS, DIFFICULTY_LABELS } from '@/lib/negotiation';

type SessionDetail = {
  id: string;
  scenario_id: string;
  user_role: string;
  difficulty: string;
  title: string;
  feedback_raw: string | null;
  feedback_good: string[] | null;
  feedback_improve: string[] | null;
  feedback_advice: string | null;
  overall_score: number | null;
  created_at: string;
  messages: { role: string; content: string; created_at: string }[];
};

export default function NegotiationHistoryPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/negotiation/sessions/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSession(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500">{loading ? '読み込み中...' : 'セッションが見つかりません。'}</p>
      </div>
    );
  }

  const scenario = NEGOTIATION_SCENARIOS.find((s) => s.id === session.scenario_id);
  const roleLabel = session.user_role === 'sales' ? '営業側' : '顧客側';
  const goodPoints = Array.isArray(session.feedback_good) ? session.feedback_good : [];
  const improvePoints = Array.isArray(session.feedback_improve) ? session.feedback_improve : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">商談履歴</h1>
          <Link href="/negotiation" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
            模擬商談に戻る
          </Link>
        </div>
      </header>
      <main className="w-full max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {scenario?.title ?? session.scenario_id} · {roleLabel} · {DIFFICULTY_LABELS[session.difficulty as keyof typeof DIFFICULTY_LABELS] ?? session.difficulty} · {new Date(session.created_at).toLocaleString('ja-JP')}
        </div>

        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">会話ログ</h2>
          <div className="space-y-3">
            {session.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-xl px-3 py-2 max-w-[85%] ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <span className="text-xs opacity-80">{m.role === 'user' ? 'あなた' : 'AI'}</span>
                  <p className="whitespace-pre-wrap text-sm mt-0.5">{m.content}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {(session.feedback_advice || goodPoints.length > 0 || improvePoints.length > 0) && (
          <section className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4 space-y-3">
            <h2 className="text-sm font-medium text-green-900 dark:text-green-100">フィードバック</h2>
            {session.overall_score != null && (
              <p className="text-sm text-green-800 dark:text-green-200">総合評価: ★{session.overall_score}/5</p>
            )}
            {goodPoints.length > 0 && (
              <div>
                <span className="text-xs font-medium text-green-700 dark:text-green-300">良かった点</span>
                <ul className="list-disc list-inside text-sm text-green-800 dark:text-green-200 mt-0.5">
                  {goodPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {improvePoints.length > 0 && (
              <div>
                <span className="text-xs font-medium text-green-700 dark:text-green-300">改善できる点</span>
                <ul className="list-disc list-inside text-sm text-green-800 dark:text-green-200 mt-0.5">
                  {improvePoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {session.feedback_advice && (
              <p className="text-sm text-green-800 dark:text-green-200 pt-1 border-t border-green-200 dark:border-green-700">
                {session.feedback_advice}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
