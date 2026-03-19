"use client";

import React, { useRef, useEffect, useState, KeyboardEvent } from "react";
import { useChatStore, ChatMessage, Conversation } from "./stores/chat-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  ChevronDown,
  ChevronRight,
  Download,
  Plus,
  MessageSquare,
  X,
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

  const config: Record<
    string,
    { icon: React.ReactNode; label: string; cls: string }
  > = {
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
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Collapsible image (used inside markdown rendering) ─────────────────────
function CollapsibleImage({ src, alt }: { src: string; alt: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <ImageIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-xs text-gray-600 truncate">
          {alt || "Графика"}
        </span>
      </button>
      {expanded && (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
        </a>
      )}
    </div>
  );
}

// ── Report & chart file download links ─────────────────────────────────────
function FileDownloads({
  reportFiles,
  chartFiles,
  analysisId,
}: {
  reportFiles: string[];
  chartFiles: string[];
  analysisId?: string;
}) {
  const allFiles = [
    ...reportFiles.map((f) => ({ name: f, type: "report" as const })),
    ...chartFiles.map((f) => ({ name: f, type: "chart" as const })),
  ];
  if (allFiles.length === 0) return null;

  const baseUrl = analysisId
    ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
    : `/api/v1/agentic/reports`;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500 font-medium">
        <Download className="w-3.5 h-3.5" />
        <span>Файлове ({allFiles.length})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {allFiles.map(({ name, type }) => (
          <a
            key={name}
            href={`${baseUrl}/${encodeURIComponent(name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
              type === "report"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            }`}
          >
            {type === "report" ? (
              <FileText className="w-3 h-3" />
            ) : (
              <ImageIcon className="w-3 h-3" />
            )}
            {name}
          </a>
        ))}
      </div>
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

// ── Custom markdown components (rewrite image src to API, make collapsible) ─
// Factory: returns components that resolve image paths with the correct analysisId
function makeMarkdownComponents(analysisId?: string): Record<string, any> {
  const baseUrl = analysisId
    ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
    : `/api/v1/agentic/reports`;

  return {
    // Unwrap <p> tags that contain only an image to avoid <div> inside <p> hydration error
    p: ({ node, children, ...rest }: any) => {
      const childArray = React.Children.toArray(children);
      if (
        childArray.length === 1 &&
        typeof childArray[0] === "object" &&
        (childArray[0] as any)?.type === CollapsibleImage
      ) {
        return <>{children}</>;
      }
      return <p {...rest}>{children}</p>;
    },
    img: ({ node, src, alt, ...rest }: any) => {
      const rawSrc = String(src || "");
      const resolvedSrc =
        rawSrc && !rawSrc.startsWith("http") && !rawSrc.startsWith("/")
          ? `${baseUrl}/${encodeURIComponent(rawSrc)}`
          : rawSrc;
      return <CollapsibleImage src={resolvedSrc} alt={String(alt || "")} />;
    },
  };
}

// ── Single message bubble ──────────────────────────────────────────────────
function MessageBubble({
  message,
  analysisId,
}: {
  message: ChatMessage;
  analysisId?: string;
}) {
  const isUser = message.role === "user";

  // Determine the content to render: prefer reportMarkdown over plain content
  const displayContent = message.reportMarkdown || message.content;
  const mdComponents = React.useMemo(
    () => makeMarkdownComponents(analysisId),
    [analysisId],
  );

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
      <div
        className={`flex-1 max-w-[85%] ${isUser ? "flex flex-col items-end" : ""}`}
      >
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
            <div className="text-sm md-content">
              {message.status && <StatusBadge status={message.status} />}
              {displayContent && (
                <div className="mt-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={mdComponents}
                  >
                    {displayContent}
                  </ReactMarkdown>
                </div>
              )}
              {/* File downloads */}
              {message.status === "completed" && (
                <FileDownloads
                  reportFiles={message.reportFiles || []}
                  chartFiles={message.chartFiles || []}
                  analysisId={analysisId}
                />
              )}
            </div>
          )}
        </div>

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

// ── Conversation status icon ───────────────────────────────────────────────
function ConvStatusIcon({ status }: { status: Conversation["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case "failed":
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    default:
      return <MessageSquare className="w-3 h-3 text-gray-400" />;
  }
}

// ── History sidebar ────────────────────────────────────────────────────────
function HistorySidebar() {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    deleteConversation,
    clearAllConversations,
  } = useChatStore();

  const [tooltip, setTooltip] = React.useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);

  const showTooltip = (e: React.MouseEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ text, top: rect.top, left: rect.right + 8 });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          История
        </h2>
      </div>

      {/* Tooltip — fixed position to escape all overflow clipping */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-[9999] w-72"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          <div className="rounded-lg bg-gray-900/80 backdrop-blur-md text-white text-xs leading-relaxed px-3 py-2.5 shadow-xl border border-gray-700/40">
            <p className="font-medium text-gray-400 mb-1 text-[10px] uppercase tracking-wide">
              Пълен въпрос
            </p>
            <p className="whitespace-pre-wrap break-words">{tooltip.text}</p>
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Няма анализи</p>
          </div>
        ) : (
          <div className="py-1">
            {conversations.map((conv) => {
              const fullPrompt =
                conv.messages.find((m) => m.role === "user")?.content ||
                conv.title;
              return (
                <div
                  key={conv.id}
                  className={`group/item flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                    conv.id === activeConversationId
                      ? "bg-blue-50 border-r-2 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => selectConversation(conv.id)}
                  onMouseEnter={(e) => showTooltip(e, fullPrompt)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <ConvStatusIcon status={conv.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        conv.id === activeConversationId
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      {conv.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(conv.createdAt).toLocaleString("bg-BG", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="flex-shrink-0 opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-red-100 transition-all"
                    title="Изтрий"
                  >
                    <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {conversations.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={clearAllConversations}
            className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-red-500 transition-colors w-full justify-center py-1"
          >
            <Trash2 className="w-3 h-3" />
            Изчисти всички
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AiChatPage() {
  const {
    conversations,
    activeConversationId,
    activeConversation,
    isLoading,
    sendAnalysis,
  } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conv = activeConversation();
  const messages = conv?.messages ?? [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
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

  // Show empty state when no conversation is selected
  const showEmptyState = !activeConversationId || messages.length === 0;

  return (
    <div className="flex h-full max-h-[calc(100vh-3rem)] bg-gray-50">
      {/* ── History sidebar ─────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* New analysis button */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <button
            onClick={() => {
              setInput("");
              useChatStore.getState().selectConversation("");
            }}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Нов анализ
          </button>
        </div>
        <HistorySidebar />
      </div>

      {/* ── Main content area ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">
                AI Анализатор
              </h1>
              <p className="text-xs text-gray-500">
                Многоагентна система за анализ на данни от мелнично
              </p>
            </div>
          </div>
          {conv && (
            <div className="flex items-center gap-2">
              <ConvStatusIcon status={conv.status} />
              <span className="text-xs text-gray-500 max-w-[200px] truncate">
                {conv.title}
              </span>
            </div>
          )}
        </div>

        {/* ── Messages / empty state ───────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {showEmptyState ? (
            <div className="flex flex-col items-center justify-center h-full gap-8 text-center">
              <div>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
                  <Bot className="w-9 h-9 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-1">
                  Какво искате да анализирам?
                </h2>
                <p className="text-sm text-gray-500 max-w-md">
                  Задайте въпрос за мелничните данни. AI агентите ще заредят
                  данни, направят анализ, генерират графики и напишат доклад.
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
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {s.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                analysisId={conv?.analysisId}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input area ───────────────────────────────────── */}
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
            Анализът може да отнеме 2-5 минути. Агентите зареждат данни,
            анализират и генерират доклад.
          </p>
        </div>
      </div>
    </div>
  );
}
