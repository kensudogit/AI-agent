'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  NEGOTIATION_SCENARIOS,
  getOpeningMessage,
  DIFFICULTY_LABELS,
  type ScenarioId,
  type UserRole,
  type Difficulty,
  type StructuredFeedback,
} from '@/lib/negotiation';

const INPUT_MAX_LENGTH = 500;

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
  const [remoteOpen, setRemoteOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [selectScenarioHint, setSelectScenarioHint] = useState(false);

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
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [started]);

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
    setRemoteOpen(false);
    scrollToBottom();
  }, [scenarioId, userRole, scrollToBottom]);

  const handleStartClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startSession();
    },
    [startSession]
  );

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
            if (!line.trim() || line[0] !== '0') continue;
            try {
              const data = JSON.parse(line.slice(1));
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
    setRemoteOpen(true);
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
                実践的な商談シミュレーション — シナリオ・難易度・役割を選んで開始
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
        <aside className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/95 p-4 max-h-52 overflow-y-auto">
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

      {/* 伸長式リモコン盤: シナリオ・難易度・役割・開始 */}
      <section className="shrink-0 w-full max-w-[1600px] mx-auto px-4 py-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setRemoteOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            aria-expanded={remoteOpen}
          >
            <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              シナリオを選ぶ
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[50%]">
              {scenario ? scenario.title : '未選択'}
              {scenario && ` · ${DIFFICULTY_LABELS[difficulty]} · ${roleLabel}`}
            </span>
            <svg
              className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${remoteOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {remoteOpen && (
            <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4 max-h-[min(70vh,520px)] overflow-y-auto">
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">シナリオ</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {NEGOTIATION_SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setScenarioId(s.id);
                        setSelectScenarioHint(false);
                      }}
                      className={`text-left p-3 rounded-xl border-2 transition text-sm ${
                        scenarioId === s.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/25 text-blue-800 dark:text-blue-200'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <span className="font-medium block text-slate-900 dark:text-white">{s.title}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{s.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">難易度</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(['easy', 'standard', 'hard'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition ${
                          difficulty === d
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">あなたの役割</span>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={userRole === 'sales'}
                        onChange={() => setUserRole('sales')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-slate-900 dark:text-white text-sm">営業側</span>
                      <span className="text-xs text-slate-500">（AIが顧客）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={userRole === 'customer'}
                        onChange={() => setUserRole('customer')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-slate-900 dark:text-white text-sm">顧客側</span>
                      <span className="text-xs text-slate-500">（AIが営業）</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleStartClick}
                    className="cursor-pointer px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="商談を開始"
                  >
                    商談を開始
                  </button>
                  {selectScenarioHint && (
                    <p className="text-xs text-amber-600 dark:text-amber-400" role="alert">
                      シナリオを選択してください
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto px-4 pb-4 flex flex-col gap-3">
        {!started ? (
          <div className="flex-1 flex items-center justify-center py-12 text-center">
            <div className="max-w-md text-slate-500 dark:text-slate-400">
              <p className="text-base">上記のリモコン盤でシナリオ・難易度・役割を選び、「商談を開始」を押してください。</p>
              <p className="text-sm mt-2">開始後、チャットエリアが表示され、AIが相手役として応答します。</p>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 flex items-center justify-between flex-wrap gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                {scenario?.title} — {roleLabel} {opponentLabel} · {DIFFICULTY_LABELS[difficulty]} · 経過 {formatElapsed(elapsed)}
              </span>
              <div className="flex gap-2">
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

            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-inner">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`rounded-2xl px-5 py-3 max-w-[88%] text-base leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      <span className="text-xs opacity-80 block mb-1">{m.role === 'user' ? 'あなた' : 'AI'}</span>
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
                <h3 className="font-semibold text-green-900 dark:text-green-100">フィードバック</h3>
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

            <div className="shrink-0 flex gap-2 items-end">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, INPUT_MAX_LENGTH))}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                  placeholder="メッセージを入力（最大500文字）…"
                  maxLength={INPUT_MAX_LENGTH}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 pr-16 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <span className="absolute right-3 bottom-2.5 text-xs text-slate-400">
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
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                送信
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
