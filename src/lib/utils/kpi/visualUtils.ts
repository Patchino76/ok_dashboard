import { TagDefinition } from '@/lib/tags/types';

/**
 * Gets the appropriate color for a bar visualization based on tag type and percentage
 * @param iconType The icon type from tag definition 
 * @param percentage The fill percentage
 * @returns Hex color code
 */
export function getColorForIconType(iconType: string, percentage: number): string {
  // Base colors by icon type
  const baseColors: Record<string, string> = {
    'level': '#3b82f6', // blue for levels
    'conveyer': '#10b981', // emerald for conveyers
    'crusher': '#f59e0b', // amber for crushers
    'weight': '#6366f1', // indigo for weight
    'power': '#ef4444', // red for power
    'factory': '#8b5cf6', // violet for factory
    'time': '#64748b', // slate for time
  };
  
  // Get color based on icon type, with fallback
  return baseColors[iconType] || '#6b7280'; // gray as fallback
}

/**
 * Returns a human-readable title for the icon type
 * @param iconType The icon type string from tag definition
 * @returns User-friendly title
 */
export function getIconTypeTitle(iconType: string): string {
  switch (iconType) {
    case 'conveyer':
      return 'Материален поток';
    case 'crusher':
      return 'Мощност на трошачки';
    case 'level':
      return 'Ниво';
    case 'weight':
      return 'Тегло';
    case 'power':
      return 'Консумация на енергия';
    case 'factory':
      return 'Производство';
    case 'time':
      return 'Време';
    default:
      return iconType.charAt(0).toUpperCase() + iconType.slice(1);
  }
}

/**
 * Groups tags by their icon type for comparison view
 * @param tags Array of tag definitions and values
 * @returns Record with icon types as keys and arrays of tags as values
 */
export function groupTagsByIcon<T extends { definition: TagDefinition }>(
  tags: T[]
): Record<string, T[]> {
  return tags.reduce((acc, tag) => {
    const iconType = tag.definition.icon;
    if (!iconType) return acc;
    
    if (!acc[iconType]) {
      acc[iconType] = [];
    }
    
    acc[iconType].push(tag);
    return acc;
  }, {} as Record<string, T[]>);
}
