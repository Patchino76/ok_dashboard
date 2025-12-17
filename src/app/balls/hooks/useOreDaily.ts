"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/api-client";

export type OreDailyRow = {
  date: string;
  mill: number;
  ore_t: number | null;
};

export function useOreDaily(startDate: string, endDate: string) {
  return useQuery<OreDailyRow[]>({
    queryKey: ["mills-ore-daily", startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<OreDailyRow[]>("/mills/ore-daily", {
        params: { start_date: startDate, end_date: endDate },
      });
      return response.data;
    },
    enabled: Boolean(startDate) && Boolean(endDate),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
