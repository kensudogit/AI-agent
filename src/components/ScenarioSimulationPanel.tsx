'use client';

import { useState, useCallback, useId } from 'react';
import type { ScenarioId, UserRole, Difficulty } from '@/lib/negotiation';
import { getScenarioSimulationStatic } from '@/lib/scenarioSimulation';
import { DIFFICULTY_LABELS } from '@/lib/negotiation';

type Props = {
  scenarioId: ScenarioId;
  userRole: UserRole;
  difficulty: Difficulty;
  /** true のとき余白と見出しをやや小さく（インライン折りたたみ向け） */
  compact?: boolean;
};

export default function ScenarioSimulationPanel({
  scenarioId,
  userRole,
  difficulty,
  compact = false,
}: Props) {
  const titleId = useId();
  const stat = getScenarioSimulationStatic(scenarioId);
  const [aiText, setAiText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateAi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/negotiation/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, userRole, difficulty }),
      });
      const data = (await res.json()) as { simulation?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setAiText(typeof data.simulation === 'string' ? data.simulation : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました');
      setAiText(null);
    } finally {
      setLoading(false);
    }
  }, [scenarioId, userRole, difficulty]);

  const copyAi = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('コピーできませんでした');
    }
  }, [aiText]);

  const roleLabel = userRole === 'sales' ? 'あなたは営業側（AI は顧客役）' : 'あなたは顧客側（AI は営業役）';

  return (
    <section
      className={`rounded-xl border border-violet-200/80 dark:border-violet-800/80 bg-white dark:bg-slate-800/90 ${
        compact ? 'p-3' : 'p-4'
      } space-y-3 shadow-sm`}
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            id={titleId}
            className={`font-semibold text-slate-900 dark:text-white ${compact ? 'text-sm' : 'text-base'}`}
          >
            シナリオ別シミュレーション
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {stat.headline} · {DIFFICULTY_LABELS[difficulty]} · {roleLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={generateAi}
          disabled={loading}
          className="shrink-0 text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium"
        >
          {loading ? 'AI生成中…' : '詳細をAI生成'}
        </button>
      </div>

      <div className={`space-y-2 text-slate-700 dark:text-slate-300 ${compact ? 'text-xs' : 'text-sm'}`}>
        <p className="leading-relaxed">{stat.premise}</p>
        <ol className="list-decimal list-inside space-y-1.5 pl-0.5">
          {stat.phases.map((p) => (
            <li key={p.label}>
              <span className="font-medium text-slate-800 dark:text-slate-200">{p.label}</span>
              {' — '}
              {p.description}
            </li>
          ))}
        </ol>
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200">焦点になりやすい論点</span>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            {stat.focusPoints.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        {stat.sampleCue && (
          <p className="italic text-slate-600 dark:text-slate-400 border-l-2 border-violet-400 pl-2">
            きっかけの例: {stat.sampleCue}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {aiText && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">AI生成シミュレーション（詳細）</span>
            <button
              type="button"
              onClick={copyAi}
              className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {copied ? 'コピーしました' : 'コピー'}
            </button>
          </div>
          <pre
            className={`whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-3 overflow-x-auto text-slate-800 dark:text-slate-200 ${
              compact ? 'text-xs max-h-64' : 'text-sm max-h-[min(70vh,480px)]'
            }`}
          >
            {aiText}
          </pre>
        </div>
      )}
    </section>
  );
}
