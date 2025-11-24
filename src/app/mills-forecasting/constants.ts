import type { Uncertainty } from "./types/forecasting";
import { millsNames } from "@/lib/tags/mills-tags";

// Mills configuration (using correct format from mills-tags: Mill01, Mill02, etc.)
// All 12 mills, with "all" option
export const MILLS_LIST = [
  "all",
  ...millsNames.map((mill) => mill.en),
] as const;

// Target ranges
export const TARGET_RANGES = {
  shift: {
    min: 800,
    max: 20000,
    step: 50,
    default: 1400,
  },
  day: {
    min: 2400,
    max: 50000,
    step: 100,
    default: 45000,
  },
} as const;

// Ore rate ranges
export const ORE_RATE_RANGES = {
  min: 100,
  max: 250,
  step: 0.5,
  default: 169.67,
} as const;

// Uncertainty configuration ranges
export const UNCERTAINTY_RANGES = {
  min: 0, // 0% uncertainty (100% availability)
  max: 30, // 30% uncertainty (70% availability)
  step: 1,
  default: 10, // 10% uncertainty (90% availability)
} as const;

// Calculate uncertainty parameters from percentage
export const calculateUncertainty = (
  uncertaintyPercent: number
): Uncertainty => {
  // Clamp value between min and max
  const clamped = Math.max(
    UNCERTAINTY_RANGES.min,
    Math.min(UNCERTAINTY_RANGES.max, uncertaintyPercent)
  );

  // Availability factor: 100% - uncertainty%
  const factor = (100 - clamped) / 100;

  // Stoppage probability scales with uncertainty (0% = 0.02, 30% = 0.25)
  const stoppageProb = 0.02 + (clamped / 30) * 0.23;

  // Average stoppage duration scales with uncertainty (0% = 3min, 30% = 25min)
  const avgStoppage = 3 + (clamped / 30) * 22;

  // Color based on uncertainty level
  let color: string;
  let name: string;
  if (clamped <= 10) {
    color = "#10b981"; // Green
    name = "Low";
  } else if (clamped <= 20) {
    color = "#f59e0b"; // Orange
    name = "Medium";
  } else {
    color = "#ef4444"; // Red
    name = "High";
  }

  return {
    name,
    color,
    factor,
    stoppageProb,
    avgStoppage,
  };
};

// Legacy: Keep for backward compatibility (deprecated)
export const UNCERTAINTY_LEVELS: Record<1 | 2 | 3, Uncertainty> = {
  1: calculateUncertainty(5),
  2: calculateUncertainty(10),
  3: calculateUncertainty(18),
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
