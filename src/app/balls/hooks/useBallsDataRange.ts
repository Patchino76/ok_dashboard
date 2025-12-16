"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/api-client";
import type { BallsDataRow } from "./useBallsData";

export function useBallsDataRange(startDate: string, endDate: string) {
  return useQuery<BallsDataRow[]>({
    queryKey: ["balls-data-range", startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<BallsDataRow[]>("/balls_data", {
        params: { start_date: startDate, end_date: endDate },
      });
      return response.data;
    },
    enabled: Boolean(startDate) && Boolean(endDate),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
