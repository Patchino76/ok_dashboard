"use client";

import React, { useEffect, useRef } from "react";
import { Bot, Plus, User } from "lucide-react";
import { useChatStore } from "./stores/chat-store";
import { useRoleStore, ROLES, Role } from "./stores/role-store";
import MessageBubble from "./components/message-bubble";
import HistorySidebar, { ConvStatusIcon } from "./components/history-sidebar";
import EmptyState from "./components/empty-state";
import ChatInput from "./components/chat-input";

export default function AiChatPage() {
  const {
    activeConversationId,
    activeConversation,
    isLoading,
    hydrateFromServer,
  } = useChatStore();

  const role = useRoleStore((s) => s.role);
  const setRole = useRoleStore((s) => s.setRole);
  const hydrateRole = useRoleStore((s) => s.hydrate);
  const roleHydrated = useRoleStore((s) => s.hydrated);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevConvIdRef = useRef<string | null | undefined>(undefined);

  // Hydrate role from localStorage first, then pull role-scoped conversation
  // list from the server. The role-store subscriber inside chat-store handles
  // subsequent role changes automatically.
  useEffect(() => {
    hydrateRole();
  }, [hydrateRole]);

  useEffect(() => {
    if (!roleHydrated) return;
    void hydrateFromServer();
  }, [roleHydrated, hydrateFromServer]);

  const conv = activeConversation();
  const messages = conv?.messages ?? [];

  // Scroll to top when switching conversations, auto-scroll to bottom for new messages
  useEffect(() => {
    if (
      prevConvIdRef.current !== undefined &&
      prevConvIdRef.current !== activeConversationId
    ) {
      scrollContainerRef.current?.scrollTo({ top: 0 });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevConvIdRef.current = activeConversationId;
  }, [messages, activeConversationId]);

  // Show empty state when no conversation is selected
  const showEmptyState = !activeConversationId || messages.length === 0;

  return (
    <div className="flex h-full max-h-[calc(100vh-3rem)] bg-gray-50">
      {/* ── History sidebar ─────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* New analysis button */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <button
            onClick={() => useChatStore.getState().selectConversation("")}
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
          <div className="flex items-center gap-3">
            {conv && (
              <div className="flex items-center gap-2">
                <ConvStatusIcon status={conv.status} />
                <span className="text-xs text-gray-500 max-w-[200px] truncate">
                  {conv.title}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer transition-colors"
                title="Изберете роля — историята е споделена между потребителите от същата група"
              >
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Messages / empty state ───────────────────────── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        >
          {showEmptyState ? (
            <EmptyState />
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
        <ChatInput />
      </div>
    </div>
  );
}
