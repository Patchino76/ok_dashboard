import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/api-client";
import { useMemo } from "react";

export interface AnalyticsDataPoint {
  timestamp: string;
  [key: string]: any;
}

export interface AnalyticsResponse {
  data: AnalyticsDataPoint[];
}

export interface TrendData {
  mill_name: string;
  values: number[];
  timestamps: string[];
}

export interface TransformedAnalyticsData {
  comparisonData: {
    mill_name: string;
    parameter_value: number;
  }[];
  trendData: TrendData[];
}

export interface AnalyticsQueryParams {
  parameter: string;
  start_ts: string;
  end_ts?: string;
  freq?: string;
}

/**
 * Custom hook to fetch historical data for all mills by a specific parameter
 * 
 * @param params Query parameters for the analytics data
 * @param refreshInterval Time in seconds between automatic refetches
 * @returns React Query result with transformed analytics data
 */
export function useMillsAnalytics(
  params: AnalyticsQueryParams,
  refreshInterval: number | false = false
) {
  const { parameter, start_ts, end_ts, freq = '1h' } = params;
  
  const queryResult = useQuery<AnalyticsResponse>({
    queryKey: ["mills-analytics", parameter, start_ts, end_ts, freq],
    queryFn: async () => {
      const response = await apiClient.get<AnalyticsResponse>(
        `/api/mills/all_mills_by_param`,
        {
          params: {
            parameter,
            start_ts,
            end_ts,
            freq
          }
        }
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: refreshInterval ? refreshInterval * 1000 : false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    networkMode: "always",
    retry: 2,
  });
  
  // Transform data for components
  const transformedData = useMemo(() => {
    if (!queryResult.data?.data || !Array.isArray(queryResult.data.data)) {
      console.log('No data available for transformation');
      return { comparisonData: [], trendData: [] };
    }

    console.log('Raw API data structure:', queryResult.data);
    console.log('Data array length:', queryResult.data.data.length);
    console.log('First row sample:', queryResult.data.data[0]);

    // Extract mill names from the first row (excluding timestamp)
    const firstRow = queryResult.data.data[0];
    const millNames = Object.keys(firstRow).filter(key => key !== 'timestamp');
    console.log('Detected mill names:', millNames);

    // Get the latest row for comparison data
    const latestRow = queryResult.data.data[queryResult.data.data.length - 1];
    console.log('Latest row for comparison:', latestRow);

    // Create comparison data (latest values for each mill)
    const comparisonData = millNames.map(millName => ({
      mill_name: millName,
      parameter_value: latestRow[millName] || 0
    }));

    console.log('Transformed comparison data:', comparisonData);

    // Create trend data (all values over time for each mill)
    const trendData = millNames.map(millName => {
      const values: number[] = [];
      const timestamps: string[] = [];

      queryResult.data.data.forEach(row => {
        if (row[millName] !== null && row[millName] !== undefined) {
          values.push(row[millName]);
          timestamps.push(row.timestamp);
        }
      });

      return {
        mill_name: millName,
        values,
        timestamps
      };
    });

    console.log('Transformed trend data sample:', trendData[0]);
    console.log('Total trend data entries:', trendData.length);

    return { comparisonData, trendData };
  }, [queryResult.data]);
  
  return {
    data: transformedData,
    rawData: queryResult.data, // Add raw API response for components that need it
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    isError: queryResult.isError,
    refetch: queryResult.refetch,
  };
}

/**
 * Helper function to get time range based on selection
 * @param timeRange Time range selection (24h, 7d, 30d)
 * @returns Object with start_ts and end_ts in ISO format
 */
export function getTimeRangeParams(timeRange: string): { start_ts: string, end_ts: string } {
  // Round down to the nearest hour to stabilize the timestamps
  const now = new Date();
  now.setMinutes(0, 0, 0); // Reset minutes, seconds, and milliseconds to zero
  
  const startDate = new Date(now);
  
  switch (timeRange) {
    case "7d":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(now.getDate() - 30);
      break;
    default: // 24h
      startDate.setDate(now.getDate() - 1);
  }
  
  // Return stable timestamps
  return {
    start_ts: startDate.toISOString(),
    end_ts: now.toISOString()
  };
}
