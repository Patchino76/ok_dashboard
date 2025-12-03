import type { DowntimeReason, DowntimeCategory, Mill } from "./downtime-types";
import { millsNames } from "@/lib/tags/mills-tags";

// Mill configuration with normal feed rates
export const MILLS: Mill[] = millsNames.map((mill, index) => ({
  id: mill.en,
  name: `Ball Mill ${index + 1}`,
  nameBg: mill.bg,
  section: `Секция ${Math.ceil((index + 1) / 4)}`,
  normalFeedRate: 160, // Default normal rate, can be customized per mill
}));

// Downtime reasons with Bulgarian translations
export const DOWNTIME_REASONS: Record<
  DowntimeReason,
  { en: string; bg: string }
> = {
  scheduled_maintenance: {
    en: "Scheduled Maintenance",
    bg: "Планиран ремонт",
  },
  mechanical: { en: "Mechanical", bg: "Механични" },
  technological: { en: "Technological", bg: "Технологични" },
  electrical: { en: "Electrical", bg: "Електрически" },
};

// All reason keys for random selection
export const DOWNTIME_REASON_KEYS: DowntimeReason[] = [
  "scheduled_maintenance",
  "mechanical",
  "technological",
  "electrical",
];

export const MINOR_REASONS: DowntimeReason[] = [
  "mechanical",
  "technological",
  "electrical",
];

export const MAJOR_REASONS: DowntimeReason[] = ["scheduled_maintenance"];

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format duration in Bulgarian
 */
export function formatDurationBg(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}ч ${mins}мин` : `${hours}ч`;
}

/**
 * Format downtime reason to display string
 */
export function formatReason(
  reason: DowntimeReason,
  lang: "en" | "bg" = "bg"
): string {
  return DOWNTIME_REASONS[reason]?.[lang] || reason;
}

/**
 * Get category label
 */
export function getCategoryLabel(
  category: DowntimeCategory,
  lang: "en" | "bg" = "bg"
): string {
  if (lang === "bg") {
    return category === "minor" ? "Кратки" : "ППР";
  }
  return category === "minor" ? "Minor" : "Major";
}

/**
 * Get random downtime reason (for simulation)
 */
export function getRandomReason(category?: DowntimeCategory): DowntimeReason {
  if (category === "major") {
    return "scheduled_maintenance";
  }

  // If minor or unspecified, pick from minor reasons
  // (Technically major should only be scheduled_maintenance, but for safety)
  return MINOR_REASONS[Math.floor(Math.random() * MINOR_REASONS.length)];
}

/**
 * Generate simulated notes for a downtime event
 */
export function generateSimulatedNotes(
  reason: DowntimeReason,
  category: DowntimeCategory
): string | undefined {
  if (category === "minor") return undefined;

  const notes: Record<DowntimeReason, string> = {
    scheduled_maintenance: "Планиран ремонт съгласно график",
    mechanical: "Проверка на механични компоненти",
    technological: "Технологична настройка",
    electrical: "Електрическа профилактика",
  };

  return notes[reason];
}

/**
 * Get mill by ID
 */
export function getMillById(millId: string): Mill | undefined {
  return MILLS.find((m) => m.id === millId);
}

/**
 * Get status color based on availability
 */
export function getStatusColor(availability: number): string {
  if (availability >= 95) return "bg-green-500";
  if (availability >= 85) return "bg-yellow-500";
  return "bg-red-500";
}

/**
 * Get status text color based on availability
 */
export function getStatusTextColor(availability: number): string {
  if (availability >= 95) return "text-green-500";
  if (availability >= 85) return "text-orange-500";
  return "text-red-500";
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format hours
 */
export function formatHours(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}h`;
}
