import type {
  DowntimeEvent,
  DowntimeConfig,
  DowntimeCategory,
  FeedRateReading,
  MillMetrics,
  AggregateMetrics,
  DowntimeByDay,
  DowntimeByReason,
  MillComparisonData,
} from "./downtime-types";
import {
  MILLS,
  getRandomReason,
  generateSimulatedNotes,
  DOWNTIME_REASONS,
} from "./downtime-utils";
import type { TrendDataPoint } from "@/lib/hooks/useMills";

interface TrendPoint {
  timestamp: string;
  value: number;
}

/**
 * Detect downtime events from ore rate trend data
 * A downtime is detected when ore rate drops below the threshold
 */
export function detectDowntimeEvents(
  millId: string,
  trendData: TrendPoint[],
  config: DowntimeConfig = {
    downtimeThreshold: 100,
    minorDowntimeMaxMinutes: 60,
  }
): DowntimeEvent[] {
  if (!trendData || trendData.length < 2) return [];

  const events: DowntimeEvent[] = [];
  let inDowntime = false;
  let downtimeStart: Date | null = null;
  let feedRateBefore = 0;
  let minFeedRateDuring = Infinity;

  // Sort by timestamp
  const sortedData = [...trendData].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const point = sortedData[i];
    const timestamp = new Date(point.timestamp);
    const feedRate = point.value;

    if (feedRate < config.downtimeThreshold) {
      // Entering or continuing downtime
      if (!inDowntime) {
        inDowntime = true;
        downtimeStart = timestamp;
        // Get feed rate before downtime (previous point or current)
        feedRateBefore = i > 0 ? sortedData[i - 1].value : feedRate;
        minFeedRateDuring = feedRate;
      } else {
        minFeedRateDuring = Math.min(minFeedRateDuring, feedRate);
      }
    } else {
      // Exiting downtime
      if (inDowntime && downtimeStart) {
        const duration = Math.round(
          (timestamp.getTime() - downtimeStart.getTime()) / (1000 * 60)
        );

        // Only record if duration is at least 5 minutes (filter noise)
        if (duration >= 5) {
          const category: DowntimeCategory =
            duration < config.minorDowntimeMaxMinutes ? "minor" : "major";
          const reason = getRandomReason();

          events.push({
            id: `DT-${millId}-${downtimeStart.getTime()}`,
            millId,
            startTime: downtimeStart,
            endTime: timestamp,
            duration,
            category,
            reason,
            feedRateBefore,
            feedRateDuring: Math.round(minFeedRateDuring),
            notes: generateSimulatedNotes(reason, category),
          });
        }

        inDowntime = false;
        downtimeStart = null;
        minFeedRateDuring = Infinity;
      }
    }
  }

  // Handle case where downtime extends to the end of data
  if (inDowntime && downtimeStart) {
    const lastPoint = sortedData[sortedData.length - 1];
    const endTime = new Date(lastPoint.timestamp);
    const duration = Math.round(
      (endTime.getTime() - downtimeStart.getTime()) / (1000 * 60)
    );

    if (duration >= 5) {
      const category: DowntimeCategory =
        duration < config.minorDowntimeMaxMinutes ? "minor" : "major";
      const reason = getRandomReason();

      events.push({
        id: `DT-${millId}-${downtimeStart.getTime()}`,
        millId,
        startTime: downtimeStart,
        endTime,
        duration,
        category,
        reason,
        feedRateBefore,
        feedRateDuring: Math.round(minFeedRateDuring),
        notes: generateSimulatedNotes(reason, category),
      });
    }
  }

  return events.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
}

/**
 * Calculate metrics for a single mill
 */
export function calculateMillMetrics(
  millId: string,
  events: DowntimeEvent[],
  totalMinutes: number,
  currentOreRate: number = 0,
  isRunning: boolean = false
): MillMetrics {
  const mill = MILLS.find((m) => m.id === millId);
  const millEvents = events.filter((e) => e.millId === millId);
  const minorEvents = millEvents.filter((e) => e.category === "minor");
  const majorEvents = millEvents.filter((e) => e.category === "major");

  const totalDowntimeMinutes = millEvents.reduce(
    (sum, e) => sum + e.duration,
    0
  );
  const totalDowntimeHours = totalDowntimeMinutes / 60;
  const availableMinutes = totalMinutes - totalDowntimeMinutes;
  const availability =
    totalMinutes > 0 ? (availableMinutes / totalMinutes) * 100 : 100;

  // MTBF = Total operating time / Number of failures
  const mtbf =
    millEvents.length > 0
      ? availableMinutes / 60 / millEvents.length
      : totalMinutes / 60;

  // MTTR = Total repair time / Number of repairs
  const mttr =
    millEvents.length > 0 ? totalDowntimeHours / millEvents.length : 0;

  const avgDowntimeDuration =
    millEvents.length > 0 ? totalDowntimeMinutes / millEvents.length : 0;

  // Feed efficiency based on actual vs expected production
  const normalFeedRate = mill?.normalFeedRate || 160;
  const expectedFeed = normalFeedRate * (totalMinutes / 60);
  const actualFeed = normalFeedRate * (availableMinutes / 60);
  const feedEfficiency =
    expectedFeed > 0 ? (actualFeed / expectedFeed) * 100 : 100;

  return {
    millId,
    millName: mill?.nameBg || millId,
    availability: Math.round(availability * 100) / 100,
    mtbf: Math.round(mtbf * 100) / 100,
    mttr: Math.round(mttr * 100) / 100,
    totalDowntime: Math.round(totalDowntimeHours * 100) / 100,
    minorDowntimes: minorEvents.length,
    majorDowntimes: majorEvents.length,
    totalEvents: millEvents.length,
    avgDowntimeDuration: Math.round(avgDowntimeDuration),
    feedEfficiency: Math.round(feedEfficiency * 100) / 100,
    currentOreRate,
    isRunning,
  };
}

/**
 * Calculate aggregate metrics across all mills
 */
export function calculateAggregateMetrics(
  millMetrics: MillMetrics[],
  events: DowntimeEvent[] = []
): AggregateMetrics {
  const activeMillsCount = millMetrics.filter((m) => m.isRunning).length;

  // Calculate duration by category from events
  const minorEvents = events.filter((e) => e.category === "minor");
  const majorEvents = events.filter((e) => e.category === "major");
  const totalMinorDurationHours =
    minorEvents.reduce((sum, e) => sum + e.duration, 0) / 60;
  const totalMajorDurationHours =
    majorEvents.reduce((sum, e) => sum + e.duration, 0) / 60;

  return {
    totalDowntimeHours: millMetrics.reduce(
      (sum, m) => sum + m.totalDowntime,
      0
    ),
    avgAvailability:
      millMetrics.length > 0
        ? millMetrics.reduce((sum, m) => sum + m.availability, 0) /
          millMetrics.length
        : 0,
    avgMtbf:
      millMetrics.length > 0
        ? millMetrics.reduce((sum, m) => sum + m.mtbf, 0) / millMetrics.length
        : 0,
    avgMttr:
      millMetrics.length > 0
        ? millMetrics.reduce((sum, m) => sum + m.mttr, 0) / millMetrics.length
        : 0,
    totalMinorDowntimes: millMetrics.reduce(
      (sum, m) => sum + m.minorDowntimes,
      0
    ),
    totalMajorDowntimes: millMetrics.reduce(
      (sum, m) => sum + m.majorDowntimes,
      0
    ),
    totalMinorDurationHours: Math.round(totalMinorDurationHours * 100) / 100,
    totalMajorDurationHours: Math.round(totalMajorDurationHours * 100) / 100,
    totalEvents: millMetrics.reduce((sum, m) => sum + m.totalEvents, 0),
    activeMillsCount,
    totalMillsCount: millMetrics.length,
  };
}

/**
 * Get downtimes grouped by day
 */
export function getDowntimesByDay(
  events: DowntimeEvent[],
  days: number
): DowntimeByDay[] {
  const now = new Date();
  const result: Record<string, DowntimeByDay> = {};

  // Initialize all days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split("T")[0];
    result[key] = {
      date: key,
      minor: 0,
      major: 0,
      total: 0,
      minorDuration: 0,
      majorDuration: 0,
      totalDuration: 0,
    };
  }

  // Count events and sum durations per day
  events.forEach((e) => {
    const key = e.startTime.toISOString().split("T")[0];
    if (result[key]) {
      result[key][e.category]++;
      result[key].total++;
      // Add duration in hours (e.duration is in minutes)
      const durationHours = e.duration / 60;
      if (e.category === "minor") {
        result[key].minorDuration += durationHours;
      } else {
        result[key].majorDuration += durationHours;
      }
      result[key].totalDuration += durationHours;
    }
  });

  // Round durations to 2 decimal places
  Object.values(result).forEach((day) => {
    day.minorDuration = Math.round(day.minorDuration * 100) / 100;
    day.majorDuration = Math.round(day.majorDuration * 100) / 100;
    day.totalDuration = Math.round(day.totalDuration * 100) / 100;
  });

  return Object.values(result);
}

/**
 * Get downtimes grouped by reason
 */
export function getDowntimesByReason(
  events: DowntimeEvent[]
): DowntimeByReason[] {
  const counts: Record<string, { minor: number; major: number }> = {};

  // Initialize all reasons
  Object.keys(DOWNTIME_REASONS).forEach((reason) => {
    counts[reason] = { minor: 0, major: 0 };
  });

  // Count events per reason
  events.forEach((e) => {
    if (counts[e.reason]) {
      counts[e.reason][e.category]++;
    }
  });

  return Object.entries(counts)
    .map(([reason, data]) => ({
      reason:
        DOWNTIME_REASONS[reason as keyof typeof DOWNTIME_REASONS]?.en || reason,
      reasonBg:
        DOWNTIME_REASONS[reason as keyof typeof DOWNTIME_REASONS]?.bg || reason,
      minor: data.minor,
      major: data.major,
      total: data.minor + data.major,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Get mill comparison data
 */
export function getMillComparisonData(
  millMetrics: MillMetrics[]
): MillComparisonData[] {
  return millMetrics.map((m) => {
    const mill = MILLS.find((mill) => mill.id === m.millId);
    return {
      mill: m.millId,
      millBg: mill?.nameBg || m.millId,
      availability: m.availability,
      mtbf: m.mtbf,
      mttr: m.mttr,
      efficiency: m.feedEfficiency,
    };
  });
}

/**
 * Get recent events, optionally filtered by mill
 */
export function getRecentEvents(
  events: DowntimeEvent[],
  millId?: string,
  limit: number = 10
): DowntimeEvent[] {
  let filtered = events;
  if (millId) {
    filtered = events.filter((e) => e.millId === millId);
  }
  return filtered
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, limit);
}

/**
 * Get feed rate data for a specific mill from trend data
 */
export function getMillFeedRateData(
  millId: string,
  trendData: TrendPoint[]
): Array<{ time: string; feedRate: number }> {
  return trendData
    .map((r) => ({
      time: r.timestamp,
      feedRate: r.value,
    }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}
