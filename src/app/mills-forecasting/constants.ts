import type { Uncertainty } from "./types/forecasting";

// Mills configuration
export const MILLS_LIST = [
  "all",
  "Mill_1",
  "Mill_2",
  "Mill_3",
  "Mill_4",
  "Mill_5",
  "Mill_6",
  "Mill_7",
  "Mill_8",
  "Mill_9",
  "Mill_10",
] as const;

// Target ranges
export const TARGET_RANGES = {
  shift: {
    min: 800,
    max: 2000,
    step: 50,
    default: 1400,
  },
  day: {
    min: 2400,
    max: 6000,
    step: 100,
    default: 4000,
  },
} as const;

// Ore rate ranges
export const ORE_RATE_RANGES = {
  min: 100,
  max: 250,
  step: 0.5,
  default: 169.67,
} as const;

// Uncertainty configurations
export const UNCERTAINTY_LEVELS: Record<1 | 2 | 3, Uncertainty> = {
  1: {
    name: "Low",
    color: "#10b981",
    factor: 0.95,
    stoppageProb: 0.05,
    avgStoppage: 5,
  },
  2: {
    name: "Medium",
    color: "#f59e0b",
    factor: 0.9,
    stoppageProb: 0.12,
    avgStoppage: 10,
  },
  3: {
    name: "High",
    color: "#ef4444",
    factor: 0.82,
    stoppageProb: 0.2,
    avgStoppage: 20,
  },
} as const;

// Shift definitions
export const SHIFTS = [
  { shift: 1, name: "S1", startHour: 6, endHour: 14, label: "S1 (06-14)" },
  { shift: 2, name: "S2", startHour: 14, endHour: 22, label: "S2 (14-22)" },
  { shift: 3, name: "S3", startHour: 22, endHour: 6, label: "S3 (22-06)" },
] as const;

// Color scheme
export const COLORS = {
  optimistic: "#10b981",
  expected: "#f59e0b",
  pessimistic: "#ef4444",
  target: "#3b82f6",
  actual: "#0ea5e9",
  primary: "#0f172a",
} as const;
