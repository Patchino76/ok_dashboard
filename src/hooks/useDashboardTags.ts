'use client';

import { useQueries, useQueryClient } from '@tanstack/react-query';
import { dashboardTags } from '@/lib/tags/dashboard-tags';
import { TagValue } from '@/lib/tags/types';

import { fetchTagById } from '@/lib/api/api-client';

/**
 * Fetches a tag value from the API by its name
 */
async function fetchTagValue(tagName: string): Promise<TagValue> {
  // Find tag to get its ID
  const tag = dashboardTags.find(tag => tag.name === tagName);
  
  if (!tag) {
    throw new Error(`Tag with name ${tagName} not found`);
  }
  
  try {
    // Call the API with the tag ID
    const response = await fetchTagById(tag.id);
    
    // Map API response to our TagValue interface
    return {
      value: response.value,
      timestamp: response.timestamp,
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
  
  // Process state relationships
  // For each tag, check if it depends on any state tags and update its active status
  dashboardTags.forEach(tag => {
    const tagValue = data[tag.name];
    
    if (tagValue && tag.state && tag.state.length > 0) {
      // This tag depends on state tags
      // Check if all required state tags are active (true)
      const isActive = tag.state.every(stateTagName => {
        const stateTagValue = data[stateTagName];
        return stateTagValue?.value === true; // State is active if boolean value is true
      });
      
      // Update the active status based on dependent state tags
      tagValue.active = isActive;
    }
  });
  
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
