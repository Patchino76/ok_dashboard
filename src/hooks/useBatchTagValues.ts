/**
 * Hook for fetching multiple tag values efficiently in a single request
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardTags } from '@/lib/tags/dashboard-tags';
import { TagValue } from '@/lib/tags/types';
import { fetchTagsByIds } from '@/lib/api/api-client';

/**
 * Fetch multiple tag values in a single API call
 */
async function fetchTagValues(tagNames: string[]): Promise<Record<string, TagValue>> {
  // Map tag names to IDs
  const tagMap: Record<number, string> = {};
  const tagIds: number[] = [];
  
  // Create a mapping of tag IDs to tag names for later
  tagNames.forEach(name => {
    const tag = dashboardTags.find(t => t.name === name);
    if (tag) {
      tagIds.push(tag.id);
      tagMap[tag.id] = name;
    }
  });
  
  if (tagIds.length === 0) {
    return {};
  }
  
  try {
    // Fetch all tag values in a single request
    const response = await fetchTagsByIds(tagIds);
    
    // Map the response data back to tag names
    const result: Record<string, TagValue> = {};
    
    if (response && response.data) {
      Object.entries(response.data).forEach(([tagId, value]) => {
        const tagName = tagMap[Number(tagId)];
        if (tagName) {
          result[tagName] = {
            value: value as number | boolean | null,
            timestamp: response.timestamp,
            active: true
          };
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching batch tag values:', error);
    return {};
  }
}

export function useBatchTagValues(tagNames: string[], options = {}) {
  const validTagNames = tagNames.filter(name => 
    dashboardTags.some(tag => tag.name === name)
  );
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['batchTags', validTagNames],
    queryFn: () => fetchTagValues(validTagNames),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
  
  // Process state relationships (same as in useDashboardTags)
  const processedData = { ...data };
  
  if (processedData) {
    // Update active status based on state tags
    dashboardTags.forEach(tag => {
      const tagValue = processedData[tag.name];
      
      if (tagValue && tag.state && tag.state.length > 0) {
        // Check if all required state tags are active
        const isActive = tag.state.every(stateTagName => {
          const stateTagValue = processedData[stateTagName];
          return stateTagValue?.value === true;
        });
        
        // Update active status
        tagValue.active = isActive;
      }
    });
  }
  
  return {
    data: processedData || {},
    loading: isLoading,
    error,
    refetch
  };
}
