"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { useChatStore, ChatMessage } from "./stores/chat-store";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  ImageIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

// ── Suggested prompts ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  {
    label: "Сравнение на мелници",
    prompt:
      "Сравни средното натоварване по руда на всички мелници за последните 72 часа. Генерирай сравнителни графики и хистограми.",
  },
  {
    label: "Анализ на Мелница 8",
    prompt:
      "Направи пълен анализ на Мелница 8 за последните 30 дни — EDA, SPC контролни карти за PSI80 и Ore, корелации и аномалии.",
  },
  {
    label: "Престои",
    prompt:
      "Анализирай престоите на всички мелници за последните 7 дни. Покажи периодите с Ore < 10 т/ч и дай препоръки.",
  },
  {
    label: "Качество на смилане",
    prompt:
      "Анализирай качеството на смилане (PSI80, PSI200) за Мелница 6 и Мелница 8 за последните 14 дни. Сравни ги графично.",
  },
];

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: ChatMessage["status"] }) {
  if (!status) return null;

  const config: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    pending: {
      icon: <Clock className="w-3 h-3" />,
      label: "Изчакване...",
      cls: "bg-yellow-100 text-yellow-700",
    },
    running: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: "Агентите работят...",
      cls: "bg-blue-100 text-blue-700",
    },
    completed: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Завършен",
      cls: "bg-green-100 text-green-700",
    },
    failed: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: "Грешка",
      cls: "bg-red-100 text-red-700",
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Chart images ───────────────────────────────────────────────────────────
function ChartGallery({ chartFiles, analysisId }: { chartFiles: string[]; analysisId?: string }) {
  if (!chartFiles || chartFiles.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500 font-medium">
        <ImageIcon className="w-3.5 h-3.5" />
        <span>Генерирани графики ({chartFiles.length})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {chartFiles.map((file) => (
          <a
            key={file}
            href={`/api/agentic/reports/${encodeURIComponent(file)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <img
              src={`/api/agentic/reports/${encodeURIComponent(file)}`}
              alt={file}
              className="w-full h-auto"
              loading="lazy"
            />
            <div className="px-2 py-1 bg-gray-50 text-xs text-gray-600 truncate">{file}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Report files ───────────────────────────────────────────────────────────
function ReportLinks({ reportFiles }: { reportFiles: string[] }) {
  if (!reportFiles || reportFiles.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {reportFiles.map((file) => (
        <a
          key={file}
          href={`/api/agentic/reports/${encodeURIComponent(file)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-200"
        >
          <FileText className="w-3.5 h-3.5" />
          {file}
        </a>
      ))}
    </div>
  );
}

// ── Typing animation dots ──────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

// ── Single message bubble ──────────────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-emerald-600" : "bg-slate-700"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "flex flex-col items-end" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-emerald-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : message.status === "running" && !message.content ? (
            <TypingIndicator />
          ) : (
            <div className="text-sm prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-li:my-0.5 prose-pre:bg-gray-900 prose-pre:text-gray-100">
              {message.status && <StatusBadge status={message.status} />}
              {message.content && (
                <div className="mt-2">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Charts and reports below assistant bubble */}
        {!isUser && message.status === "completed" && (
          <>
            <ChartGallery chartFiles={message.chartFiles || []} analysisId={message.analysisId} />
            <ReportLinks reportFiles={message.reportFiles || []} />
          </>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-gray-400 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString("bg-BG", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AiChatPage() {
  const { messages, isLoading, sendAnalysis, clearChat } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendAnalysis(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (prompt: string) => {
    if (isLoading) return;
    setInput("");
    sendAnalysis(prompt);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-3rem)] bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">AI Анализатор</h1>
            <p className="text-xs text-gray-500">
              Многоагентна система за анализ на данни от мелнично
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Изчисти чата"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Изчисти</span>
          </button>
        )}
      </div>

      {/* ── Messages area ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          /* ── Empty state with suggestions ──────────────────── */
          <div className="flex flex-col items-center justify-center h-full gap-8 text-center">
            <div>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
                <Bot className="w-9 h-9 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">
                Какво искате да анализирам?
              </h2>
              <p className="text-sm text-gray-500 max-w-md">
                Задайте въпрос за мелничните данни. AI агентите ще заредят данни,
                направят анализ, генерират графики и напишат доклад.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestion(s.prompt)}
                  className="text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600">
                    {s.label}
                  </span>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-gray-50">
        <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-2xl px-4 py-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Задайте въпрос за мелничните данни..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none py-1.5 max-h-40 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          Анализът може да отнеме 2-5 минути. Агентите зареждат данни, анализират и генерират доклад.
        </p>
      </div>
    </div>
  );
}
