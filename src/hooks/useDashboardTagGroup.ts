'use client';

import { useMemo } from 'react';
import { dashboardTags } from '@/lib/tags/dashboard-tags';
import { TagDefinition } from '@/lib/tags/types';
import { useDashboardTags } from './useDashboardTags';

/**
 * Hook to fetch all tags for a specific group
 */
export function useDashboardTagGroup(groupName: string, options = {}) {
  // Handle empty group name case
  const isValidGroup = groupName && groupName.trim() !== '';
  
  // Get all tag definitions for this group
  const groupTags = useMemo(() => {
    if (!isValidGroup) return [];
    
    // Get all tags in this group
    const allGroupTags = dashboardTags.filter(tag => tag.group === groupName);
    
    // Filter out boolean tags which are just for state control
    // Only keep analog tags (those that aren't just boolean tags)
    return allGroupTags.filter(tag => tag.unit !== 'bool');
  }, [groupName, isValidGroup]);
  
  // Get tag names for this group
  const tagNames = useMemo(() => {
    return groupTags.map(tag => tag.name);
  }, [groupTags]);
  
  // Use the useDashboardTags hook to get values for all tags in the group
  const { 
    data: tagValues, 
    loading, 
    error,
    queries,
    refetch
  } = useDashboardTags(tagNames, options);
  
  // Combine the tag definitions with their values
  const tagsWithValues = useMemo(() => {
    if (!tagValues || !isValidGroup) return [];
    
    return groupTags.map(tag => ({
      definition: tag,
      value: tagValues[tag.name] || null
    }));
  }, [groupTags, tagValues, isValidGroup]);
  
  return {
    tags: tagsWithValues,
    loading: isValidGroup && loading,
    error,
    groupName,
    queries,
    refetch
  };
}
