'use client';

import { useState, useRef, useCallback, useEffect, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  NEGOTIATION_SCENARIOS,
  SCENARIO_PICKER_META,
  getOpeningMessage,
  DIFFICULTY_LABELS,
  type ScenarioId,
  type UserRole,
  type Difficulty,
  type StructuredFeedback,
} from '@/lib/negotiation';
import { MAX_NEGOTIATION_INPUT_LENGTH } from '@/lib/constants';
import ScenarioSimulationPanel from '@/components/ScenarioSimulationPanel';
import NegotiationFocusStrip from '@/components/NegotiationFocusStrip';
import NegotiationPrepPanel from '@/components/NegotiationPrepPanel';

const INPUT_MAX_LENGTH = MAX_NEGOTIATION_INPUT_LENGTH;

type Message = { role: 'user' | 'assistant'; content: string };

type SessionSummary = {
  id: string;
  scenario_id: string;
  user_role: string;
  difficulty: string;
  title: string;
  feedback_advice: string | null;
  overall_score: number | null;
  created_at: string;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NegotiationPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId | ''>('');
  const [userRole, setUserRole] = useState<UserRole>('sales');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<StructuredFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [remoteModalOpen, setRemoteModalOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [selectScenarioHint, setSelectScenarioHint] = useState(false);
  /** SSR 後のみ Portal 可能（モーダルを body 直下に出してクリック被りを防ぐ） */
  const [mounted, setMounted] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/negotiation/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (started && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    if (!started && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [started]);

  useEffect(() => {
    if (!remoteModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRemoteModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [remoteModalOpen]);

  const startSession = useCallback(() => {
    if (!scenarioId) {
      setSelectScenarioHint(true);
      return;
    }
    setSelectScenarioHint(false);
    const scenario = NEGOTIATION_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      setSelectScenarioHint(true);
      return;
    }
    const opening = getOpeningMessage(scenario, userRole);
    setMessages([{ role: 'assistant', content: opening }]);
    setStarted(true);
    setFeedback(null);
    setSessionId(null);
    setElapsed(0);
    setRemoteModalOpen(false);
    scrollToBottom();
  }, [scenarioId, userRole, scrollToBottom]);

  const handleStartClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startSession();
    },
    [startSession]
  );

  const showCopyHint = useCallback((msg: string) => {
    setCopyHint(msg);
    window.setTimeout(() => setCopyHint(null), 2000);
  }, []);

  const copyText = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showCopyHint(`${label}をコピーしました`);
      } catch {
        showCopyHint('コピーできませんでした');
      }
    },
    [showCopyHint]
  );

  const copyTranscript = useCallback(async () => {
    if (messages.length === 0 || !scenarioId) return;
    const sc = NEGOTIATION_SCENARIOS.find((s) => s.id === scenarioId);
    if (!sc) return;
    const body = messages
      .map((m) => `${m.role === 'user' ? '【あなた】' : '【AI相手役】'}\n${m.content}`)
      .join('\n\n—\n\n');
    const header = `模擬商談ログ\nシナリオ: ${sc.title}\n役割: ${userRole === 'sales' ? '営業' : '顧客'} · 難易度: ${DIFFICULTY_LABELS[difficulty]}\n経過: ${formatElapsed(elapsed)}\n\n----------\n\n`;
    await copyText(header + body, '会話ログ');
  }, [messages, scenarioId, userRole, difficulty, elapsed, copyText]);

  const copyFeedbackBlock = useCallback(async () => {
    if (!feedback) return;
    const lines: string[] = ['=== 模擬商談フィードバック ==='];
    if (feedback.overall_score != null) lines.push(`総合: ★${feedback.overall_score}/5`);
    if (feedback.good_points.length) {
      lines.push('\n良かった点:');
      feedback.good_points.forEach((p) => lines.push(`・${p}`));
    }
    if (feedback.improve_points.length) {
      lines.push('\n改善点:');
      feedback.improve_points.forEach((p) => lines.push(`・${p}`));
    }
    if (feedback.advice) lines.push(`\nアドバイス:\n${feedback.advice}`);
    await copyText(lines.join('\n'), 'フィードバック');
  }, [feedback, copyText]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim().slice(0, INPUT_MAX_LENGTH);
      if (!trimmed || loading || !scenarioId) return;

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setLoading(true);
      scrollToBottom();

      const history = [...messages, { role: 'user' as const, content: trimmed }];

      try {
        const res = await fetch('/api/negotiation/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            scenarioId,
            userRole,
            difficulty,
          }),
        });
        if (!res.ok || !res.body) {
          const errText = await res.text();
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `エラー: ${res.status} ${errText}` },
          ]);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value, { stream: true }).split('\n');
          for (const line of lines) {
            if (!line.trim() || (line[0] !== '0' && line[0] !== 'e')) continue;
            try {
              const data = JSON.parse(line.slice(1));
              if (line[0] === 'e' && data.error) {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: `エラー: ${data.error}` },
                ]);
                scrollToBottom();
                continue;
              }
              if (data.content) {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === 'assistant') {
                    next[next.length - 1] = { ...last, content: last.content + data.content };
                  } else {
                    next.push({ role: 'assistant', content: data.content });
                  }
                  return next;
                });
                scrollToBottom();
              }
            } catch {
              // skip
            }
          }
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `通信エラー: ${e instanceof Error ? e.message : 'Unknown'}`,
          },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [loading, messages, scenarioId, userRole, difficulty, scrollToBottom]
  );

  const endSession = useCallback(async () => {
    if (messages.length === 0) {
      setStarted(false);
      setFeedback(null);
      return;
    }
    setFeedbackLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/negotiation/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          scenarioId,
          userRole,
          difficulty,
          saveSession: true,
        }),
      });
      const data = await res.json();
      if (data.feedback) setFeedback(data.feedback);
      if (data.sessionId) setSessionId(data.sessionId);
      fetchSessions();
    } catch {
      setFeedback({
        good_points: [],
        improve_points: [],
        advice: 'フィードバックの取得に失敗しました。',
      });
    } finally {
      setFeedbackLoading(false);
    }
  }, [messages, scenarioId, userRole, difficulty, fetchSessions]);

  const resetSession = useCallback(() => {
    setStarted(false);
    setMessages([]);
    setFeedback(null);
    setSessionId(null);
    setRemoteModalOpen(true);
  }, []);

  const startVoice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const Win = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition };
    const SR = Win.webkitSpeechRecognition || Win.SpeechRecognition;
    if (!SR) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'このブラウザでは音声入力に対応していません。' }]);
      return;
    }
    const recognition = new SR();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      if (text) sendMessage(text);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [sendMessage]);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const scenario = scenarioId ? NEGOTIATION_SCENARIOS.find((s) => s.id === scenarioId) : null;
  const roleLabel = userRole === 'sales' ? '営業役' : '顧客役';
  const opponentLabel = userRole === 'sales' ? '（AIが顧客）' : '（AIが営業）';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full">
              <span className="logo-circle block w-9 h-9 ring-2 ring-emerald-500/30 bg-slate-100 dark:bg-slate-700 overflow-hidden rounded-full">
                <img src="/PC.png" alt="AI Agent ロゴ" width={36} height={36} className="w-full h-full object-cover rounded-full" />
              </span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate">模擬商談</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                本番想定：論点・メモを常に表示 / 長文OK / 会話をコピーして振り返りに使えます
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setRemoteModalOpen(true)}
              className="text-sm px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M18 8h-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h2v2c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2z" />
              </svg>
              シナリオを選ぶ
            </button>
            <button
              type="button"
              onClick={() => setShowHistory((h) => !h)}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {showHistory ? '閉じる' : '履歴'}
            </button>
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap">
              トップへ
            </Link>
          </div>
        </div>
      </header>

      {showHistory && (
        <aside
          className={`shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/95 p-4 max-h-52 overflow-y-auto${remoteModalOpen ? ' pointer-events-none' : ''}`}
        >
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">過去のセッション</h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">まだ履歴がありません。</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/negotiation/history/${s.id}`}
                    className="block truncate text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {s.title || `${s.scenario_id} — ${s.user_role}`} · {new Date(s.created_at).toLocaleString('ja-JP')}
                    {s.overall_score != null && ` ★${s.overall_score}`}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      {/* リモコン盤モーダル: body に Portal + 高 z-index（main 等の後続要素がクリックを奪うのを防ぐ） */}
      {mounted &&
        remoteModalOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[1000] bg-black/50"
              onClick={() => setRemoteModalOpen(false)}
              aria-hidden
            />
            <div
              className="fixed left-1/2 top-1/2 z-[1001] w-[min(96vw,520px)] max-h-[90vh] min-h-0 -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="remote-modal-title"
            >
            <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-violet-600 text-white">
              <h2 id="remote-modal-title" className="font-semibold flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 block w-9 h-9 rounded-full ring-2 ring-white/35 bg-white/15 overflow-hidden">
                  <img
                    src="/PC.png"
                    alt=""
                    width={36}
                    height={36}
                    className="w-full h-full object-cover rounded-full"
                  />
                </span>
                <span className="truncate">シナリオを選ぶ</span>
              </h2>
              <button
                type="button"
                onClick={() => setRemoteModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-6 space-y-6 bg-slate-100 dark:bg-slate-900/95">
              {/* シナリオ: 同系色カード＋左アクセントのみ（全面ド派手色をやめて選択が1つと分かりやすく） */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <span className="w-1 h-4 rounded bg-violet-500" aria-hidden />
                  シナリオ選択
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">1つだけ選べます。色付きの縦線はシナリオ種別の目印です。</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {NEGOTIATION_SCENARIOS.map((s) => {
                    const meta = SCENARIO_PICKER_META[s.id];
                    const selected = scenarioId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setScenarioId(s.id);
                          setSelectScenarioHint(false);
                        }}
                        title={s.description}
                        aria-pressed={selected}
                        className={`group relative flex w-full flex-col items-center justify-center gap-1 rounded-xl py-3 pl-3 pr-2 min-h-[4.25rem] text-sm font-medium transition cursor-pointer select-none border active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                          selected
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-violet-500 shadow-md ring-2 ring-violet-400/80 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900'
                            : 'bg-white/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md pointer-events-none"
                          style={{ backgroundColor: meta.accentBg }}
                          aria-hidden
                        />
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white" aria-hidden>
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                        <svg
                          className={`h-5 w-5 shrink-0 ${selected ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-center leading-snug px-0.5">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                  <span className="w-1 h-4 rounded bg-violet-500" aria-hidden />
                  難易度・役割
                </h3>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(['easy', 'standard', 'hard'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition shadow-sm ${
                          difficulty === d
                            ? 'bg-violet-600 text-white border-violet-500'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setUserRole('sales')}
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition shadow-sm ${
                        userRole === 'sales'
                          ? 'bg-violet-600 text-white border-violet-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      営業側
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserRole('customer')}
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition shadow-sm ${
                        userRole === 'customer'
                          ? 'bg-violet-600 text-white border-violet-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      顧客側
                    </button>
                  </div>
                </div>
              </div>
              {scenarioId ? (
                <ScenarioSimulationPanel
                  key={`picker-${scenarioId}-${difficulty}-${userRole}`}
                  scenarioId={scenarioId}
                  userRole={userRole}
                  difficulty={difficulty}
                />
              ) : null}
              <div className="flex flex-col items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleStartClick}
                  className="w-full max-w-sm rounded-xl px-6 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  aria-label="商談を開始"
                >
                  商談を開始
                </button>
                {selectScenarioHint && (
                  <p className="text-center text-sm text-amber-700 dark:text-amber-400" role="alert">
                    シナリオを選択してください
                  </p>
                )}
              </div>
            </div>
          </div>
          </>,
          document.body
        )}
      <main
        className={`flex-1 min-h-0 w-full max-w-[1600px] mx-auto px-4 pb-4 flex flex-col gap-3${remoteModalOpen ? ' pointer-events-none' : ''}`}
      >
        {copyHint ? (
          <div
            className="fixed bottom-24 left-1/2 z-[900] -translate-x-1/2 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 shadow-lg pointer-events-none max-w-[90vw] text-center"
            role="status"
            aria-live="polite"
          >
            {copyHint}
          </div>
        ) : null}

        {!started ? (
          <div className="flex-1 flex items-center justify-center py-12 text-center">
            <div className="max-w-lg text-slate-500 dark:text-slate-400 space-y-3">
              <p className="text-base">
                「シナリオを選ぶ」でテーマ・難易度・役割を決め、商談を開始してください。
              </p>
              <ul className="text-sm text-left list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                <li>開始後は<strong className="font-medium text-slate-700 dark:text-slate-300">論点チップ</strong>と<strong className="font-medium text-slate-700 dark:text-slate-300">準備メモ</strong>で本番に近い状態で練習できます</li>
                <li>入力は<strong className="font-medium text-slate-700 dark:text-slate-300">2000文字まで</strong>（Enter 送信 / Shift+Enter 改行）</li>
                <li>終了後にフィードバック取得・会話のコピーで振り返りに活用できます</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 flex items-center justify-between flex-wrap gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-400 min-w-0">
                {scenario?.title} — {roleLabel} {opponentLabel} · {DIFFICULTY_LABELS[difficulty]} · 経過 {formatElapsed(elapsed)}
              </span>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => void copyTranscript()}
                  disabled={messages.length === 0}
                  className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
                  title="メールや議事メモに貼り付け可能な形式"
                >
                  会話をコピー
                </button>
                <button
                  type="button"
                  onClick={endSession}
                  disabled={feedbackLoading || messages.length === 0}
                  className="text-sm px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {feedbackLoading ? '取得中...' : '終了してフィードバック'}
                </button>
                <button
                  type="button"
                  onClick={resetSession}
                  className="text-sm px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  新しい商談
                </button>
              </div>
            </div>

            {scenarioId ? <NegotiationPrepPanel /> : null}
            {scenarioId ? <NegotiationFocusStrip scenarioId={scenarioId} /> : null}

            {scenarioId ? (
              <details className="shrink-0 rounded-xl border border-violet-200/70 dark:border-violet-900/50 bg-violet-50/50 dark:bg-slate-800/40 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-violet-900 dark:text-violet-200 select-none">
                  シナリオ別シミュレーション（概要・AI生成）を表示
                </summary>
                <div className="mt-3 pb-1">
                  <ScenarioSimulationPanel
                    key={`session-${scenarioId}-${difficulty}-${userRole}`}
                    scenarioId={scenarioId}
                    userRole={userRole}
                    difficulty={difficulty}
                    compact
                  />
                </div>
              </details>
            ) : null}

            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-inner">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`rounded-2xl px-5 py-3 max-w-[min(88%,42rem)] text-base leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs opacity-80">{m.role === 'user' ? 'あなた' : 'AI（相手役）'}</span>
                        <button
                          type="button"
                          onClick={() => void copyText(m.content, m.role === 'user' ? '発言' : '相手の発言')}
                          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                            m.role === 'user'
                              ? 'border-blue-300/50 text-blue-100 hover:bg-blue-500/30'
                              : 'border-slate-400/40 text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-600/50'
                          }`}
                        >
                          コピー
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-5 py-3 bg-slate-200 dark:bg-slate-700 animate-pulse text-slate-500">...</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {feedback && (
              <div className="shrink-0 p-5 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-green-900 dark:text-green-100">フィードバック（厳格・辛辣モード）</h3>
                    <p className="text-xs text-amber-800 dark:text-amber-200/90 mt-1">
                      忖度のない講評です。スコア・指摘は意図的に厳しめに付けています。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyFeedbackBlock()}
                    className="text-sm shrink-0 px-3 py-1.5 rounded-lg border border-green-700/30 dark:border-green-400/30 text-green-900 dark:text-green-100 hover:bg-green-100/80 dark:hover:bg-green-900/40"
                  >
                    フィードバックをコピー
                  </button>
                </div>
                {feedback.overall_score != null && (
                  <p className="text-sm text-green-800 dark:text-green-200">
                    総合評価: ★{feedback.overall_score}/5
                  </p>
                )}
                {feedback.good_points.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">良かった点</span>
                    <ul className="list-disc list-inside text-sm text-green-800 dark:text-green-200 mt-0.5 space-y-0.5">
                      {feedback.good_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {feedback.improve_points.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">改善できる点</span>
                    <ul className="list-disc list-inside text-sm text-green-800 dark:text-green-200 mt-0.5 space-y-0.5">
                      {feedback.improve_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {feedback.advice && (
                  <p className="text-sm text-green-800 dark:text-green-200 pt-2 border-t border-green-200 dark:border-green-700">
                    {feedback.advice}
                  </p>
                )}
              </div>
            )}

            <div className="shrink-0 flex flex-col gap-1.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 px-0.5">
                Enter で送信 · Shift+Enter で改行 · 最大 {INPUT_MAX_LENGTH} 文字（実務に近い長さで練習できます）
              </p>
              <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, INPUT_MAX_LENGTH))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="相手の発言への返答を入力…"
                  rows={3}
                  maxLength={INPUT_MAX_LENGTH}
                  className="w-full min-h-[5.5rem] rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 pr-14 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y max-h-60"
                  disabled={loading}
                  spellCheck
                />
                <span className="absolute right-3 bottom-2.5 text-xs text-slate-400 tabular-nums">
                  {input.length}/{INPUT_MAX_LENGTH}
                </span>
              </div>
              <button
                type="button"
                onClick={isListening ? stopVoice : startVoice}
                className={`p-3 rounded-xl shrink-0 ${isListening ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'} hover:opacity-90`}
                title={isListening ? '音声入力停止' : '音声入力'}
                aria-label={isListening ? '音声入力停止' : '音声入力'}
              >
                <svg className="w-6 h-6 text-slate-700 dark:text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void sendMessage(input)}
                disabled={loading || !input.trim()}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0 min-h-[44px] self-stretch sm:self-auto"
              >
                送信
              </button>
            </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
