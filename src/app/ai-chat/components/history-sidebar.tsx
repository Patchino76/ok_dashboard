"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
import { useChatStore, Conversation } from "../stores/chat-store";

// ── Conversation status icon ───────────────────────────────────────────────
export function ConvStatusIcon({ status }: { status: Conversation["status"] }) {
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
export default function HistorySidebar() {
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
                  onClick={() => {
                    selectConversation(conv.id);
                    void useChatStore
                      .getState()
                      .loadConversationMessages(conv.id);
                  }}
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
