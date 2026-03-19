# AI Chat System - Frontend Components

## Table of Contents

- [Introduction](#introduction)
- [Component Architecture](#component-architecture)
- [Main Page Component](#main-page-component)
- [Chat Store (State Management)](#chat-store-state-management)
- [UI Components](#ui-components)
- [Data Flow](#data-flow)
- [Key Patterns](#key-patterns)

## Introduction

The AI Chat frontend is built with Next.js, React, and TypeScript, using Zustand for state management. It provides a chat interface for interacting with the multi-agent data analysis system.

**Key Features:**

- Real-time polling for analysis status
- Markdown rendering with embedded charts
- Conversation history management
- Suggestion cards for common queries
- File download links for reports and charts

## Component Architecture

```
src/app/ai-chat/
├── page.tsx                    # Main page component
└── stores/
    └── chat-store.ts           # Zustand state management

src/app/api/agentic/            # Next.js API routes (proxies)
├── analyze/
│   └── route.ts               # POST /api/agentic/analyze
├── status/
│   └── [id]/
│       └── route.ts           # GET /api/agentic/status/{id}
└── reports/
    └── [filename]/
        └── route.ts           # GET /api/agentic/reports/{filename}
```

## Main Page Component

### File: `src/app/ai-chat/page.tsx`

The main page is a comprehensive chat interface with the following structure:

```typescript
"use client";

import React, { useRef, useEffect, useState, KeyboardEvent } from "react";
import { useChatStore, ChatMessage, Conversation } from "./stores/chat-store";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Bot, User, Trash2, ImageIcon, FileText, ... } from "lucide-react";
```

### Key Sections

#### 1. Suggested Prompts

```typescript
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
  // ... more suggestions
];
```

**Purpose**: Provide quick-start prompts for common analysis tasks.

#### 2. Status Badge Component

```typescript
function StatusBadge({ status }: { status?: ChatMessage["status"] }) {
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
  // ... render logic
}
```

**Purpose**: Visual indicator of analysis status with icons and colors.

#### 3. Collapsible Image Component

```typescript
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
        <a href={src} target="_blank" rel="noopener noreferrer" className="block">
          <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
        </a>
      )}
    </div>
  );
}
```

**Purpose**: Collapsible chart images to prevent clutter in chat messages.

#### 4. File Downloads Component

```typescript
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
```

**Purpose**: Download links for generated reports and charts.

#### 5. Custom Markdown Components

```typescript
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
```

**Purpose**: Custom markdown rendering with image path resolution and collapsible images.

#### 6. Message Bubble Component

```typescript
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
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-emerald-600" : "bg-slate-700"
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "flex flex-col items-end" : ""}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-emerald-600 text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
        }`}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : message.status === "running" && !message.content ? (
            <TypingIndicator />
          ) : (
            <div className="text-sm md-content">
              {message.status && <StatusBadge status={message.status} />}
              {displayContent && (
                <div className="mt-2">
                  <ReactMarkdown components={mdComponents}>
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
```

**Purpose**: Render individual chat messages with status, markdown, and file downloads.

#### 7. History Sidebar Component

```typescript
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

      {/* Tooltip */}
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
                    <p className={`text-xs font-medium truncate ${
                      conv.id === activeConversationId
                        ? "text-blue-700"
                        : "text-gray-700"
                    }`}>
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
```

**Purpose**: Display conversation history with status indicators and tooltips.

#### 8. Main Page Component

```typescript
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

  const showEmptyState = !activeConversationId || messages.length === 0;

  return (
    <div className="flex h-full max-h-[calc(100vh-3rem)] bg-gray-50">
      {/* History sidebar */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
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

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
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

        {/* Messages / empty state */}
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

        {/* Input area */}
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
```

**Purpose**: Main page layout with sidebar, messages, and input area.

## Chat Store (State Management)

### File: `src/app/ai-chat/stores/chat-store.ts`

The chat store uses Zustand for state management with localStorage persistence.

### Types

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  analysisId?: string;
  status?: "pending" | "running" | "completed" | "failed";
  reportFiles?: string[];
  chartFiles?: string[];
  reportMarkdown?: string;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  status: "idle" | "running" | "completed" | "failed";
  analysisId?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  pollingInterval: ReturnType<typeof setInterval> | null;

  // Derived helpers
  activeConversation: () => Conversation | undefined;

  // Conversation management
  createConversation: (title?: string) => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;

  // Message management
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => ChatMessage;
  updateMessage: (msgId: string, updates: Partial<ChatMessage>) => void;

  // Analysis flow
  sendAnalysis: (question: string) => Promise<void>;
  pollStatus: (analysisId: string, messageId: string, convId: string) => void;
  stopPolling: () => void;
}
```

### LocalStorage Helpers

```typescript
const STORAGE_KEY = "ai-chat-conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: Conversation[] = JSON.parse(raw);
    // Reset any stuck "running" conversations to "failed" on reload
    return parsed.map((c) =>
      c.status === "running" ? { ...c, status: "failed" as const } : c,
    );
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.warn("Failed to save conversations:", e);
  }
}
```

**Purpose**: Persist conversations to localStorage with recovery from stuck states.

### Store Implementation

```typescript
export const useChatStore = create<ChatState>((set, get) => ({
  conversations: loadConversations(),
  activeConversationId: loadConversations()[0]?.id ?? null,
  isLoading: false,
  pollingInterval: null,

  // Derived helper
  activeConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId);
  },

  // Conversation management
  createConversation: (title?: string) => {
    const id = crypto.randomUUID();
    const conv: Conversation = {
      id,
      title: title || "Нов анализ",
      createdAt: new Date().toISOString(),
      messages: [],
      status: "idle",
    };
    set((s) => {
      const updated = [conv, ...s.conversations];
      saveConversations(updated);
      return { conversations: updated, activeConversationId: id };
    });
    return id;
  },

  selectConversation: (id) => {
    set({ activeConversationId: id });
  },

  deleteConversation: (id) => {
    const { stopPolling, activeConversationId, conversations } = get();
    stopPolling();

    // Find the conversation to get its analysisId for backend cleanup
    const conv = conversations.find((c) => c.id === id);
    if (conv?.analysisId) {
      fetch(`/api/v1/agentic/analysis/${conv.analysisId}`, {
        method: "DELETE",
      }).catch((e) => console.warn("Failed to delete analysis files:", e));
    }

    set((s) => {
      const updated = s.conversations.filter((c) => c.id !== id);
      saveConversations(updated);
      const newActive =
        activeConversationId === id
          ? (updated[0]?.id ?? null)
          : activeConversationId;
      return {
        conversations: updated,
        activeConversationId: newActive,
        isLoading: false,
      };
    });
  },

  clearAllConversations: () => {
    const { stopPolling, conversations } = get();
    stopPolling();

    // Delete all analysis output folders on the backend
    for (const conv of conversations) {
      if (conv.analysisId) {
        fetch(`/api/v1/agentic/analysis/${conv.analysisId}`, {
          method: "DELETE",
        }).catch((e) => console.warn("Failed to delete analysis files:", e));
      }
    }

    saveConversations([]);
    set({
      conversations: [],
      activeConversationId: null,
      isLoading: false,
    });
  },

  // Message management
  addMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    set((s) => {
      const updated = s.conversations.map((c) =>
        c.id === s.activeConversationId
          ? { ...c, messages: [...c.messages, newMsg] }
          : c,
      );
      saveConversations(updated);
      return { conversations: updated };
    });
    return newMsg;
  },

  updateMessage: (msgId, updates) => {
    set((s) => {
      const updated = s.conversations.map((c) => {
        const hasMsg = c.messages.some((m) => m.id === msgId);
        if (!hasMsg) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === msgId ? { ...m, ...updates } : m,
          ),
        };
      });
      saveConversations(updated);
      return { conversations: updated };
    });
  },

  // Analysis flow
  sendAnalysis: async (question: string) => {
    const { createConversation, addMessage, updateMessage, pollStatus } = get();

    // Create a new conversation for this analysis
    const convId = createConversation(truncate(question));

    // Add user message
    addMessage({ role: "user", content: question });

    // Add placeholder assistant message
    const assistantMsg = addMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });

    // Mark conversation as running
    set((s) => {
      const updated = s.conversations.map((c) =>
        c.id === convId ? { ...c, status: "running" as const } : c,
      );
      saveConversations(updated);
      return { conversations: updated, isLoading: true };
    });

    try {
      const res = await fetch("/api/v1/agentic/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail || errData.error || `HTTP ${res.status}`,
        );
      }

      const data = await res.json();
      const analysisId = data.analysis_id;

      // Store analysisId on the conversation for URL building & cleanup
      set((s) => {
        const updated = s.conversations.map((c) =>
          c.id === convId ? { ...c, analysisId } : c,
        );
        saveConversations(updated);
        return { conversations: updated };
      });

      updateMessage(assistantMsg.id, {
        analysisId,
        status: "running",
        content: "Анализът е стартиран. Агентите работят...",
      });

      pollStatus(analysisId, assistantMsg.id, convId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(assistantMsg.id, {
        status: "failed",
        content: `Грешка при стартиране на анализа: ${errorMsg}`,
        error: errorMsg,
      });
      set((s) => {
        const updated = s.conversations.map((c) =>
          c.id === convId ? { ...c, status: "failed" as const } : c,
        );
        saveConversations(updated);
        return { conversations: updated, isLoading: false };
      });
    }
  },

  // Polling
  pollStatus: (analysisId: string, messageId: string, convId: string) => {
    const { stopPolling } = get();
    stopPolling();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/agentic/status/${analysisId}`);
        if (!res.ok) return;

        const data = await res.json();
        const { updateMessage, stopPolling: stop } = get();

        if (data.status === "completed") {
          const reportFiles: string[] = data.report_files || [];
          const chartFiles: string[] = data.chart_files || [];

          let reportMarkdown: string | undefined;
          if (reportFiles.length > 0) {
            try {
              const mdRes = await fetch(
                `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}/${encodeURIComponent(reportFiles[0])}`,
              );
              if (mdRes.ok) {
                reportMarkdown = await mdRes.text();
              }
            } catch (e) {
              console.warn("Failed to fetch report MD:", e);
            }
          }

          updateMessage(messageId, {
            status: "completed",
            content: data.final_answer || "Анализът е завършен.",
            reportFiles,
            chartFiles,
            reportMarkdown,
          });

          set((s) => {
            const updated = s.conversations.map((c) =>
              c.id === convId ? { ...c, status: "completed" as const } : c,
            );
            saveConversations(updated);
            return { conversations: updated, isLoading: false };
          });
          stop();
        } else if (data.status === "failed") {
          updateMessage(messageId, {
            status: "failed",
            content: `Анализът е неуспешен: ${data.error || "Неизвестна грешка"}`,
            error: data.error,
          });

          set((s) => {
            const updated = s.conversations.map((c) =>
              c.id === convId ? { ...c, status: "failed" as const } : c,
            );
            saveConversations(updated);
            return { conversations: updated, isLoading: false };
          });
          stop();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, POLL_INTERVAL_MS);

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },
}));
```

**Purpose**: Complete state management for conversations, messages, and analysis lifecycle.

## UI Components

### Typing Indicator

```typescript
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}
```

**Purpose**: Animated dots to show agent is working.

### Conversation Status Icon

```typescript
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
```

**Purpose**: Visual icon for conversation status.

## Data Flow

### Send Analysis Flow

```
User types question
  ↓
handleSend() calls sendAnalysis(question)
  ↓
createConversation() → New conversation with UUID
  ↓
addMessage() → Add user message
  ↓
addMessage() → Add assistant placeholder (status: "pending")
  ↓
set conversation status to "running"
  ↓
POST /api/v1/agentic/analyze with { question }
  ↓
Backend returns { analysis_id }
  ↓
updateMessage() → Set assistant message status to "running"
  ↓
pollStatus() starts 4-second polling interval
  ↓
Each poll: GET /api/v1/agentic/status/{analysis_id}
  ↓
When status = "completed":
  - Fetch report markdown
  - updateMessage() with reportFiles, chartFiles, reportMarkdown
  - set conversation status to "completed"
  - stopPolling()
  ↓
UI renders completed message with markdown and file downloads
```

### Delete Conversation Flow

```
User clicks delete button
  ↓
deleteConversation(id) called
  ↓
stopPolling() → Clear polling interval
  ↓
Fetch analysisId from conversation
  ↓
DELETE /api/v1/agentic/analysis/{analysisId} → Backend cleanup
  ↓
Remove conversation from state
  ↓
saveConversations() → Update localStorage
  ↓
Update activeConversationId if needed
```

## Key Patterns

### 1. Auto-Scroll to Bottom

```typescript
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
```

**Purpose**: Automatically scroll to latest message.

### 2. Auto-Resize Textarea

```typescript
useEffect(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 160) + "px";
  }
}, [input]);
```

**Purpose**: Expand textarea as user types, max 160px height.

### 3. Markdown Image Resolution

```typescript
const baseUrl = analysisId
  ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
  : `/api/v1/agentic/reports`;

const resolvedSrc =
  rawSrc && !rawSrc.startsWith("http") && !rawSrc.startsWith("/")
    ? `${baseUrl}/${encodeURIComponent(rawSrc)}`
    : rawSrc;
```

**Purpose**: Convert relative image paths to full API URLs.

### 4. Per-Analysis File URLs

```typescript
const baseUrl = analysisId
  ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
  : `/api/v1/agentic/reports`;

href={`${baseUrl}/${encodeURIComponent(name)}`}
```

**Purpose**: Build correct URLs for per-analysis output folders.

### 5. Polling with Cleanup

```typescript
const interval = setInterval(async () => {
  // ... polling logic
  if (completed) {
    stop();
  }
}, POLL_INTERVAL_MS);

set({ pollingInterval: interval });

// Cleanup
stopPolling: () => {
  const { pollingInterval } = get();
  if (pollingInterval) {
    clearInterval(pollingInterval);
    set({ pollingInterval: null });
  }
};
```

**Purpose**: Poll analysis status with proper cleanup.

### 6. localStorage Persistence

```typescript
function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.warn("Failed to save conversations:", e);
  }
}
```

**Purpose**: Persist conversations across page reloads.

### 7. Stuck State Recovery

```typescript
return parsed.map((c) =>
  c.status === "running" ? { ...c, status: "failed" as const } : c,
);
```

**Purpose**: Reset stuck "running" conversations to "failed" on reload.

### 8. Tooltip Positioning

```typescript
const showTooltip = (e: React.MouseEvent, text: string) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  setTooltip({ text, top: rect.top, left: rect.right + 8 });
};
```

**Purpose**: Position tooltip next to hovered element.

## Next Steps

For more details on specific aspects:

- [Backend Integration](./ai-chat-backend.md)
- [MCP Server & LangGraph](./ai-chat-mcp-langgraph.md)
- [API Routing](./ai-chat-api-routing.md)
