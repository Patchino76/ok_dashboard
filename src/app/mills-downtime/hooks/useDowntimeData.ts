import { useQuery, useQueries } from "@tanstack/react-query";
import apiClient from "@/lib/api/api-client";
import { millsNames, millsTags } from "@/lib/tags/mills-tags";
import {
  TIME_RANGE_OPTIONS,
  type DowntimeEvent,
  type MillMetrics,
  type AggregateMetrics,
  type DowntimeConfig,
  type TimeRange,
  type DowntimeByDay,
  type DowntimeByReason,
  type MillComparisonData,
} from "../lib/downtime-types";
import {
  detectDowntimeEvents,
  calculateMillMetrics,
  calculateAggregateMetrics,
  getDowntimesByDay,
  getDowntimesByReason,
  getMillComparisonData,
  getRecentEvents,
  getMillFeedRateData,
} from "../lib/downtime-detection";
import { MILLS } from "../lib/downtime-utils";

interface TrendDataPoint {
  timestamp: string;
  value: number;
}

interface MillOreData {
  title: string;
  state: boolean;
  ore: number;
  shift1?: number;
  shift2?: number;
  shift3?: number;
  total?: number;
}

/**
 * Get the number of hours based on time range
 */
function getHoursForRange(timeRange: TimeRange): number {
  const days =
    TIME_RANGE_OPTIONS.find((t) => t.value === timeRange)?.days || 30;
  return days * 24; // Convert days to hours
}

/**
 * Get ore tag ID for a specific mill
 */
function getOreTagId(millName: string): number | undefined {
  const oreTag = millsTags.Ore.find((tag) => tag.name === millName);
  return oreTag?.id;
}

/**
 * Hook to fetch current ore rates for all mills
 */
export function useCurrentOreRates(refreshInterval: number = 30) {
  const millsList = millsNames.map((mill) => mill.en);

  const queries = useQueries({
    queries: millsList.map((mill) => ({
      queryKey: ["mill-ore-current", mill],
      queryFn: async (): Promise<MillOreData> => {
        const response = await apiClient.get<MillOreData>(
          `/mills/ore-by-mill`,
          {
            params: { mill },
            timeout: 30000,
          }
        );
        return response.data;
      },
      staleTime: 0,
      refetchInterval: refreshInterval * 1000,
      retry: 2,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const data = queries.map((q, index) => ({
    millId: millsList[index],
    oreRate: q.data?.ore || 0,
    isRunning: q.data?.state || false,
    isLoading: q.isLoading,
    isError: q.isError,
  }));

  return {
    data,
    isLoading,
    isError,
    refetch: () => queries.forEach((q) => q.refetch()),
  };
}

/**
 * Hook to fetch ore rate trend for a specific mill
 */
export function useMillOreTrend(
  millId: string,
  timeRange: TimeRange = "30d",
  enabled: boolean = true
) {
  const hours = getHoursForRange(timeRange);
  const tagId = getOreTagId(millId);

  return useQuery<TrendDataPoint[]>({
    queryKey: ["mill-ore-trend", millId, timeRange, hours],
    queryFn: async () => {
      if (!tagId) {
        console.warn(`No ore tag found for mill ${millId}`);
        return [];
      }

      const response = await apiClient.get<TrendDataPoint[]>(
        `/mills/trend-by-tag`,
        {
          params: {
            mill: millId,
            tag: "ore",
            hours,
          },
          timeout: 60000, // Longer timeout for large data requests
        }
      );
      return response.data;
    },
    enabled: enabled && !!tagId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to fetch ore trends for all mills and detect downtimes
 */
export function useAllMillsDowntimeData(
  timeRange: TimeRange = "30d",
  config: DowntimeConfig = {
    downtimeThreshold: 10,
    minorDowntimeMaxMinutes: 60,
  },
  refreshInterval: number = 5 * 60 // 5 minutes
) {
  const millsList = millsNames.map((mill) => mill.en);
  const hours = getHoursForRange(timeRange);
  const days =
    TIME_RANGE_OPTIONS.find((t) => t.value === timeRange)?.days || 30;
  const totalMinutes = days * 24 * 60;

  // Fetch current ore rates
  const currentRates = useCurrentOreRates(30);

  // Fetch trend data for all mills
  const trendQueries = useQueries({
    queries: millsList.map((mill) => ({
      queryKey: ["mill-ore-trend", mill, timeRange, hours],
      queryFn: async (): Promise<{
        millId: string;
        data: TrendDataPoint[];
      }> => {
        try {
          const response = await apiClient.get<TrendDataPoint[]>(
            `/mills/trend-by-tag`,
            {
              params: {
                mill,
                tag: "ore",
                hours,
              },
              timeout: 60000,
            }
          );
          return { millId: mill, data: response.data };
        } catch (error) {
          console.warn(`Failed to fetch trend for ${mill}:`, error);
          return { millId: mill, data: [] };
        }
      },
      staleTime: 5 * 60 * 1000,
      refetchInterval: refreshInterval * 1000,
      retry: 2,
    })),
  });

  const isLoading =
    trendQueries.some((q) => q.isLoading) || currentRates.isLoading;
  const isError = trendQueries.every((q) => q.isError);

  // Process data when available
  const processedData = (() => {
    if (isLoading) return null;

    // Detect downtime events for each mill
    const allEvents: DowntimeEvent[] = [];
    const trendDataByMill: Record<string, TrendDataPoint[]> = {};

    trendQueries.forEach((query) => {
      if (query.data) {
        const { millId, data } = query.data;
        trendDataByMill[millId] = data;
        const events = detectDowntimeEvents(millId, data, config);
        allEvents.push(...events);
      }
    });

    // Calculate metrics for each mill
    const millMetrics: MillMetrics[] = millsList.map((millId) => {
      const currentData = currentRates.data.find((d) => d.millId === millId);
      return calculateMillMetrics(
        millId,
        allEvents,
        totalMinutes,
        currentData?.oreRate || 0,
        currentData?.isRunning || false
      );
    });

    // Calculate aggregate metrics
    const aggregateMetrics = calculateAggregateMetrics(millMetrics);

    // Get chart data
    const downtimesByDay = getDowntimesByDay(allEvents, days);
    const downtimesByReason = getDowntimesByReason(allEvents);
    const millComparisonData = getMillComparisonData(millMetrics);

    return {
      events: allEvents,
      millMetrics,
      aggregateMetrics,
      downtimesByDay,
      downtimesByReason,
      millComparisonData,
      trendDataByMill,
    };
  })();

  return {
    events: processedData?.events || [],
    millMetrics: processedData?.millMetrics || [],
    aggregateMetrics: processedData?.aggregateMetrics || {
      totalDowntimeHours: 0,
      avgAvailability: 0,
      avgMtbf: 0,
      avgMttr: 0,
      totalMinorDowntimes: 0,
      totalMajorDowntimes: 0,
      totalEvents: 0,
      activeMillsCount: 0,
      totalMillsCount: 12,
    },
    downtimesByDay: processedData?.downtimesByDay || [],
    downtimesByReason: processedData?.downtimesByReason || [],
    millComparisonData: processedData?.millComparisonData || [],
    trendDataByMill: processedData?.trendDataByMill || {},
    isLoading,
    isError,
    refetch: () => {
      currentRates.refetch();
      trendQueries.forEach((q) => q.refetch());
    },
  };
}

/**
 * Hook to get data for a specific mill
 */
export function useMillDowntimeData(
  millId: string,
  timeRange: TimeRange = "30d",
  config: DowntimeConfig = {
    downtimeThreshold: 10,
    minorDowntimeMaxMinutes: 60,
  }
) {
  const days =
    TIME_RANGE_OPTIONS.find((t) => t.value === timeRange)?.days || 30;
  const totalMinutes = days * 24 * 60;

  // Fetch current ore rate - only when millId is provided
  const currentRate = useQuery({
    queryKey: ["mill-ore-current", millId],
    queryFn: async (): Promise<MillOreData> => {
      const response = await apiClient.get<MillOreData>(`/mills/ore-by-mill`, {
        params: { mill: millId },
        timeout: 30000,
      });
      return response.data;
    },
    enabled: !!millId, // Don't fetch if millId is empty
    staleTime: 0,
    refetchInterval: 30 * 1000,
  });

  // Fetch trend data - only when millId is provided
  const trendData = useMillOreTrend(millId, timeRange, !!millId);

  const isLoading = currentRate.isLoading || trendData.isLoading;
  const isError = currentRate.isError && trendData.isError;

  // Process data
  const processedData = (() => {
    if (isLoading || !trendData.data) return null;

    const events = detectDowntimeEvents(millId, trendData.data, config);
    const metrics = calculateMillMetrics(
      millId,
      events,
      totalMinutes,
      currentRate.data?.ore || 0,
      currentRate.data?.state || false
    );
    const feedRateData = getMillFeedRateData(millId, trendData.data);

    return {
      events,
      metrics,
      feedRateData,
    };
  })();

  return {
    events: processedData?.events || [],
    metrics: processedData?.metrics || null,
    feedRateData: processedData?.feedRateData || [],
    currentOreRate: currentRate.data?.ore || 0,
    isRunning: currentRate.data?.state || false,
    isLoading,
    isError,
    refetch: () => {
      currentRate.refetch();
      trendData.refetch();
    },
  };
}

// Re-export helper functions for use in components
export { getRecentEvents, getMillFeedRateData };

// Re-export TIME_RANGE_OPTIONS
export { TIME_RANGE_OPTIONS };
