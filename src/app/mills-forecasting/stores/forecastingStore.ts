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

  /** Lock states for shift targets (true = locked, false = unlocked) */
  shift1Locked: boolean;
  shift2Locked: boolean;
  shift3Locked: boolean;

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

  /** Set all targets simultaneously (day and shifts) */
  setAllTargets: (day: number, s1: number, s2: number, s3: number) => void;

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

  /** Toggle lock state for a specific shift */
  toggleShiftLock: (shiftIndex: 1 | 2 | 3) => void;

  /** Check if a shift can be locked (max 2 locked at a time) */
  canLockShift: (shiftIndex: 1 | 2 | 3) => boolean;
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

  // Lock states - all unlocked by default
  shift1Locked: false,
  shift2Locked: false,
  shift3Locked: false,

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

  setAllTargets: (day, s1, s2, s3) => {
    console.log("📊 Setting all targets:", { day, s1, s2, s3 });
    set({
      dayTarget: day,
      shift1Target: s1,
      shift2Target: s2,
      shift3Target: s3,
    });
  },

  adjustShiftTarget: (shiftIndex, newValue) => {
    const state = get();
    const {
      shift1Target,
      shift2Target,
      shift3Target,
      dayTarget,
      shift1Locked,
      shift2Locked,
      shift3Locked,
    } = state;

    console.log(`🎯 Adjusting shift ${shiftIndex} target to:`, newValue);

    // Calculate the delta
    const currentValues = [shift1Target, shift2Target, shift3Target];
    const lockStates = [shift1Locked, shift2Locked, shift3Locked];
    const oldValue = currentValues[shiftIndex - 1];
    const delta = newValue - oldValue;

    // Get unlocked shifts (excluding the one being adjusted)
    const otherUnlockedIndices = [0, 1, 2].filter(
      (i) => i !== shiftIndex - 1 && !lockStates[i]
    );

    // Redistribute delta proportionally to other UNLOCKED shifts only
    const newValues = [...currentValues];
    newValues[shiftIndex - 1] = newValue;

    if (otherUnlockedIndices.length > 0) {
      const otherUnlockedTotal = otherUnlockedIndices.reduce(
        (sum, i) => sum + currentValues[i],
        0
      );

      if (otherUnlockedTotal > 0) {
        otherUnlockedIndices.forEach((i) => {
          const proportion = currentValues[i] / otherUnlockedTotal;
          newValues[i] = currentValues[i] - delta * proportion;
          // Ensure non-negative values
          newValues[i] = Math.max(100, newValues[i]);
        });
      } else {
        // If other unlocked shifts are 0, distribute equally
        const lockedTotal = [0, 1, 2]
          .filter((i) => lockStates[i])
          .reduce((sum, i) => sum + currentValues[i], 0);
        const remaining = dayTarget - newValue - lockedTotal;
        otherUnlockedIndices.forEach((i) => {
          newValues[i] = remaining / otherUnlockedIndices.length;
        });
      }
    }

    // Normalize to ensure exact sum equals daily target (only adjust unlocked shifts)
    const currentSum = newValues.reduce((sum, val) => sum + val, 0);
    if (Math.abs(currentSum - dayTarget) > 0.01) {
      const unlockedIndices = [0, 1, 2].filter((i) => !lockStates[i]);
      const unlockedSum = unlockedIndices.reduce(
        (sum, i) => sum + newValues[i],
        0
      );
      const lockedSum = [0, 1, 2]
        .filter((i) => lockStates[i])
        .reduce((sum, i) => sum + newValues[i], 0);
      const targetUnlockedSum = dayTarget - lockedSum;
      const adjustmentFactor =
        unlockedSum > 0 ? targetUnlockedSum / unlockedSum : 1;

      unlockedIndices.forEach((i) => {
        newValues[i] = newValues[i] * adjustmentFactor;
      });
    }

    console.log("🔄 Redistributed shift targets:", {
      S1: Math.round(newValues[0]) + (lockStates[0] ? " 🔒" : ""),
      S2: Math.round(newValues[1]) + (lockStates[1] ? " 🔒" : ""),
      S3: Math.round(newValues[2]) + (lockStates[2] ? " 🔒" : ""),
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
    const state = get();
    const target = dailyTarget || state.dayTarget;
    const {
      currentOreRate,
      activeMillsCount,
      shift1Target,
      shift2Target,
      shift3Target,
      shift1Locked,
      shift2Locked,
      shift3Locked,
    } = state;

    console.log(
      "🧮 Calculating initial shift targets for daily target:",
      target
    );

    // Get locked shifts and their total
    const lockStates = [shift1Locked, shift2Locked, shift3Locked];
    const currentValues = [shift1Target, shift2Target, shift3Target];
    const lockedIndices = [0, 1, 2].filter((i) => lockStates[i]);
    const unlockedIndices = [0, 1, 2].filter((i) => !lockStates[i]);

    // If all shifts are locked, don't recalculate
    if (unlockedIndices.length === 0) {
      console.log("⚠️ All shifts locked, skipping recalculation");
      return;
    }

    // Calculate locked total
    const lockedTotal = lockedIndices.reduce(
      (sum, i) => sum + currentValues[i],
      0
    );
    const remainingTarget = target - lockedTotal;

    console.log("🔒 Lock status:", {
      lockedShifts: lockedIndices.map((i) => `S${i + 1}`).join(", ") || "none",
      lockedTotal: Math.round(lockedTotal),
      remainingTarget: Math.round(remainingTarget),
    });

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

    const weights = [s1Weight, s2Weight, s3Weight];

    // Calculate new values
    const newValues = [...currentValues];

    // Only recalculate unlocked shifts
    if (unlockedIndices.length > 0) {
      // Get total weight of unlocked shifts
      const unlockedWeightTotal = unlockedIndices.reduce(
        (sum, i) => sum + weights[i],
        0
      );

      // Distribute remaining target proportionally among unlocked shifts
      unlockedIndices.forEach((i) => {
        const proportion = weights[i] / unlockedWeightTotal;
        newValues[i] = remainingTarget * proportion;
      });
    }

    console.log("✅ Calculated shift targets:", {
      S1: Math.round(newValues[0]) + (lockStates[0] ? " 🔒" : ""),
      S2: Math.round(newValues[1]) + (lockStates[1] ? " 🔒" : ""),
      S3: Math.round(newValues[2]) + (lockStates[2] ? " 🔒" : ""),
      total: Math.round(newValues[0] + newValues[1] + newValues[2]),
    });

    set({
      shift1Target: newValues[0],
      shift2Target: newValues[1],
      shift3Target: newValues[2],
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

  toggleShiftLock: (shiftIndex) => {
    const state = get();
    const lockStates = [
      state.shift1Locked,
      state.shift2Locked,
      state.shift3Locked,
    ];
    const currentLockState = lockStates[shiftIndex - 1];

    // If trying to lock, check if we can
    if (!currentLockState && !state.canLockShift(shiftIndex)) {
      console.warn(
        `⚠️ Cannot lock shift ${shiftIndex}: Maximum 2 shifts can be locked`
      );
      return;
    }

    console.log(
      `🔒 Toggling lock for shift ${shiftIndex}: ${
        currentLockState ? "UNLOCK" : "LOCK"
      }`
    );

    // Update lock state
    const updates: Partial<ForecastingSettings> = {};
    if (shiftIndex === 1) updates.shift1Locked = !currentLockState;
    if (shiftIndex === 2) updates.shift2Locked = !currentLockState;
    if (shiftIndex === 3) updates.shift3Locked = !currentLockState;

    set(updates);
  },

  canLockShift: (shiftIndex) => {
    const state = get();
    const lockStates = [
      state.shift1Locked,
      state.shift2Locked,
      state.shift3Locked,
    ];
    const currentLockState = lockStates[shiftIndex - 1];

    // If already locked, can always unlock
    if (currentLockState) return true;

    // Count currently locked shifts
    const lockedCount = lockStates.filter((locked) => locked).length;

    // Can lock if less than 2 shifts are currently locked
    return lockedCount < 2;
  },
}));
