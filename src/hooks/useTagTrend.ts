'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardTags } from '@/lib/tags/dashboard-tags';
import { TagTrendPoint } from '@/lib/tags/types';
import { fetchTagTrend } from '@/lib/api/api-client';

/**
 * Fetches trend data for a specific tag
 */
async function fetchTrendData(tagName: string, hours: number = 8): Promise<TagTrendPoint[]> {
  // Find tag to get its ID
  const tag = dashboardTags.find(tag => tag.name === tagName);
  
  if (!tag) {
    throw new Error(`Tag with name ${tagName} not found`);
  }
  
  try {
    // Call the API to get trend data
    const response = await fetchTagTrend(tag.id, hours);
    
    // Map API response to our TagTrendPoint interface
    if (response.timestamps && response.values) {
      return response.timestamps.map((timestamp: string, index: number) => ({
        timestamp,
        value: response.values[index]
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching trend for tag ${tagName}:`, error);
    return [];
  }
}

/**
 * Hook for fetching trend data for a specific tag
 */
export function useTagTrend(tagName: string, hours: number = 8, options = {}) {
  // Make sure the tag exists
  const tag = dashboardTags.find(tag => tag.name === tagName);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tagTrend', tagName, hours],
    queryFn: () => fetchTrendData(tagName, hours),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!tag, // Only run query if tag exists
    ...options,
  });
  
  return {
    data: data || [],
    loading: isLoading,
    error,
    unit: tag?.unit,
    refetch
  };
}
