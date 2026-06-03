"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReactToPrint } from "react-to-print";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ClipboardCheck,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Printer,
  Trash2,
  User,
} from "lucide-react";
import {
  useChatStore,
  ChatMessage,
  ProgressMessage,
} from "../stores/chat-store";
import { makeMarkdownComponents, PrintableReport, withRole } from "./markdown";
import DataTiles, { stripStructured } from "./data-tiles";

// ── Status badge ───────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status?: ChatMessage["status"] }) {
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
            href={withRole(`${baseUrl}/${encodeURIComponent(name)}`)}
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
  critic: "✅",
  code_reviewer: "✅",
  reporter: "📄",
  manager: "👔",
  tools: "🔧",
};

function ProgressFeed({ messages }: { messages: ProgressMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Hide STRUCTURED data events — those are rendered as data tiles instead.
  const visible = React.useMemo(() => stripStructured(messages), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

  if (!visible || visible.length === 0) return null;

  return (
    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-1 text-xs">
      {visible.map((pm, i) => {
        const icon = STAGE_ICONS[pm.stage] || "•";
        const isLast = i === visible.length - 1;
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
export default function MessageBubble({
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

  const progress = message.progressMessages || [];
  const hasProgress = progress.length > 0;

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
            <div className="relative group pr-16">
              <CollapsibleUserMessage content={message.content} />
              <div className="absolute top-0 right-0 flex items-center gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(message.content)}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 transition-all"
                  title="Копирай"
                >
                  <Copy className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Изтрий този въпрос и свързания с него отговор?",
                      )
                    ) {
                      useChatStore.getState().deleteExchange(message.id);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-rose-500/80 transition-all"
                  title="Изтрий този въпрос и отговора към него"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : message.status === "running" && !message.content ? (
            <div>
              <TypingIndicator />
              {hasProgress && <ProgressFeed messages={progress} />}
              {hasProgress && <DataTiles messages={progress} />}
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
              {message.status === "running" && hasProgress && (
                <>
                  <ProgressFeed messages={progress} />
                  <DataTiles messages={progress} />
                </>
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
