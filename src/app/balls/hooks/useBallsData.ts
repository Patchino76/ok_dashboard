"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/api-client";

export type BallsDataRow = {
  MeasureDate: string;
  BallsName: string;
  MillName: number;
  Gross: number;
  Operator: string;
  IsDosmilane: boolean;
  Shift: number;
};

export function useBallsData(date: string) {
  return useQuery<BallsDataRow[]>({
    queryKey: ["balls-data", date],
    queryFn: async () => {
      const response = await apiClient.get<BallsDataRow[]>("/balls_data", {
        params: { date },
      });
      return response.data;
    },
    enabled: Boolean(date),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
