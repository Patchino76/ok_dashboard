/**
 * API client for the OK Dashboard API
 */

export const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Fetch a single tag value by its ID
 */
export async function fetchTagById(tagId: number) {
  const response = await fetch(`${API_BASE_URL}/tag-value/${tagId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tag ${tagId}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch multiple tag values by their IDs
 */
export async function fetchTagsByIds(tagIds: number[]) {
  // Convert tag IDs to query parameters
  const queryParams = tagIds.map(id => `tag_ids=${id}`).join('&');
  const response = await fetch(`${API_BASE_URL}/tag-values?${queryParams}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tags: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch trend data for a tag by its ID
 */
export async function fetchTagTrend(tagId: number, hours: number = 8) {
  const response = await fetch(`${API_BASE_URL}/tag-trend/${tagId}?hours=${hours}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch trend for tag ${tagId}: ${response.statusText}`);
  }
  
  return response.json();
}
