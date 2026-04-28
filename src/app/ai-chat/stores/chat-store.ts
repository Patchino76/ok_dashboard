import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProgressMessage {
  timestamp: string;
  stage: string;
  message: string;
}

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
  progressMessages?: ProgressMessage[];
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

  // Message management (operates on active conversation)
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => ChatMessage;
  updateMessage: (msgId: string, updates: Partial<ChatMessage>) => void;

  // Analysis flow
  sendAnalysis: (question: string, templateId?: string) => Promise<void>;
  sendFollowUp: (question: string) => Promise<void>;
  pollStatus: (
    analysisId: string,
    messageId: string,
    convId: string,
    reportAnalysisId?: string,
    baselineReportFiles?: string[],
  ) => void;
  stopPolling: () => void;

  // Cancel the currently running analysis/follow-up (if any) and stop polling.
  // Keeps any partial artefacts already written to output/.
  cancelCurrent: () => Promise<void>;
  // Remove a specific user message (by id) and its paired assistant reply
  // (the next assistant message after it, if any). For follow-up replies,
  // also deletes any NEW files that the reply produced. Safe to call on any
  // user message in the active conversation.
  deleteExchange: (userMessageId: string) => Promise<void>;

  // Hydration
  hydrateFromStorage: () => void;
}

// ── localStorage helpers ─────────────────────────────────────────────────────

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

// ── Utility ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 50) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

const POLL_INTERVAL_MS = 4000;

// ── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  pollingInterval: null,

  // ── Derived ──────────────────────────────────────────────────────────────

  activeConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId);
  },

  // ── Conversation management ──────────────────────────────────────────────

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

  // ── Message management ───────────────────────────────────────────────────

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

  // ── Analysis flow ────────────────────────────────────────────────────────

  sendAnalysis: async (question: string, templateId?: string) => {
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
      // Dynamically import settings to avoid circular deps
      const { useSettingsStore } = await import("./settings-store");
      const settings = useSettingsStore.getState().getSettings();

      const res = await fetch("/api/v1/agentic/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          settings,
          ...(templateId ? { template_id: templateId } : {}),
        }),
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

  // ── Follow-up ────────────────────────────────────────────────────────────

  sendFollowUp: async (question: string) => {
    const { addMessage, updateMessage, pollStatus, activeConversationId } =
      get();
    const conv = get().activeConversation();

    if (!conv || !conv.analysisId) {
      console.error("No active conversation or analysisId for follow-up");
      return;
    }

    const convId = conv.id;
    const parentAnalysisId = conv.analysisId;

    // Capture the set of report files that already exist in the parent folder
    // so pollStatus can tell whether this follow-up actually produced a NEW
    // report. Without this, ANSWER-style follow-ups (which only return text)
    // would re-display the parent's stale report.
    const baselineReportFiles: string[] = [];
    for (const m of conv.messages) {
      if (m.role === "assistant" && m.reportFiles) {
        for (const f of m.reportFiles) {
          if (!baselineReportFiles.includes(f)) baselineReportFiles.push(f);
        }
      }
    }

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
      const res = await fetch(
        `/api/v1/agentic/followup/${encodeURIComponent(parentAnalysisId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail || errData.error || `HTTP ${res.status}`,
        );
      }

      const data = await res.json();
      const followupId = data.analysis_id;

      updateMessage(assistantMsg.id, {
        analysisId: followupId,
        status: "running",
        content: "Обработка на допълнителен въпрос...",
      });

      pollStatus(
        followupId,
        assistantMsg.id,
        convId,
        parentAnalysisId,
        baselineReportFiles,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(assistantMsg.id, {
        status: "failed",
        content: `Грешка при допълнителния въпрос: ${errorMsg}`,
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

  // ── Polling ──────────────────────────────────────────────────────────────

  pollStatus: (
    analysisId: string,
    messageId: string,
    convId: string,
    reportAnalysisId?: string,
    baselineReportFiles?: string[],
  ) => {
    const { stopPolling } = get();
    stopPolling();
    // For follow-ups, report files live under the parent analysis ID
    const fileAnalysisId = reportAnalysisId || analysisId;
    // For follow-ups, baselineReportFiles holds the parent's pre-existing
    // reports; we only attach reportMarkdown if a NEW report appeared.
    const baseline = new Set(baselineReportFiles || []);

    let consecutiveFailures = 0;
    let everSucceeded = false;
    const MAX_FAILURES_COLD = 15; // never got a 200 — analysis may not exist
    const MAX_POLL_DURATION_MS = 600000; // 10-minute safety timeout
    const startTime = Date.now();

    const interval = setInterval(async () => {
      // Safety timeout — stop after 10 minutes regardless
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        console.warn(`Polling timeout for ${analysisId}`);
        const { stopPolling: stop } = get();
        stop();
        return;
      }

      try {
        const res = await fetch(`/api/v1/agentic/status/${analysisId}`);
        if (!res.ok) {
          consecutiveFailures++;
          // If we previously got a 200, the analysis exists — just skip this 404
          if (everSucceeded) return;
          // Never got a 200 — give up after many attempts
          if (consecutiveFailures >= MAX_FAILURES_COLD) {
            console.warn(
              `Polling stopped: ${consecutiveFailures} consecutive failures for ${analysisId}`,
            );
            const { stopPolling: stop, updateMessage: update } = get();
            update(messageId, {
              status: "failed",
              content:
                "Анализът не е намерен. Сървърът може да е бил рестартиран.",
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
          return;
        }

        consecutiveFailures = 0;
        everSucceeded = true;
        const data = await res.json();
        const { updateMessage, stopPolling: stop } = get();

        // Always push new progress messages while running
        const progress: ProgressMessage[] = data.progress || [];
        if (progress.length > 0) {
          updateMessage(messageId, { progressMessages: progress });
        }

        if (data.status === "completed") {
          const reportFiles: string[] = data.report_files || [];
          const chartFiles: string[] = data.chart_files || [];

          // For follow-ups: only attach reportMarkdown if a NEW .md appeared
          // (not already in the parent's baseline). For primary analyses the
          // baseline is empty so every report is "new".
          const newReportFiles = reportFiles.filter((f) => !baseline.has(f));
          const mdToShow =
            newReportFiles[0] ||
            (baseline.size === 0 ? reportFiles[0] : undefined);

          let reportMarkdown: string | undefined;
          if (mdToShow) {
            try {
              const mdRes = await fetch(
                `/api/v1/agentic/reports/${encodeURIComponent(fileAnalysisId)}/${encodeURIComponent(mdToShow)}`,
              );
              if (mdRes.ok) {
                reportMarkdown = await mdRes.text();
              }
            } catch (e) {
              console.warn("Failed to fetch report MD:", e);
            }
          }

          // Only expose NEW files to the per-message download list so the
          // follow-up bubble doesn't re-advertise the parent's artefacts.
          const newChartFiles =
            baseline.size === 0
              ? chartFiles
              : // no chart baseline is captured separately; heuristic: if no
                // new report, assume no new charts either (ANSWER mode).
                newReportFiles.length > 0
                ? chartFiles
                : [];

          updateMessage(messageId, {
            status: "completed",
            content: data.final_answer || "Анализът е завършен.",
            reportFiles:
              newReportFiles.length > 0
                ? newReportFiles
                : baseline.size === 0
                  ? reportFiles
                  : [],
            chartFiles: newChartFiles,
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
        if (!everSucceeded) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES_COLD) {
            const { stopPolling: stop } = get();
            stop();
          }
        }
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

  // ── Cancel current run ───────────────────────────────────────────────────

  cancelCurrent: async () => {
    const { stopPolling, activeConversation, updateMessage } = get();
    const conv = activeConversation();
    if (!conv) return;

    // Find the in-flight assistant message (the last one still running/pending)
    const running = [...conv.messages]
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" &&
          (m.status === "running" || m.status === "pending"),
      );
    const targetId = running?.analysisId;

    stopPolling();

    if (targetId) {
      try {
        await fetch(`/api/v1/agentic/cancel/${encodeURIComponent(targetId)}`, {
          method: "POST",
        });
      } catch (e) {
        console.warn("Cancel request failed:", e);
      }
    }

    if (running) {
      updateMessage(running.id, {
        status: "failed",
        content: "⛔ Анализът беше прекъснат от потребителя.",
        error: "cancelled",
      });
    }

    set((s) => {
      const updated = s.conversations.map((c) =>
        c.id === conv.id ? { ...c, status: "idle" as const } : c,
      );
      saveConversations(updated);
      return { conversations: updated, isLoading: false };
    });
  },

  // ── Delete a specific exchange ───────────────────────────────────────────

  deleteExchange: async (userMessageId: string) => {
    const conv = get().activeConversation();
    if (!conv) return;

    const msgs = conv.messages;
    const userIdx = msgs.findIndex(
      (m) => m.id === userMessageId && m.role === "user",
    );
    if (userIdx === -1) return;

    // Find the immediately following assistant message (if any) — it is the
    // paired reply for this user prompt.
    let assistantIdx = -1;
    for (let i = userIdx + 1; i < msgs.length; i++) {
      if (msgs[i].role === "assistant") {
        assistantIdx = i;
        break;
      }
      if (msgs[i].role === "user") break; // hit the next prompt without a reply
    }
    const assistantMsg = assistantIdx !== -1 ? msgs[assistantIdx] : undefined;

    // Determine whether this is a follow-up bubble. The primary analysis
    // bubble owns the shared parent reports, so we never delete its files.
    const fileAnalysisId = conv.analysisId;
    const isFollowUpReply =
      !!assistantMsg?.analysisId &&
      !!fileAnalysisId &&
      assistantMsg.analysisId !== fileAnalysisId;

    if (isFollowUpReply && fileAnalysisId && assistantMsg) {
      const filesToDelete: string[] = [
        ...(assistantMsg.reportFiles || []),
        ...(assistantMsg.chartFiles || []),
      ];
      if (filesToDelete.length > 0) {
        await Promise.all(
          filesToDelete.map((f) =>
            fetch(
              `/api/v1/agentic/reports/${encodeURIComponent(fileAnalysisId)}/${encodeURIComponent(f)}`,
              { method: "DELETE" },
            ).catch((e) => console.warn(`Failed to delete ${f}:`, e)),
          ),
        );
      }
    }

    // If the assistant reply is still in flight, cancel it before discarding.
    if (
      assistantMsg &&
      (assistantMsg.status === "running" || assistantMsg.status === "pending")
    ) {
      const targetId = assistantMsg.analysisId;
      get().stopPolling();
      if (targetId) {
        try {
          await fetch(
            `/api/v1/agentic/cancel/${encodeURIComponent(targetId)}`,
            { method: "POST" },
          );
        } catch (e) {
          console.warn("Cancel before delete failed:", e);
        }
      }
    }

    const drop = new Set<number>([userIdx]);
    if (assistantIdx !== -1) drop.add(assistantIdx);
    const trimmed = msgs.filter((_, i) => !drop.has(i));
    const wasInFlight =
      assistantMsg?.status === "running" || assistantMsg?.status === "pending";

    set((s) => {
      const updated = s.conversations.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              messages: trimmed,
              // If no completed assistant reply remains, reset to idle so the
              // next prompt is treated as a fresh analysis.
              status: trimmed.some(
                (m) => m.role === "assistant" && m.status === "completed",
              )
                ? c.status
                : ("idle" as const),
            }
          : c,
      );
      saveConversations(updated);
      return {
        conversations: updated,
        // If we cancelled an in-flight reply, also clear the global loading flag.
        isLoading: wasInFlight ? false : s.isLoading,
      };
    });
  },

  hydrateFromStorage: () => {
    const loaded = loadConversations();
    set({
      conversations: loaded,
      activeConversationId: loaded[0]?.id ?? null,
    });
  },
}));
