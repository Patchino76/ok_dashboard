import { create } from "zustand";
import {
  TARGET_RANGES,
  ORE_RATE_RANGES,
  UNCERTAINTY_RANGES,
} from "../constants";
import type { ProductionDataUpdate } from "../types/production";

interface ForecastingSettings {
  // ==================== USER-ADJUSTABLE SETTINGS ====================

  /** Target production for shift 1 (06:00-14:00) in tons */
  shift1Target: number;

  /** Target production for shift 2 (14:00-22:00) in tons */
  shift2Target: number;

  /** Target production for shift 3 (22:00-06:00) in tons */
  shift3Target: number;

  /** Target production for current day (tons) */
  dayTarget: number;

  /** User-adjusted ore rate for forecasting (t/h) */
  adjustedOreRate: number;

  /** Uncertainty percentage: 0-30% (0 = best, 30 = worst) */
  uncertaintyPercent: number;

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

  /** Set day target and recalculate shift targets proportionally */
  setDayTarget: (target: number) => void;

  /** Adjust a specific shift target and redistribute to maintain daily total */
  adjustShiftTarget: (shiftIndex: 1 | 2 | 3, newValue: number) => void;

  /** Calculate initial shift targets based on daily target and current conditions */
  calculateInitialShiftTargets: (dailyTarget?: number) => void;

  /** Set adjusted ore rate for forecasting */
  setAdjustedOreRate: (rate: number) => void;

  /** Set uncertainty percentage */
  setUncertaintyPercent: (percent: number) => void;

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
  shift1Target: TARGET_RANGES.shift.default,
  shift2Target: TARGET_RANGES.shift.default,
  shift3Target: TARGET_RANGES.shift.default,
  dayTarget: TARGET_RANGES.day.default,
  adjustedOreRate: ORE_RATE_RANGES.default,
  uncertaintyPercent: UNCERTAINTY_RANGES.default,
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

  setDayTarget: (target) => {
    console.log("📊 Setting day target:", target);
    set({ dayTarget: target });
    // Recalculate shift targets proportionally
    get().calculateInitialShiftTargets(target);
  },

  adjustShiftTarget: (shiftIndex, newValue) => {
    const state = get();
    const { shift1Target, shift2Target, shift3Target, dayTarget } = state;

    console.log(`🎯 Adjusting shift ${shiftIndex} target to:`, newValue);

    // Calculate the delta
    const currentValues = [shift1Target, shift2Target, shift3Target];
    const oldValue = currentValues[shiftIndex - 1];
    const delta = newValue - oldValue;

    // Get the other two shifts
    const otherIndices = [0, 1, 2].filter((i) => i !== shiftIndex - 1);
    const otherTotal = otherIndices.reduce(
      (sum, i) => sum + currentValues[i],
      0
    );

    // Redistribute delta proportionally to other shifts
    const newValues = [...currentValues];
    newValues[shiftIndex - 1] = newValue;

    if (otherTotal > 0) {
      otherIndices.forEach((i) => {
        const proportion = currentValues[i] / otherTotal;
        newValues[i] = currentValues[i] - delta * proportion;
        // Ensure non-negative values
        newValues[i] = Math.max(100, newValues[i]);
      });
    } else {
      // If other shifts are 0, distribute equally
      const remaining = dayTarget - newValue;
      otherIndices.forEach((i) => {
        newValues[i] = remaining / 2;
      });
    }

    // Normalize to ensure exact sum equals daily target
    const currentSum = newValues.reduce((sum, val) => sum + val, 0);
    const adjustmentFactor = dayTarget / currentSum;
    newValues[0] = newValues[0] * adjustmentFactor;
    newValues[1] = newValues[1] * adjustmentFactor;
    newValues[2] = newValues[2] * adjustmentFactor;

    console.log("🔄 Redistributed shift targets:", {
      S1: Math.round(newValues[0]),
      S2: Math.round(newValues[1]),
      S3: Math.round(newValues[2]),
      total: Math.round(newValues[0] + newValues[1] + newValues[2]),
      dailyTarget: dayTarget,
    });

    set({
      shift1Target: newValues[0],
      shift2Target: newValues[1],
      shift3Target: newValues[2],
    });
  },

  calculateInitialShiftTargets: (dailyTarget) => {
    const target = dailyTarget || get().dayTarget;
    const { currentOreRate, activeMillsCount } = get();

    console.log(
      "🧮 Calculating initial shift targets for daily target:",
      target
    );

    // Simple proportional distribution based on typical shift patterns
    // S1 (06-14): Usually highest production (35%)
    // S2 (14-22): Medium production (33%)
    // S3 (22-06): Lower production due to maintenance (32%)

    // If we have real-time data, adjust based on current ore rate
    let s1Weight = 0.35;
    let s2Weight = 0.33;
    let s3Weight = 0.32;

    // Adjust weights based on current conditions if available
    if (currentOreRate > 0 && activeMillsCount > 0) {
      // Higher ore rate suggests better conditions, favor current/next shift
      const currentHour = new Date().getHours();
      if (currentHour >= 6 && currentHour < 14) {
        // Currently in S1
        s1Weight = 0.36;
        s2Weight = 0.33;
        s3Weight = 0.31;
      } else if (currentHour >= 14 && currentHour < 22) {
        // Currently in S2
        s1Weight = 0.34;
        s2Weight = 0.35;
        s3Weight = 0.31;
      } else {
        // Currently in S3
        s1Weight = 0.34;
        s2Weight = 0.33;
        s3Weight = 0.33;
      }
    }

    const shift1 = target * s1Weight;
    const shift2 = target * s2Weight;
    const shift3 = target * s3Weight;

    console.log("✅ Calculated shift targets:", {
      S1: Math.round(shift1),
      S2: Math.round(shift2),
      S3: Math.round(shift3),
      total: Math.round(shift1 + shift2 + shift3),
    });

    set({
      shift1Target: shift1,
      shift2Target: shift2,
      shift3Target: shift3,
    });
  },

  setAdjustedOreRate: (rate) => {
    console.log("⚙️ Setting adjusted ore rate:", rate);
    set({ adjustedOreRate: rate });
  },

  setUncertaintyPercent: (percent) => {
    console.log("🎲 Setting uncertainty percent:", percent);
    set({ uncertaintyPercent: percent });
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
    const defaultDayTarget = TARGET_RANGES.day.default;
    set({
      dayTarget: defaultDayTarget,
      adjustedOreRate: ORE_RATE_RANGES.default,
      uncertaintyPercent: UNCERTAINTY_RANGES.default,
      selectedMills: [],
    });
    // Recalculate shift targets
    get().calculateInitialShiftTargets(defaultDayTarget);
  },

  syncAdjustedRateWithCurrent: () => {
    const { currentOreRate } = get();
    console.log("🔄 Syncing adjusted rate with current:", currentOreRate);
    set({ adjustedOreRate: currentOreRate });
  },
}));
