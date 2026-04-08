"use client";

import React, {
  useRef,
  useEffect,
  useState,
  KeyboardEvent,
  useCallback,
} from "react";
import {
  useChatStore,
  ChatMessage,
  Conversation,
  ProgressMessage,
} from "./stores/chat-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReactToPrint } from "react-to-print";
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
  Printer,
  BookmarkPlus,
  Bookmark,
  Edit3,
  Star,
  Mic,
  Square,
  Copy,
  ClipboardCheck,
  LayoutTemplate,
} from "lucide-react";
import { useUserPrompts, UserPrompt } from "./hooks/useUserPrompts";
import SettingsPanel from "./components/settings-panel";
import { useSettingsStore } from "./stores/settings-store";

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

// ── Add / Edit Prompt Dialog ─────────────────────────────────────────────
function AddPromptDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, description: string) => void;
  initial?: { title: string; description: string };
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDesc(initial?.description ?? "");
    }
  }, [open, initial]);

  if (!open) return null;

  const canSave = title.trim().length > 0 && desc.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {initial ? "Редакция на промпт" : "Нов промпт"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Заглавие
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="напр. Анализ на Мелница 6"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Промпт
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Опишете какво трябва да анализират агентите..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Отказ
          </button>
          <button
            onClick={() => {
              if (canSave) {
                onSave(title.trim(), desc.trim());
                onClose();
              }
            }}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Запази
          </button>
        </div>
      </div>
    </div>
  );
}

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

// ── Collapsible user message (for long prompts) ─────────────────────────────
const COLLAPSE_THRESHOLD = 300; // characters

function CollapsibleUserMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > COLLAPSE_THRESHOLD;

  if (!isLong) {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className="text-sm">
      <p className={`whitespace-pre-wrap ${expanded ? "" : "line-clamp-4"}`}>
        {content}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-xs font-medium text-emerald-200 hover:text-white transition-colors inline-flex items-center gap-0.5"
      >
        {expanded ? (
          <>
            <ChevronDown className="w-3 h-3 rotate-180" />
            Свий
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Покажи всичко
          </>
        )}
      </button>
    </div>
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
    // Avoid <div> inside <p> hydration error: detect images via the AST node
    // (the img component returns a <div>, which can't be inside <p>)
    p: ({ node, children, ...rest }: any) => {
      const hasImage = node?.children?.some(
        (child: any) =>
          child.tagName === "img" ||
          (child.type === "element" && child.tagName === "img"),
      );
      if (hasImage) {
        return (
          <div className="my-1" {...rest}>
            {children}
          </div>
        );
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

// ── Print-optimized markdown components (images always expanded, no collapsible) ─
function makePrintMarkdownComponents(analysisId?: string): Record<string, any> {
  const baseUrl = analysisId
    ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
    : `/api/v1/agentic/reports`;

  return {
    img: ({ node, src, alt, ...rest }: any) => {
      const rawSrc = String(src || "");
      const resolvedSrc =
        rawSrc && !rawSrc.startsWith("http") && !rawSrc.startsWith("/")
          ? `${baseUrl}/${encodeURIComponent(rawSrc)}`
          : rawSrc;
      return (
        <img
          src={resolvedSrc}
          alt={String(alt || "")}
          style={{ maxWidth: "100%", height: "auto", margin: "0.5rem 0" }}
        />
      );
    },
  };
}

// ── Printable report (hidden off-screen, used by react-to-print) ────────
const PrintableReport = React.forwardRef<
  HTMLDivElement,
  { markdown: string; title: string; analysisId?: string }
>(function PrintableReport({ markdown, title, analysisId }, ref) {
  const printMdComponents = React.useMemo(
    () => makePrintMarkdownComponents(analysisId),
    [analysisId],
  );

  return (
    <div style={{ overflow: "hidden", height: 0, width: 0 }}>
      <div
        ref={ref}
        className="print-report"
        style={{
          width: "210mm",
          padding: "2rem",
          fontSize: "11pt",
          lineHeight: 1.6,
          color: "#1a1a1a",
          background: "white",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={printMdComponents}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
});

// ── Copy text button ─────────────────────────────────────────────────────
function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("[Copy] Failed to copy text");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
      title={copied ? "Копирано!" : "Копирай текста"}
    >
      {copied ? (
        <ClipboardCheck className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ── Export PDF button ────────────────────────────────────────────────────
function ExportPdfButton({
  markdown,
  title,
  analysisId,
}: {
  markdown: string;
  title: string;
  analysisId?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: title.replace(/\s+/g, "_"),
    pageStyle: `
      @page {
        size: A4;
        margin: 15mm;
      }
    `,
  });

  return (
    <>
      <PrintableReport
        ref={contentRef}
        markdown={markdown}
        title={title}
        analysisId={analysisId}
      />
      <button
        onClick={() => handlePrint()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
        title="Експорт като PDF"
      >
        <Printer className="w-3 h-3" />
        Експорт PDF
      </button>
    </>
  );
}

// ── Progress feed (live agent messages) ────────────────────────────────────

const STAGE_ICONS: Record<string, string> = {
  system: "⚙️",
  planner: "📋",
  data_loader: "📂",
  analyst: "📊",
  forecaster: "📈",
  anomaly_detective: "🔍",
  bayesian_analyst: "🎲",
  optimizer: "⚡",
  shift_reporter: "📝",
  code_reviewer: "✅",
  reporter: "📄",
  manager: "👔",
  tools: "🔧",
};

function ProgressFeed({ messages }: { messages: ProgressMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!messages || messages.length === 0) return null;

  return (
    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-1 text-xs">
      {messages.map((pm, i) => {
        const icon = STAGE_ICONS[pm.stage] || "•";
        const isLast = i === messages.length - 1;
        return (
          <div
            key={i}
            className={`flex items-start gap-1.5 ${
              isLast ? "text-blue-700 font-medium" : "text-gray-500"
            }`}
          >
            <span className="flex-shrink-0 w-4 text-center">{icon}</span>
            <span className="flex-1 leading-tight">{pm.message}</span>
            {isLast && (
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 mt-0.5 text-blue-500" />
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
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
            <div className="relative group">
              <CollapsibleUserMessage content={message.content} />
              <button
                onClick={() => navigator.clipboard.writeText(message.content)}
                className="absolute top-0 right-0 p-1.5 rounded-lg bg-white/20 hover:bg-white/40 transition-all"
                title="Копирай"
              >
                <Copy className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : message.status === "running" && !message.content ? (
            <div>
              <TypingIndicator />
              {message.progressMessages &&
                message.progressMessages.length > 0 && (
                  <ProgressFeed messages={message.progressMessages} />
                )}
            </div>
          ) : (
            <div className="text-sm md-content relative">
              <div className="flex items-center justify-between">
                {message.status && <StatusBadge status={message.status} />}
                <div className="flex items-center gap-1">
                  {message.status === "completed" && displayContent && (
                    <CopyTextButton text={displayContent} />
                  )}
                  {message.status === "completed" && displayContent && (
                    <ExportPdfButton
                      markdown={displayContent}
                      title={
                        message.reportFiles?.[0]?.replace(/\.md$/, "") ||
                        "Report"
                      }
                      analysisId={analysisId}
                    />
                  )}
                </div>
              </div>
              {message.status === "running" &&
                message.progressMessages &&
                message.progressMessages.length > 0 && (
                  <ProgressFeed messages={message.progressMessages} />
                )}
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

// ── Collapsible user prompt card ────────────────────────────────────────────
function UserPromptCard({
  prompt: p,
  onUse,
  onDelete,
}: {
  prompt: UserPrompt;
  onUse: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative text-left px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 group-hover:text-amber-700">
          {p.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex-shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 text-gray-300 hover:text-red-500 transition-all"
          title="Изтрий"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <p
        className={`text-xs text-gray-400 mt-1 cursor-pointer ${expanded ? "" : "line-clamp-2"}`}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? "Свий" : "Разгъни"}
      >
        {p.description}
      </p>

      {expanded && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200/60">
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronDown className="w-3 h-3 inline mr-0.5 rotate-180" />
            Свий
          </button>
          <button
            onClick={onUse}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <Send className="w-3 h-3" />
            Използвай
          </button>
        </div>
      )}

      {!expanded && (
        <button
          onClick={onUse}
          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/80 text-white hover:bg-amber-600 transition-colors"
        >
          <Send className="w-3 h-3" />
          Използвай
        </button>
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
    hydrateFromStorage,
  } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate conversations from localStorage after first client render to avoid SSR mismatch
  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  const conv = activeConversation();
  const messages = conv?.messages ?? [];

  // Scroll to top when switching conversations, auto-scroll to bottom only for new messages
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevConvIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (
      prevConvIdRef.current !== undefined &&
      prevConvIdRef.current !== activeConversationId
    ) {
      // Conversation changed — scroll to top
      scrollContainerRef.current?.scrollTo({ top: 0 });
    } else {
      // Same conversation, new message — scroll to bottom
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevConvIdRef.current = activeConversationId;
  }, [messages, activeConversationId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ── Audio recording for Whisper transcription ──────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.requestData();
        recorder.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      console.log("[Mic] Using MIME type:", mimeType);
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        console.log("[Mic] Chunk received, size:", e.data.size);
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        setIsRecording(false);

        console.log(
          "[Mic] Recording stopped, chunks:",
          audioChunksRef.current.length,
        );
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log("[Mic] Blob size:", blob.size, "bytes");
        if (blob.size === 0) {
          console.warn("[Mic] Empty recording, skipping transcription");
          return;
        }

        setIsTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "recording.webm");
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (res.ok && data.text) {
            setInput((prev) => (prev ? prev + " " + data.text : data.text));
          } else {
            console.error("[Transcribe]", data.error || "Unknown error");
          }
        } catch (err) {
          console.error("[Transcribe] Failed:", err);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      console.log("[Mic] Recording started");
    } catch (err) {
      console.error("[Mic] Access denied:", err);
    }
  }, [isRecording]);

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

  const handleSuggestion = (prompt: string, templateId?: string) => {
    if (isLoading) return;
    setInput("");
    sendAnalysis(prompt, templateId);
  };

  // ── User prompts ──────────────────────────────────────────
  const { prompts: userPrompts, createPrompt, deletePrompt } = useUserPrompts();
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

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
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        >
          {showEmptyState ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
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

              {/* Built-in suggestions */}
              <div className="w-full max-w-2xl">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  <Star className="w-3 h-3 inline mr-1 -mt-0.5" />
                  Примерни анализи
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* Analysis templates (2D) */}
              <div className="w-full max-w-2xl">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  <LayoutTemplate className="w-3 h-3 inline mr-1 -mt-0.5" />
                  Шаблони за анализ
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: "comprehensive",
                      label: "Пълен анализ",
                      desc: "EDA + аномалии + сменен отчет",
                      cls: "border-indigo-200 bg-indigo-50/50 hover:border-indigo-400",
                    },
                    {
                      id: "forecast",
                      label: "Прогноза",
                      desc: "EDA + прогнозиране на трендове",
                      cls: "border-violet-200 bg-violet-50/50 hover:border-violet-400",
                    },
                    {
                      id: "quality",
                      label: "Качество",
                      desc: "PSI анализ + SPC + оптимизация",
                      cls: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400",
                    },
                    {
                      id: "shift_comparison",
                      label: "Смени",
                      desc: "KPI по смени и сравнение",
                      cls: "border-amber-200 bg-amber-50/50 hover:border-amber-400",
                    },
                    {
                      id: "anomaly_investigation",
                      label: "Аномалии",
                      desc: "Детекция + Bayesian причини",
                      cls: "border-rose-200 bg-rose-50/50 hover:border-rose-400",
                    },
                    {
                      id: "optimization",
                      label: "Оптимизация",
                      desc: "Pareto + чувствителност",
                      cls: "border-cyan-200 bg-cyan-50/50 hover:border-cyan-400",
                    },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        const prompt = window.prompt(
                          `Шаблон: ${tpl.label}\n\nВъведете въпрос (напр. "Анализирай Мелница 8 за последните 7 дни"):`,
                          "",
                        );
                        if (prompt?.trim())
                          handleSuggestion(prompt.trim(), tpl.id);
                      }}
                      disabled={isLoading}
                      className={`text-left px-3 py-2.5 rounded-lg border ${tpl.cls} hover:shadow-md transition-all group disabled:opacity-50`}
                    >
                      <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900">
                        {tpl.label}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {tpl.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* User-saved prompts */}
              <div className="w-full max-w-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <Bookmark className="w-3 h-3 inline mr-1 -mt-0.5" />
                    Моите промптове
                  </h3>
                  <button
                    onClick={() => setPromptDialogOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    Добави
                  </button>
                </div>

                {userPrompts.length === 0 ? (
                  <button
                    onClick={() => setPromptDialogOpen(true)}
                    className="w-full px-4 py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all flex flex-col items-center gap-1"
                  >
                    <BookmarkPlus className="w-5 h-5" />
                    <span className="text-xs">
                      Запазете промпт за бърз достъп
                    </span>
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {userPrompts.map((p) => (
                      <UserPromptCard
                        key={p.id}
                        prompt={p}
                        onUse={() => handleSuggestion(p.description)}
                        onDelete={() => deletePrompt(p.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Add Prompt Dialog */}
              <AddPromptDialog
                open={promptDialogOpen}
                onClose={() => setPromptDialogOpen(false)}
                onSave={(title, description) =>
                  createPrompt({ title, description })
                }
              />
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
          <SettingsPanel />
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
              onClick={toggleRecording}
              disabled={isLoading || isTranscribing}
              className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                isRecording
                  ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                  : isTranscribing
                    ? "bg-amber-500 text-white cursor-wait"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={
                isRecording
                  ? "Спри записа"
                  : isTranscribing
                    ? "Транскрибиране..."
                    : "Запис с микрофон"
              }
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <Square className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
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
