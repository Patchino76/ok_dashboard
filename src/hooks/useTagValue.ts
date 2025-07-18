'use client';

import { useQuery, UseQueryOptions } from '@tanstack/react-query';

// Using Next.js API routes with relative URLs

/**
 * Fetch current value of a tag by its ID
 */
export async function fetchTagValue(tagId: number) {
  // Get API URL from environment or use default
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  const response = await fetch(`${apiUrl}/api/tag-value/${tagId}`, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  });
  
  try {
    const data = await response.json();
    
    // If we got valid data despite status code, use it
    if (data && typeof data.value !== 'undefined') {
      return data;
    }
    
    // If no valid data and not OK status, throw error
    if (!response.ok) {
      throw new Error(`Failed to fetch value for tag ${tagId}: ${response.statusText}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error parsing value data for tag ${tagId}:`, error);
    // Return null value on error
    return { value: null, timestamp: Date.now() };
  }
}

/**
 * Hook to fetch the current value of a tag
 */
export function useTagValue(tagId?: number, options: UseQueryOptions<any, Error> = {}) {
  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: ['tag-value', tagId],
    queryFn: () => tagId ? fetchTagValue(tagId) : null,
    enabled: !!tagId,
    staleTime: 10000, // Consider data fresh for 10 seconds
    ...options
  });

  if (isLoading) {
    return { isLoading: true, data: null, error: null };
  }

  if (isError) {
    return { isLoading: false, data: null, error };
  }

  return { isLoading: false, data, error: null, refetch };
}