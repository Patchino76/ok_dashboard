import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  analysisId?: string;
  status?: "pending" | "running" | "completed" | "failed";
  reportFiles?: string[];
  chartFiles?: string[];
  error?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  activeAnalysisId: string | null;
  pollingInterval: ReturnType<typeof setInterval> | null;

  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  setActiveAnalysisId: (id: string | null) => void;
  setPollingInterval: (interval: ReturnType<typeof setInterval> | null) => void;
  clearChat: () => void;

  sendAnalysis: (question: string) => Promise<void>;
  pollStatus: (analysisId: string, messageId: string) => void;
  stopPolling: () => void;
}

const POLL_INTERVAL_MS = 4000;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  activeAnalysisId: null,
  pollingInterval: null,

  addMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, newMsg] }));
    return newMsg;
  },

  updateMessage: (id, updates) => {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setActiveAnalysisId: (id) => set({ activeAnalysisId: id }),
  setPollingInterval: (interval) => set({ pollingInterval: interval }),

  clearChat: () => {
    get().stopPolling();
    set({ messages: [], isLoading: false, activeAnalysisId: null });
  },

  sendAnalysis: async (question: string) => {
    const { addMessage, setLoading, setActiveAnalysisId, pollStatus, updateMessage } = get();

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg] }));

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    set((s) => ({ messages: [...s.messages, assistantMsg] }));

    setLoading(true);

    try {
      const res = await fetch("/api/agentic/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const analysisId = data.analysis_id;

      setActiveAnalysisId(analysisId);
      updateMessage(assistantMsg.id, {
        analysisId,
        status: "running",
        content: "Анализът е стартиран. Агентите работят...",
      });

      // Start polling
      pollStatus(analysisId, assistantMsg.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(assistantMsg.id, {
        status: "failed",
        content: `Грешка при стартиране на анализа: ${errorMsg}`,
        error: errorMsg,
      });
      setLoading(false);
    }
  },

  pollStatus: (analysisId: string, messageId: string) => {
    const { updateMessage, setLoading, setActiveAnalysisId, stopPolling } = get();

    // Clear any existing interval
    stopPolling();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agentic/status/${analysisId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "completed") {
          updateMessage(messageId, {
            status: "completed",
            content: data.final_answer || "Анализът е завършен.",
            reportFiles: data.report_files || [],
            chartFiles: data.chart_files || [],
          });
          setLoading(false);
          setActiveAnalysisId(null);
          stopPolling();
        } else if (data.status === "failed") {
          updateMessage(messageId, {
            status: "failed",
            content: `Анализът е неуспешен: ${data.error || "Неизвестна грешка"}`,
            error: data.error,
          });
          setLoading(false);
          setActiveAnalysisId(null);
          stopPolling();
        }
        // If still "running", keep polling
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
