import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisSettings {
  maxToolOutputChars: number;
  maxAiMessageChars: number;
  maxMessagesWindow: number;
  maxSpecialistIterations: number;
}

interface SettingsState extends AnalysisSettings {
  updateSetting: <K extends keyof AnalysisSettings>(key: K, value: AnalysisSettings[K]) => void;
  getSettings: () => AnalysisSettings;
  resetDefaults: () => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: AnalysisSettings = {
  maxToolOutputChars: 4000,
  maxAiMessageChars: 4000,
  maxMessagesWindow: 20,
  maxSpecialistIterations: 5,
};

// ── Options for UI dropdowns ─────────────────────────────────────────────────

export const SETTING_OPTIONS = {
  maxToolOutputChars: [2000, 4000, 6000, 8000],
  maxAiMessageChars: [2000, 4000, 6000, 8000],
  maxMessagesWindow: [10, 14, 20, 30],
  maxSpecialistIterations: [3, 5, 7, 10],
} as const;

export const SETTING_LABELS: Record<keyof AnalysisSettings, string> = {
  maxToolOutputChars: "Макс. изход от инструменти (символи)",
  maxAiMessageChars: "Макс. AI съобщение (символи)",
  maxMessagesWindow: "Прозорец на съобщенията",
  maxSpecialistIterations: "Макс. итерации на специалист",
};

export const SETTING_DESCRIPTIONS: Record<keyof AnalysisSettings, string> = {
  maxToolOutputChars: "Колко символа от резултата на всеки инструмент се подават към агентите. По-висока стойност = повече контекст, но по-бавно.",
  maxAiMessageChars: "Максимален размер на всяко AI съобщение в историята. Влияе на паметта между агентите.",
  maxMessagesWindow: "Брой последни съобщения, които агентите виждат. Повече = по-добра памет, но по-бавно.",
  maxSpecialistIterations: "Колко пъти всеки специалист може да извика инструменти преди да бъде спрян.",
};

// ── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = "ai-chat-settings";

function loadSettings(): Partial<AnalysisSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(settings: AnalysisSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save settings:", e);
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>((set, get) => {
  const saved = loadSettings();
  const initial = { ...DEFAULTS, ...saved };

  return {
    ...initial,

    updateSetting: (key, value) => {
      set({ [key]: value });
      const state = get();
      saveSettings({
        maxToolOutputChars: state.maxToolOutputChars,
        maxAiMessageChars: state.maxAiMessageChars,
        maxMessagesWindow: state.maxMessagesWindow,
        maxSpecialistIterations: state.maxSpecialistIterations,
      });
    },

    getSettings: () => {
      const s = get();
      return {
        maxToolOutputChars: s.maxToolOutputChars,
        maxAiMessageChars: s.maxAiMessageChars,
        maxMessagesWindow: s.maxMessagesWindow,
        maxSpecialistIterations: s.maxSpecialistIterations,
      };
    },

    resetDefaults: () => {
      set(DEFAULTS);
      saveSettings(DEFAULTS);
    },
  };
});
