"use client";

import { useQuery } from "@tanstack/react-query";
import { vhsTagByName } from "@/lib/tags/vhs-tags";
import type { TagValue } from "@/lib/tags/types";

/**
 * Fetch multiple VHS tag values in a single API call.
 * Uses the existing FastAPI `/api/tag-values` endpoint (LoggerTagId based).
 */
async function fetchVhsValues(
  tagNames: string[],
): Promise<Record<string, TagValue>> {
  const tagMap: Record<number, string> = {};
  const tagIds: number[] = [];

  tagNames.forEach((name) => {
    const tag = vhsTagByName[name];
    if (tag) {
      tagIds.push(tag.id);
      tagMap[tag.id] = name;
    }
  });

  if (tagIds.length === 0) {
    return {};
  }

  try {
    const queryParams = tagIds.map((id) => `tag_ids=${id}`).join("&");

    const response = await fetch(`/api/tag-values?${queryParams}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const responseData = await response.json();
    const result: Record<string, TagValue> = {};

    const root = responseData?.root ?? responseData;
    if (root && typeof root === "object") {
      Object.entries(root).forEach(([tagId, value]) => {
        const tagName = tagMap[Number(tagId)];
        if (tagName && value) {
          const tagValue = value as {
            value: number | boolean | null;
            timestamp: string;
          };
          result[tagName] = {
            value: tagValue.value,
            timestamp: tagValue.timestamp,
            active: true,
          };
        }
      });
    }

    return result;
  } catch (error) {
    console.error("Error fetching VHS tag values:", error);
    return {};
  }
}

/**
 * Hook for fetching current values of VHS tags.
 * Refreshes every 30 seconds by default.
 */
export function useVhsValues(
  tagNames: string[],
  options: { refetchInterval?: number | false } = {},
) {
  const validTagNames = tagNames.filter((name) => vhsTagByName[name]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vhsValues", validTagNames],
    queryFn: () => fetchVhsValues(validTagNames),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    ...options,
  });

  return {
    data: data || {},
    loading: isLoading,
    error,
    refetch,
  };
}
