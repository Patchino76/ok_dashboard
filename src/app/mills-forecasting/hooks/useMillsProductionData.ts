import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/api-client";
import type { MillInfoProps } from "@/lib/hooks/useMills";
import { millsNames } from "@/lib/tags/mills-tags";

/**
 * Aggregated production data for all mills
 */
export interface MillsProductionData {
  mills: MillInfoProps[];
  totalOreRate: number;
  activeMillsCount: number;
  shiftProduction: {
    shift1: number;
    shift2: number;
    shift3: number;
    current: number;
  };
  dayProduction: number;
  timestamp: Date;
}

/**
 * Calculate total ore rate from all active mills
 */
const calculateTotalOreRate = (mills: MillInfoProps[]): number => {
  return mills
    .filter((mill) => mill.state) // Only active mills
    .reduce((total, mill) => total + (mill.ore || 0), 0);
};

/**
 * Calculate shift production totals
 */
const calculateShiftProduction = (mills: MillInfoProps[]) => {
  const shift1 = mills.reduce((total, mill) => total + (mill.shift1 || 0), 0);
  const shift2 = mills.reduce((total, mill) => total + (mill.shift2 || 0), 0);
  const shift3 = mills.reduce((total, mill) => total + (mill.shift3 || 0), 0);

  // Determine current shift based on time
  const hour = new Date().getHours();
  let current = shift1;
  if (hour >= 14 && hour < 22) current = shift2;
  else if (hour >= 22 || hour < 6) current = shift3;

  return { shift1, shift2, shift3, current };
};

/**
 * Calculate total day production
 */
const calculateDayProduction = (mills: MillInfoProps[]): number => {
  return mills.reduce((total, mill) => total + (mill.total || 0), 0);
};

/**
 * Hook to fetch current production data for all mills
 *
 * @param refreshInterval - Refresh interval in seconds (default: 20)
 * @returns Aggregated production data for all mills
 */
export function useMillsProductionData(refreshInterval: number = 20) {
  return useQuery<MillsProductionData>({
    queryKey: ["mills-production-all"],
    queryFn: async () => {
      // Get mill names from the same source as MillsPage (all 12 mills)
      const millsList = millsNames.map((mill) => mill.en);

      // Fetch data for all mills in parallel
      const promises = millsList.map((mill) =>
        apiClient
          .get<MillInfoProps>(`/mills/ore-by-mill`, {
            params: { mill },
          })
          .then((response) => response.data)
          .catch((error) => {
            console.warn(`Failed to fetch data for ${mill}:`, error);
            // Return default data for failed mill
            return {
              title: mill,
              state: false,
              ore: 0,
              shift1: 0,
              shift2: 0,
              shift3: 0,
              total: 0,
            } as MillInfoProps;
          })
      );

      const mills = await Promise.all(promises);

      // Aggregate data
      const totalOreRate = calculateTotalOreRate(mills);
      const activeMillsCount = mills.filter((mill) => mill.state).length;
      const shiftProduction = calculateShiftProduction(mills);
      const dayProduction = calculateDayProduction(mills);

      return {
        mills,
        totalOreRate,
        activeMillsCount,
        shiftProduction,
        dayProduction,
        timestamp: new Date(),
      };
    },
    staleTime: 0,
    refetchInterval: refreshInterval * 1000,
    networkMode: "always",
    retry: 2,
  });
}
