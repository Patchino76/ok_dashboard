import { TimeRange } from "@/app/dashboard/components/TimeRangeSelector";

/**
 * Converts a TimeRange string to hours
 * @param range The time range selector value
 * @returns Number of hours corresponding to the selected range
 */
export const getHoursFromTimeRange = (range: TimeRange): number => {
  switch (range) {
    case '8h': return 8;
    case '1d': return 24;
    case '3d': return 72;
    default: return 8;
  }
};

/**
 * Gets a human-readable label for the selected time range
 * @param range The time range selector value
 * @returns Human-readable label for the selected range
 */
export const getTimeRangeLabel = (range: TimeRange): string => {
  switch (range) {
    case '8h': return 'последните 8 часа';
    case '1d': return 'последните 24 часа';
    case '3d': return 'последните 3 дни';
    default: return 'последните 8 часа';
  }
};
