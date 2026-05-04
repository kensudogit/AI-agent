'use client';

import type { ScenarioId } from '@/lib/negotiation';
import { getScenarioSimulationStatic } from '@/lib/scenarioSimulation';

type Props = {
  scenarioId: ScenarioId;
};

/**
 * 商談中も一覧できる「論点チップ」— 実際の対面に寄せて論点を視界に残す。
 */
export default function NegotiationFocusStrip({ scenarioId }: Props) {
  const stat = getScenarioSimulationStatic(scenarioId);
  return (
    <div
      className="rounded-xl border border-amber-200/90 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/25 px-3 py-2.5 shadow-sm"
      role="region"
      aria-label="このシナリオで押さえる論点"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900/90 dark:text-amber-200/95 mb-1.5">
        実務ヒント · 論点チェック
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug mb-2">{stat.headline}</p>
      <div className="flex flex-wrap gap-1.5">
        {stat.focusPoints.map((f) => (
          <span
            key={f}
            className="inline-flex max-w-full items-center text-xs leading-tight px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/50 border border-amber-200/80 dark:border-amber-800/50 text-slate-800 dark:text-slate-200"
            title={f}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
