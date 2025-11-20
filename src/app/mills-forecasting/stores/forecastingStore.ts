import { create } from "zustand";
import { TARGET_RANGES, ORE_RATE_RANGES } from "../constants";
import type { ProductionDataUpdate } from "../types/production";

interface ForecastingSettings {
  // ==================== USER-ADJUSTABLE SETTINGS ====================

  /** Target production for current shift (tons) */
  shiftTarget: number;

  /** Target production for current day (tons) */
  dayTarget: number;

  /** User-adjusted ore rate for forecasting (t/h) */
  adjustedOreRate: number;

  /** Uncertainty level: 1 = Low, 2 = Medium, 3 = High */
  uncertaintyLevel: 1 | 2 | 3;

  /** Selected mills for adjustment (empty = all mills) */
  selectedMills: string[];

  // ==================== REAL-TIME DATA (FROM API) ====================

  /** Current ore rate from real-time data (t/h) */
  currentOreRate: number;

  /** Actual production so far in current shift (tons) */
  actualShiftProduction: number;

  /** Actual production so far today (tons) */
  actualDayProduction: number;

  /** Number of currently active mills */
  activeMillsCount: number;

  /** Timestamp of last data update */
  lastDataUpdate: Date | null;

  // ==================== UI STATE ====================

  /** Whether to use real-time data or manual input */
  isRealTimeMode: boolean;

  /** Whether data is currently being fetched */
  isLoading: boolean;

  // ==================== ACTIONS ====================

  /** Set shift target */
  setShiftTarget: (target: number) => void;

  /** Set day target */
  setDayTarget: (target: number) => void;

  /** Set adjusted ore rate for forecasting */
  setAdjustedOreRate: (rate: number) => void;

  /** Set uncertainty level */
  setUncertaintyLevel: (level: 1 | 2 | 3) => void;

  /** Set selected mills */
  setSelectedMills: (mills: string[]) => void;

  /** Update real-time data from API */
  updateRealTimeData: (data: ProductionDataUpdate) => void;

  /** Toggle between real-time and manual mode */
  toggleRealTimeMode: () => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Reset all settings to defaults */
  resetToDefaults: () => void;

  /** Sync adjusted ore rate with current ore rate (for real-time mode) */
  syncAdjustedRateWithCurrent: () => void;
}

/**
 * Zustand store for mills forecasting settings and real-time data
 *
 * This store manages:
 * - User-adjustable forecast settings (targets, rates, uncertainty)
 * - Real-time production data from API
 * - UI state (mode, loading)
 */
export const useForecastingStore = create<ForecastingSettings>((set, get) => ({
  // ==================== INITIAL STATE ====================

  // User settings - initialized from constants
  shiftTarget: TARGET_RANGES.shift.default,
  dayTarget: TARGET_RANGES.day.default,
  adjustedOreRate: ORE_RATE_RANGES.default,
  uncertaintyLevel: 2,
  selectedMills: [],

  // Real-time data - initialized with defaults
  currentOreRate: ORE_RATE_RANGES.default,
  actualShiftProduction: 0,
  actualDayProduction: 0,
  activeMillsCount: 0,
  lastDataUpdate: null,

  // UI state
  isRealTimeMode: true,
  isLoading: false,

  // ==================== ACTIONS ====================

  setShiftTarget: (target) => {
    console.log("📊 Setting shift target:", target);
    set({ shiftTarget: target });
  },

  setDayTarget: (target) => {
    console.log("📊 Setting day target:", target);
    set({ dayTarget: target });
  },

  setAdjustedOreRate: (rate) => {
    console.log("⚙️ Setting adjusted ore rate:", rate);
    set({ adjustedOreRate: rate });
  },

  setUncertaintyLevel: (level) => {
    console.log("🎲 Setting uncertainty level:", level);
    set({ uncertaintyLevel: level });
  },

  setSelectedMills: (mills) => {
    console.log("🏭 Setting selected mills:", mills);
    set({ selectedMills: mills });
  },

  updateRealTimeData: (data) => {
    console.log("🔄 Updating real-time data:", {
      currentOreRate: data.currentOreRate,
      actualShiftProduction: data.actualShiftProduction,
      actualDayProduction: data.actualDayProduction,
      activeMillsCount: data.activeMillsCount,
    });

    set({
      currentOreRate: data.currentOreRate,
      actualShiftProduction: data.actualShiftProduction,
      actualDayProduction: data.actualDayProduction,
      activeMillsCount: data.activeMillsCount,
      lastDataUpdate: new Date(),
    });

    // In real-time mode, sync adjusted rate with current rate
    if (get().isRealTimeMode) {
      set({ adjustedOreRate: data.currentOreRate });
    }
  },

  toggleRealTimeMode: () => {
    const newMode = !get().isRealTimeMode;
    console.log("🔄 Toggling real-time mode:", newMode ? "ON" : "OFF");

    set({ isRealTimeMode: newMode });

    // When switching to real-time mode, sync adjusted rate with current
    if (newMode) {
      get().syncAdjustedRateWithCurrent();
    }
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  resetToDefaults: () => {
    console.log("🔄 Resetting to defaults");
    set({
      shiftTarget: TARGET_RANGES.shift.default,
      dayTarget: TARGET_RANGES.day.default,
      adjustedOreRate: ORE_RATE_RANGES.default,
      uncertaintyLevel: 2,
      selectedMills: [],
    });
  },

  syncAdjustedRateWithCurrent: () => {
    const { currentOreRate } = get();
    console.log("🔄 Syncing adjusted rate with current:", currentOreRate);
    set({ adjustedOreRate: currentOreRate });
  },
}));
