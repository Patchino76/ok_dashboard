"use client";

import { useQuery } from "@tanstack/react-query";
import { vhsTagByName } from "@/lib/tags/vhs-tags";
import type { TagTrendPoint } from "@/lib/tags/types";

/**
 * Fetch trend data for a VHS tag by name.
 * Uses the existing FastAPI `/api/tag-trend/{id}` endpoint (LoggerTagId based).
 */
async function fetchVhsTrend(
  tagName: string,
  hours: number,
): Promise<TagTrendPoint[]> {
  const tag = vhsTagByName[tagName];
  if (!tag) {
    return [];
  }

  try {
    const response = await fetch(`/api/tag-trend/${tag.id}?hours=${hours}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await response.json();

    if (data && data.timestamps && data.values) {
      return data.timestamps.map((timestamp: string, index: number) => ({
        timestamp,
        value: data.values[index],
      }));
    }

    return [];
  } catch (error) {
    console.error(`Error fetching VHS trend for ${tagName}:`, error);
    return [];
  }
}

/**
 * Hook for fetching trend data for a VHS tag.
 */
export function useVhsTrend(tagName: string | undefined, hours: number = 8) {
  const tag = tagName ? vhsTagByName[tagName] : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["vhsTrend", tagName, hours],
    queryFn: () => fetchVhsTrend(tagName as string, hours),
    staleTime: 5 * 60 * 1000,
    enabled: !!tag,
  });

  return {
    data: data || [],
    loading: isLoading,
    error,
    unit: tag?.unit,
  };
}
