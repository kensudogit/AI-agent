'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import UsageInstructionsModal from '@/components/UsageInstructionsModal';

type Message = { role: 'user' | 'assistant'; content: string; tool?: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setLoading(true);
      scrollToBottom();

      const history = [...messages, { role: 'user' as const, content: trimmed }].map(
        ({ role, content }) => ({ role, content })
      );

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            conversationId,
          }),
        });
        if (!res.ok || !res.body) {
          const errText = await res.text();
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `Error: ${res.status} ${errText}` },
          ]);
          return;
        }

        let assistantContent = '';
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value, { stream: true }).split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            const kind = line[0];
            const payload = line.slice(1);
            try {
              const data = JSON.parse(payload);
              if (kind === '0' && data.content) {
                assistantContent += data.content;
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
              if (kind === '1' && data.tool && data.result) {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: `[${data.tool}] ${data.result}`, tool: data.tool },
                ]);
                scrollToBottom();
              }
            } catch {
              // skip invalid lines
            }
          }
        }

        if (!conversationId && (messages.length > 0 || assistantContent)) {
          const createRes = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: trimmed.slice(0, 50) }),
          });
          if (createRes.ok) {
            const { id } = await createRes.json();
            setConversationId(id);
          }
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Network error: ${e instanceof Error ? e.message : 'Unknown'}` },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [loading, messages, conversationId, scrollToBottom]
  );

  const startVoice = useCallback(() => {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'このブラウザでは音声入力に対応していません。' },
      ]);
      return;
    }
    const SpeechRecognition = (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition; SpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition
      || (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
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

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900">
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full">
              <span className="logo-circle block w-10 h-10 ring-2 ring-emerald-500/30 bg-slate-100 dark:bg-slate-700 overflow-hidden rounded-full">
                <img src="/PC.png" alt="AI Agent ロゴ" width={40} height={40} className="w-full h-full object-cover rounded-full" />
              </span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">AI Agent</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">音声・テキストで会話し、アクションを実行</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setUsageModalOpen(true)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
              </svg>
              利用手順
            </button>
            <Link href="/negotiation" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap">
              模擬商談 →
            </Link>
          </div>
        </div>
      </header>

      <UsageInstructionsModal open={usageModalOpen} onClose={() => setUsageModalOpen(false)} />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 dark:text-slate-400 py-16">
                <p className="text-base">メッセージを入力するか、マイクボタンで話しかけてください。</p>
                <p className="text-sm mt-2">例: 「今何時？」「3+5を計算して」</p>
              </div>
            )}
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`rounded-2xl px-5 py-3 max-w-[88%] text-base leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {m.tool && <span className="text-xs opacity-80 block mb-1">[{m.tool}]</span>}
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
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/95">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto flex gap-2 items-center">
            <button
              type="button"
              onClick={isListening ? stopVoice : startVoice}
              className={`p-3 rounded-xl shrink-0 ${isListening ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'} hover:opacity-90`}
              title={isListening ? '音声入力停止' : '音声入力'}
              aria-label={isListening ? '音声入力停止' : '音声入力'}
            >
              <span className="sr-only">{isListening ? '停止' : 'マイク'}</span>
              <svg className="w-6 h-6 text-slate-700 dark:text-slate-200" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="メッセージを入力…"
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
