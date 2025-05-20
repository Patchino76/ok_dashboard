import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface MillInfoProps {
  title: string;
  state: boolean;
  shift1?: number;
  shift2?: number;
  shift3?: number;
  total?: number;
  ore: number;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
}

export interface MillsByParameter {
  mill: string;
  value: number;
}

/**
 * Hook to fetch information for a specific mill
 */
export function useMills(mill: string, refreshInterval: number = 20) {
  return useQuery<MillInfoProps>({
    queryKey: ["ore-by-mill-totals", mill],
    queryFn: async () => {
      const response = await axios.get<MillInfoProps>(
        `/api/mills/ore-by-mill`,
        {
          params: { mill },
        }
      );
      return response.data;
    },
    staleTime: 0,
    refetchInterval: refreshInterval * 1000,
    networkMode: "always",
  });
}

/**
 * Hook to fetch trend data for a specific mill and tag
 */
export function useMillsTrendByTag(
  mill: string,
  tag: string,
  trendPoints: number = 500,
  refreshInterval: number = 20
) {
  return useQuery<TrendDataPoint[]>({
    queryKey: ["mills-trend-by-tag", mill, tag, trendPoints],
    queryFn: async () => {
      const response = await axios.get<TrendDataPoint[]>(
        `/api/mills/trend-by-tag`,
        {
          params: { mill, tag, trendPoints },
        }
      );
      return response.data;
    },
    staleTime: 0,
    refetchInterval: refreshInterval * 1000,
    networkMode: "always",
    retry: 2,
  });
}

/**
 * Hook to fetch mills data by parameter (e.g., 'ore', 'total')
 */
export function useMillsByParameter(
  parameter: string,
  date: string,
  refreshInterval: number = 20
) {
  return useQuery<MillsByParameter[]>({
    queryKey: ["mills-by-parameter", parameter, date],
    queryFn: async () => {
      const response = await axios.get<MillsByParameter[]>(
        `/api/mills/by-parameter`,
        {
          params: {
            parameter,
            date
          }
        }
      );
      return response.data;
    },
    staleTime: 0,
    refetchInterval: refreshInterval * 1000,
    networkMode: "always",
    retry: 2,
  });
}
