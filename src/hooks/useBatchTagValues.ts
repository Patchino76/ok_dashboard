/**
 * Hook for fetching multiple tag values efficiently in a single request
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardTags } from '@/lib/tags/dashboard-tags';
import { TagValue } from '@/lib/tags/types';

// Using Next.js API routes with relative URLs

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
    // Convert tag IDs to query parameters
    const queryParams = tagIds.map(id => `tag_ids=${id}`).join('&');
    
    // Get API URL from environment or use default
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${apiUrl}/api/tag-values?${queryParams}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    
    let responseData;
    try {
      responseData = await response.json();
      
      // Continue even if we got an error status but have data
      if (!responseData || !responseData.root) {
        if (!response.ok) {
          throw new Error(`Failed to fetch tags: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error parsing batch tag values:', error);
      return {}; // Return empty object on parsing error
    }
    
    // Map the response data back to tag names
    const result: Record<string, TagValue> = {};
    
    if (responseData && responseData.root) {
      Object.entries(responseData.root).forEach(([tagId, value]) => {
        const tagName = tagMap[Number(tagId)];
        if (tagName && value) {
          // We need to cast value to the appropriate type
          const tagValue = value as any; // Using any here for simplicity
          
          result[tagName] = {
            value: tagValue.value,
            timestamp: tagValue.timestamp,
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
