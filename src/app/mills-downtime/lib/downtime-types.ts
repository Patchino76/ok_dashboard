// Mill configuration
export interface Mill {
  id: string;
  name: string; // English name (e.g., "Ball Mill 1")
  nameBg: string; // Bulgarian name (e.g., "Мелница 01")
  section: string;
  normalFeedRate: number; // t/h - configurable per mill
}

// Downtime thresholds - configurable
export interface DowntimeConfig {
  downtimeThreshold: number; // Below this ore rate = downtime (default: 10 t/h)
  minorDowntimeMaxMinutes: number; // Below this = minor, above = major (default: 60 min)
}

export const DEFAULT_DOWNTIME_CONFIG: DowntimeConfig = {
  downtimeThreshold: 10, // t/h
  minorDowntimeMaxMinutes: 60, // minutes
};

// Downtime event types
export type DowntimeCategory = "minor" | "major";

export type DowntimeReason =
  | "scheduled_maintenance"
  | "mechanical"
  | "technological"
  | "electrical";

export interface DowntimeEvent {
  id: string;
  millId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  category: DowntimeCategory;
  reason: DowntimeReason;
  feedRateBefore: number;
  feedRateDuring: number;
  notes?: string;
}

export interface FeedRateReading {
  timestamp: Date;
  millId: string;
  feedRate: number;
}

export interface MillMetrics {
  millId: string;
  millName: string;
  availability: number; // percentage
  mtbf: number; // hours - Mean Time Between Failures
  mttr: number; // hours - Mean Time To Repair
  totalDowntime: number; // hours
  minorDowntimes: number;
  majorDowntimes: number;
  totalEvents: number;
  avgDowntimeDuration: number; // minutes
  feedEfficiency: number; // percentage
  currentOreRate: number; // t/h
  isRunning: boolean;
}

export interface AggregateMetrics {
  totalDowntimeHours: number;
  avgAvailability: number;
  avgMtbf: number;
  avgMttr: number;
  totalMinorDowntimes: number;
  totalMajorDowntimes: number;
  totalMinorDurationHours: number; // Duration of minor downtimes in hours
  totalMajorDurationHours: number; // Duration of major downtimes in hours
  totalEvents: number;
  activeMillsCount: number;
  totalMillsCount: number;
}

// Time range options
export type TimeRange = "7d" | "14d" | "30d" | "60d" | "90d";

export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  labelBg: string;
  days: number;
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: "7d", label: "7 Days", labelBg: "7 дни", days: 7 },
  { value: "14d", label: "14 Days", labelBg: "14 дни", days: 14 },
  { value: "30d", label: "30 Days", labelBg: "30 дни", days: 30 },
  { value: "60d", label: "60 Days", labelBg: "60 дни", days: 60 },
  { value: "90d", label: "90 Days", labelBg: "90 дни", days: 90 },
];

// Chart data types
export interface DowntimeByDay {
  date: string;
  minor: number; // count of minor events
  major: number; // count of major events
  total: number; // total count
  minorDuration: number; // duration in hours
  majorDuration: number; // duration in hours
  totalDuration: number; // total duration in hours
}

export interface DowntimeByReason {
  reason: string;
  reasonBg: string;
  minor: number;
  major: number;
  total: number;
}

export interface MillComparisonData {
  mill: string;
  millBg: string;
  availability: number;
  mtbf: number;
  mttr: number;
  efficiency: number;
}
