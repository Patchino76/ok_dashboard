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
  mechanical_failure: { en: "Mechanical Failure", bg: "Механична повреда" },
  electrical_fault: { en: "Electrical Fault", bg: "Електрическа неизправност" },
  scheduled_maintenance: {
    en: "Scheduled Maintenance",
    bg: "Планирана поддръжка",
  },
  liner_replacement: { en: "Liner Replacement", bg: "Смяна на облицовка" },
  bearing_issue: { en: "Bearing Issue", bg: "Проблем с лагери" },
  motor_overload: { en: "Motor Overload", bg: "Претоварване на двигател" },
  feed_chute_blockage: {
    en: "Feed Chute Blockage",
    bg: "Запушване на захранващ улей",
  },
  lubrication_system: { en: "Lubrication System", bg: "Система за смазване" },
  unknown: { en: "Unknown", bg: "Неизвестна" },
};

// All reason keys for random selection
export const DOWNTIME_REASON_KEYS: DowntimeReason[] = [
  "mechanical_failure",
  "electrical_fault",
  "scheduled_maintenance",
  "liner_replacement",
  "bearing_issue",
  "motor_overload",
  "feed_chute_blockage",
  "lubrication_system",
];

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
    return category === "minor" ? "Кратък" : "ППР";
  }
  return category === "minor" ? "Minor" : "Major";
}

/**
 * Get random downtime reason (for simulation)
 */
export function getRandomReason(): DowntimeReason {
  return DOWNTIME_REASON_KEYS[
    Math.floor(Math.random() * DOWNTIME_REASON_KEYS.length)
  ];
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
    mechanical_failure: "Необходима е проверка на механичните компоненти",
    electrical_fault: "Електрическа диагностика в процес",
    scheduled_maintenance: "Планова профилактика съгласно график",
    liner_replacement: "Смяна на износени облицовки",
    bearing_issue: "Проверка и смяна на лагери",
    motor_overload: "Проверка на електродвигателя",
    feed_chute_blockage: "Почистване на захранващата система",
    lubrication_system: "Проверка на смазочната система",
    unknown: "Причината се изследва",
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
  if (availability >= 85) return "text-yellow-500";
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
