'use client';

import { useQueries, useQueryClient } from '@tanstack/react-query';
import { dashboardTags } from '@/lib/tags/dashboard-tags';
import { TagValue } from '@/lib/tags/types';

// API Base URL - could be moved to a .env file
const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Fetches a tag value directly from the API by its name
 */
async function fetchTagValue(tagName: string): Promise<TagValue> {
  // Find tag to get its ID
  const tag = dashboardTags.find(tag => tag.name === tagName);
  
  if (!tag) {
    throw new Error(`Tag with name ${tagName} not found`);
  }
  
  try {
    // Call the API directly with the tag ID
    const response = await fetch(`${API_BASE_URL}/tag-value/${tag.id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tag ${tag.id}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle numeric boolean values (0/1 → false/true)
    const value = tag.unit === 'bool' && typeof data.value === 'number'
      ? Boolean(data.value)
      : data.value;
    
    return {
      value,
      timestamp: data.timestamp,
      active: true // Default to active, will be updated based on state tags later
    };
  } catch (error) {
    console.error(`Error fetching tag ${tagName} (ID ${tag.id}):`, error);
    
    // Return null value on error
    return {
      value: null,
      timestamp: new Date().toISOString(),
      active: false
    };
  }
}

/**
 * Hook to fetch multiple dashboard tag values by names
 */
export function useDashboardTags(tagNames: string[], options = {}) {
  // Include necessary state tags automatically
  const tagsToFetch = new Set(tagNames);
  
  // Add required state tags
  dashboardTags
    .filter(tag => tagNames.includes(tag.name) && tag.state?.length)
    .forEach(tag => tag.state?.forEach(stateTag => tagsToFetch.add(stateTag)));
  
  // Create queries for all tags (including state dependencies)
  const queries = useQueries({
    queries: Array.from(tagsToFetch).map(tagName => ({
      queryKey: ['dashboardTag', tagName],
      queryFn: () => fetchTagValue(tagName),
      staleTime: 60 * 1000, // 1 minute
      ...options,
    })),
  });
  
  // Process results
  const loading = queries.some(query => query.isLoading);
  const error = queries.find(query => query.error)?.error;
  
  // Build the data object with all tag values
  const data = Array.from(tagsToFetch).reduce((acc, tagName, index) => {
    acc[tagName] = queries[index].data;
    return acc;
  }, {} as Record<string, TagValue | undefined>);
  
  // Process state relationships - simple and clean
  dashboardTags.forEach(tag => {
    const tagValue = data[tag.name];
    if (tagValue && tag.state?.length) {
      // Tag is active if all its state tags are true
      tagValue.active = tag.state.every(stateTag => {
        return Boolean(data[stateTag]?.value);
      });
    }
  });
  
  // Function to refetch all data
  const refetch = () => queries.forEach(query => query.refetch());
  
  return { data, loading, error, refetch };
}
