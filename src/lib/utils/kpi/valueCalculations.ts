import { TagDefinition, TagValue } from '@/lib/tags/types';

/**
 * Calculates the display value for a tag based on its properties
 * @param value The raw tag value
 * @param definition The tag definition with metadata
 * @returns The processed value for display purposes
 */
export function calculateDisplayValue(
  value: TagValue | null | undefined,
  definition: TagDefinition
): number {
  // Get raw value, defaulting to 0 if not available
  const rawValue = value?.value !== undefined ? Number(value.value) : 0;
  
  // Apply scale factor if present
  const scaledValue = definition.scale ? rawValue * definition.scale : rawValue;
  
  // For inverse tags (like bunker levels), return maxValue - value
  // This shows available space rather than how full it is
  if (definition.inverse && definition.maxValue !== undefined) {
    return Number(definition.maxValue) - scaledValue;
  }
  
  return scaledValue;
}

/**
 * Calculates the percentage of a value against its maximum
 * @param value The current value (can be raw or already processed)
 * @param definition The tag definition with metadata
 * @param useDisplayValue Whether to apply inverse logic before calculating percentage
 * @returns Percentage from 0-100
 */
export function calculatePercentage(
  value: TagValue | null | undefined, 
  definition: TagDefinition,
  useDisplayValue = true
): number {
  // Get the max value, defaulting to 0 if not defined
  const maxValue = definition.maxValue !== undefined ? Number(definition.maxValue) : 0;
  
  // If max value is zero, return zero to avoid division by zero
  if (maxValue === 0) return 0;
  
  // If we should use the display value (which already applies inverse logic)
  if (useDisplayValue) {
    const displayValue = calculateDisplayValue(value, definition);
    return Math.min(100, Math.max(0, (displayValue / maxValue) * 100));
  }
  
  // Otherwise calculate from raw value
  const rawValue = value?.value !== undefined ? Number(value.value) : 0;
  const scaledValue = definition.scale ? rawValue * definition.scale : rawValue;
  return Math.min(100, Math.max(0, (scaledValue / maxValue) * 100));
}

/**
 * Formats a value for display based on tag definition
 * @param value Numeric value to format
 * @param definition Tag definition containing formatting rules
 * @returns Formatted string value
 */
export function formatTagValue(
  value: number,
  definition: TagDefinition
): string {
  const precision = definition.precision !== undefined ? definition.precision : 0;
  return value.toFixed(precision);
}
