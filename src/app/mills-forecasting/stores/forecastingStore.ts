import { create } from "zustand";
import {
  TARGET_RANGES,
  ORE_RATE_RANGES,
  UNCERTAINTY_RANGES,
} from "../constants";
import type { ProductionDataUpdate } from "../types/production";

/**
 * Calculated shift targets based on daily target and current time
 * Past shifts use actual production, current/future shifts distribute remaining evenly
 */
interface CalculatedShiftTargets {
  shift1: { target: number; isActual: boolean; hoursRemaining: number };
  shift2: { target: number; isActual: boolean; hoursRemaining: number };
  shift3: { target: number; isActual: boolean; hoursRemaining: number };
  requiredRate: number; // Required rate to meet daily target
}

interface ForecastingSettings {
  // ==================== USER-ADJUSTABLE SETTINGS ====================

  /** Target production for current day (tons) - THE MAIN CONTROL */
  dayTarget: number;

  /** Uncertainty percentage: 0-30% (0 = best, 30 = worst) */
  uncertaintyPercent: number;

  /** Selected mills for adjustment (empty = all mills) */
  selectedMills: string[];

  // ==================== CALCULATED SHIFT TARGETS (READ-ONLY) ====================

  /** Automatically calculated shift targets based on daily target and current moment */
  calculatedShifts: CalculatedShiftTargets;

  // ==================== REAL-TIME DATA (FROM API) ====================

  /** Current ore rate from real-time data (t/h) */
  currentOreRate: number;

  /** Actual production so far in current shift (tons) */
  actualShiftProduction: number;

  /** Actual production so far today (tons) */
  actualDayProduction: number;

  /** Actual production for completed shifts today */
  shift1Actual: number;
  shift2Actual: number;

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

  /** Set day target and recalculate shift targets automatically */
  setDayTarget: (target: number) => void;

  /** Recalculate shift targets based on current time and actual production */
  recalculateShiftTargets: () => void;

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

  // ==================== LEGACY COMPATIBILITY (for existing components) ====================

  /** Get shift1 target (calculated) */
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
  adjustedOreRate: number;
}

/**
 * Helper: Get current shift info based on time
 */
const getShiftInfo = (now: Date) => {
  const hour = now.getHours();
  if (hour >= 6 && hour < 14)
    return { shift: 1 as const, startHour: 6, endHour: 14 };
  if (hour >= 14 && hour < 22)
    return { shift: 2 as const, startHour: 14, endHour: 22 };
  return { shift: 3 as const, startHour: 22, endHour: 6 };
};

/**
 * Helper: Calculate hours remaining in current shift
 */
const getHoursRemainingInShift = (now: Date): number => {
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const { shift, endHour } = getShiftInfo(now);

  if (shift === 3) {
    // S3 wraps around midnight (22:00 -> 06:00)
    return hour >= 22 ? 24 - hour + 6 - minutes / 60 : 6 - hour - minutes / 60;
  }
  return endHour - hour - minutes / 60;
};

/**
 * Helper: Calculate hours remaining until end of production day (06:00)
 */
const getHoursToEndOfDay = (now: Date): number => {
  const hour = now.getHours();
  const minutes = now.getMinutes();
  // Production day ends at 06:00
  if (hour >= 6) {
    return 24 - hour + 6 - minutes / 60;
  }
  return 6 - hour - minutes / 60;
};

/**
 * Zustand store for mills forecasting settings and real-time data
 *
 * SIMPLIFIED APPROACH:
 * - User sets ONLY the daily target
 * - Shift targets are AUTOMATICALLY calculated based on:
 *   - Past shifts: Use actual production (can't change the past)
 *   - Current shift: Actual so far + (remaining hours × required rate)
 *   - Future shifts: Distribute remaining evenly based on hours
 */
export const useForecastingStore = create<ForecastingSettings>((set, get) => ({
  // ==================== INITIAL STATE ====================

  // User setting - THE MAIN CONTROL
  dayTarget: TARGET_RANGES.day.default,
  uncertaintyPercent: UNCERTAINTY_RANGES.default,
  selectedMills: [],

  // Calculated shift targets (auto-updated)
  calculatedShifts: {
    shift1: {
      target: TARGET_RANGES.day.default / 3,
      isActual: false,
      hoursRemaining: 8,
    },
    shift2: {
      target: TARGET_RANGES.day.default / 3,
      isActual: false,
      hoursRemaining: 8,
    },
    shift3: {
      target: TARGET_RANGES.day.default / 3,
      isActual: false,
      hoursRemaining: 8,
    },
    requiredRate: TARGET_RANGES.day.default / 24,
  },

  // Real-time data
  currentOreRate: ORE_RATE_RANGES.default,
  actualShiftProduction: 0,
  actualDayProduction: 0,
  shift1Actual: 0,
  shift2Actual: 0,
  activeMillsCount: 0,
  lastDataUpdate: null,

  // UI state
  isRealTimeMode: true,
  isLoading: false,

  // Legacy compatibility - these are synced from calculatedShifts
  shift1Target: TARGET_RANGES.day.default / 3,
  shift2Target: TARGET_RANGES.day.default / 3,
  shift3Target: TARGET_RANGES.day.default / 3,
  adjustedOreRate: ORE_RATE_RANGES.default,

  // ==================== ACTIONS ====================

  setDayTarget: (target: number) => {
    console.log("📊 Setting day target:", target);
    set({ dayTarget: target });
    // Recalculate shift targets automatically
    get().recalculateShiftTargets();
  },

  recalculateShiftTargets: () => {
    const state = get();
    const {
      dayTarget,
      actualDayProduction,
      actualShiftProduction,
      shift1Actual,
      shift2Actual,
      currentOreRate,
    } = state;

    const now = new Date();
    const { shift: currentShift } = getShiftInfo(now);
    const hoursRemainingInShift = getHoursRemainingInShift(now);
    const hoursToEndOfDay = getHoursToEndOfDay(now);

    console.log("🧮 Auto-calculating shift targets:", {
      dayTarget,
      currentShift,
      hoursRemainingInShift: hoursRemainingInShift.toFixed(1),
      hoursToEndOfDay: hoursToEndOfDay.toFixed(1),
      actualDayProduction,
      actualShiftProduction,
    });

    // Calculate remaining production needed
    const remainingForDay = Math.max(0, dayTarget - actualDayProduction);

    // Calculate required rate to meet daily target
    const requiredRate =
      hoursToEndOfDay > 0 ? remainingForDay / hoursToEndOfDay : currentOreRate;

    // Build shift targets based on current shift
    let s1Target: number, s2Target: number, s3Target: number;
    let s1IsActual = false,
      s2IsActual = false,
      s3IsActual = false;
    let s1Hours = 0,
      s2Hours = 0,
      s3Hours = 0;

    if (currentShift === 1) {
      // We're in S1: S1 = actual + remaining, S2 & S3 are future
      s1Hours = hoursRemainingInShift;
      s2Hours = 8;
      s3Hours = 8;

      const futureHours = s1Hours + s2Hours + s3Hours;
      const rateForRemaining =
        futureHours > 0 ? remainingForDay / futureHours : currentOreRate;

      s1Target = actualShiftProduction + s1Hours * rateForRemaining;
      s2Target = s2Hours * rateForRemaining;
      s3Target = s3Hours * rateForRemaining;
    } else if (currentShift === 2) {
      // We're in S2: S1 is past (use actual), S2 = actual + remaining, S3 is future
      s1IsActual = true;
      s1Target =
        shift1Actual > 0
          ? shift1Actual
          : actualDayProduction - actualShiftProduction;
      s1Hours = 0;

      s2Hours = hoursRemainingInShift;
      s3Hours = 8;

      const remainingAfterS1 = Math.max(0, dayTarget - s1Target);
      const futureHours = s2Hours + s3Hours;
      const rateForRemaining =
        futureHours > 0 ? remainingAfterS1 / futureHours : currentOreRate;

      s2Target = actualShiftProduction + s2Hours * rateForRemaining;
      s3Target = s3Hours * rateForRemaining;
    } else {
      // We're in S3: S1 & S2 are past, S3 = actual + remaining
      s1IsActual = true;
      s2IsActual = true;

      // Use stored actuals or estimate from day total
      s1Target =
        shift1Actual > 0
          ? shift1Actual
          : (actualDayProduction - actualShiftProduction) * 0.5;
      s2Target =
        shift2Actual > 0
          ? shift2Actual
          : (actualDayProduction - actualShiftProduction) * 0.5;
      s1Hours = 0;
      s2Hours = 0;

      s3Hours = hoursRemainingInShift;
      const remainingAfterS1S2 = Math.max(0, dayTarget - s1Target - s2Target);
      const rateForRemaining =
        s3Hours > 0 ? remainingAfterS1S2 / s3Hours : currentOreRate;

      s3Target = actualShiftProduction + s3Hours * rateForRemaining;
    }

    const calculatedShifts: CalculatedShiftTargets = {
      shift1: {
        target: s1Target,
        isActual: s1IsActual,
        hoursRemaining: s1Hours,
      },
      shift2: {
        target: s2Target,
        isActual: s2IsActual,
        hoursRemaining: s2Hours,
      },
      shift3: {
        target: s3Target,
        isActual: s3IsActual,
        hoursRemaining: s3Hours,
      },
      requiredRate,
    };

    console.log("✅ Calculated shift targets:", {
      S1: `${Math.round(s1Target)}t ${
        s1IsActual ? "(actual)" : `(${s1Hours.toFixed(1)}h remaining)`
      }`,
      S2: `${Math.round(s2Target)}t ${
        s2IsActual ? "(actual)" : `(${s2Hours.toFixed(1)}h remaining)`
      }`,
      S3: `${Math.round(s3Target)}t ${
        s3IsActual ? "(actual)" : `(${s3Hours.toFixed(1)}h remaining)`
      }`,
      total: Math.round(s1Target + s2Target + s3Target),
      requiredRate: `${requiredRate.toFixed(1)} t/h`,
    });

    // Update both calculated shifts and legacy compatibility properties
    set({
      calculatedShifts,
      shift1Target: s1Target,
      shift2Target: s2Target,
      shift3Target: s3Target,
      adjustedOreRate: currentOreRate,
    });
  },

  setUncertaintyPercent: (percent: number) => {
    console.log("🎲 Setting uncertainty percent:", percent);
    set({ uncertaintyPercent: percent });
  },

  setSelectedMills: (mills: string[]) => {
    console.log("🏭 Setting selected mills:", mills);
    set({ selectedMills: mills });
  },

  updateRealTimeData: (data: ProductionDataUpdate) => {
    const state = get();
    const now = new Date();
    const { shift: currentShift } = getShiftInfo(now);

    console.log("🔄 Updating real-time data:", {
      currentOreRate: data.currentOreRate,
      actualShiftProduction: data.actualShiftProduction,
      actualDayProduction: data.actualDayProduction,
      activeMillsCount: data.activeMillsCount,
      currentShift,
    });

    // Track actual production for past shifts
    // When shift changes, store the previous shift's final production
    let { shift1Actual, shift2Actual } = state;

    // If we're in S2 and S1 actual is 0, estimate S1 from day production
    if (
      currentShift === 2 &&
      shift1Actual === 0 &&
      data.actualDayProduction > data.actualShiftProduction
    ) {
      shift1Actual = data.actualDayProduction - data.actualShiftProduction;
    }
    // If we're in S3, estimate S1+S2 split
    if (currentShift === 3 && shift1Actual === 0 && shift2Actual === 0) {
      const pastProduction =
        data.actualDayProduction - data.actualShiftProduction;
      shift1Actual = pastProduction * 0.52; // S1 usually slightly higher
      shift2Actual = pastProduction * 0.48;
    }

    set({
      currentOreRate: data.currentOreRate,
      actualShiftProduction: data.actualShiftProduction,
      actualDayProduction: data.actualDayProduction,
      activeMillsCount: data.activeMillsCount,
      shift1Actual,
      shift2Actual,
      lastDataUpdate: new Date(),
    });

    // Recalculate shift targets with new data
    get().recalculateShiftTargets();
  },

  toggleRealTimeMode: () => {
    const newMode = !get().isRealTimeMode;
    console.log("🔄 Toggling real-time mode:", newMode ? "ON" : "OFF");
    set({ isRealTimeMode: newMode });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  resetToDefaults: () => {
    console.log("🔄 Resetting to defaults");
    set({
      dayTarget: TARGET_RANGES.day.default,
      uncertaintyPercent: UNCERTAINTY_RANGES.default,
      selectedMills: [],
      shift1Actual: 0,
      shift2Actual: 0,
    });
    get().recalculateShiftTargets();
  },
}));
