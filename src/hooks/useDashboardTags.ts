'use client';

import { useQueries, useQueryClient } from '@tanstack/react-query';
import { dashboardTags } from '@/lib/tags/dashboard-tags';
import { TagValue } from '@/lib/tags/types';

/**
 * Simulates fetching a tag value - in a real app this would call an API
 */
async function fetchTagValue(tagName: string): Promise<TagValue> {
  // For demo purposes, return random values
  const getRandomValue = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  };
  
  // Find tag to determine appropriate value range
  const tag = dashboardTags.find(tag => tag.name === tagName);
  
  if (!tag) {
    throw new Error(`Tag with name ${tagName} not found`);
  }
  
  // Generate appropriate dummy value based on unit
  let value: number | boolean | null = null;
  
  if (tag.unit === '%') {
    value = getRandomValue(60, 95); // Percent values
  } else if (tag.unit === 'min') {
    value = getRandomValue(2, 30); // Minutes
  } else if (tag.unit === 'count') {
    value = getRandomValue(5, 50); // Count values
  } else if (tag.unit === 'score') {
    value = getRandomValue(3, 10); // Score values
  } else if (tag.unit === 'bool') {
    value = Math.random() > 0.5; // Boolean values
  } else {
    value = getRandomValue(50, 100); // Default range
  }
  
  return {
    value,
    timestamp: new Date().toISOString(),
    active: true
  };
}

/**
 * Hook to fetch multiple dashboard tag values by names
 */
export function useDashboardTags(tagNames: string[], options = {}) {
  const queryClient = useQueryClient();
  
  // Filter out any invalid tag names
  const validTagNames = tagNames.filter(name => {
    const isValid = dashboardTags.some(tag => tag.name === name);
    if (!isValid) {
      console.warn(`Tag with name ${name} not found`);
    }
    return isValid;
  });
  
  // Create queries for each tag
  const queries = useQueries({
    queries: validTagNames.map(tagName => ({
      queryKey: ['dashboardTag', tagName],
      queryFn: () => fetchTagValue(tagName),
      staleTime: 60 * 1000, // 1 minute
      ...options,
    })),
  });
  
  // Process results
  const loading = queries.some(query => query.isLoading);
  const error = queries.find(query => query.error)?.error;
  
  // Map tag values by name
  const data = validTagNames.reduce((acc, tagName, index) => {
    const query = queries[index];
    acc[tagName] = query.data;
    return acc;
  }, {} as Record<string, TagValue | undefined>);
  
  // Function to refetch all queries
  const refetch = () => {
    queries.forEach(query => query.refetch());
  };
  
  return {
    data,
    loading,
    error,
    queries,
    refetch
  };
}
