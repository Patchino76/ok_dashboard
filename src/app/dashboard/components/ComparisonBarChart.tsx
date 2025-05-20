'use client';

import React from 'react';
import { TagDefinition, TagValue } from '@/lib/tags/types';
import { cn } from '@/lib/utils';
import { renderTagIcon } from '@/app/dashboard/KpiCard';

interface ComparisonBarChartProps {
  tags: {
    definition: TagDefinition;
    value: TagValue | null | undefined;
  }[];
  iconType: string;
}

export function ComparisonBarChart({ tags, iconType }: ComparisonBarChartProps) {
  // Use tags in their original order without sorting
  const displayTags = [...tags];

  // Find the maximum value for scaling
  const maxValue = Math.max(
    ...displayTags.map(tag => tag.value?.value !== undefined ? Number(tag.value.value) : 0),
    ...displayTags.map(tag => tag.definition.maxValue !== undefined ? Number(tag.definition.maxValue) : 0)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-gray-500">
          {renderTagIcon(iconType)}
        </div>
        <h3 className="font-medium text-sm text-gray-700">
          {getIconTypeTitle(iconType)}
        </h3>
      </div>

      <div className="space-y-4">
        {displayTags.map(({ definition, value }) => {
          const currentValue = value?.value !== undefined ? Number(value.value) : 0;
          const percentage = maxValue ? (currentValue / maxValue) * 100 : 0;
          const formattedValue = formatValue(currentValue, definition.precision);
          const maxValueFormatted = formatValue(
            definition.maxValue !== undefined ? Number(definition.maxValue) : 0,
            definition.precision
          );
          
          // Get color based on icon type
          const barColor = getColorForIconType(iconType, percentage);
          
          return (
            <div key={definition.id} className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium text-gray-700 truncate max-w-[70%]">
                  {definition.desc}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-semibold text-gray-900">{formattedValue}</span>
                  <span className="text-xs text-gray-500">{definition.unit}</span>
                </div>
              </div>
              
              <div className="relative h-7 bg-gray-100 rounded-lg overflow-hidden shadow-inner">
                {/* Bar fill */}
                <div 
                  className="absolute top-0 left-0 h-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${percentage}%`,
                    background: `linear-gradient(90deg, ${barColor}80, ${barColor})`,
                  }}
                />
                
                {/* Current value indicator */}
                <div className="absolute top-0 left-0 h-full flex items-center">
                  <span 
                    className="ml-2 text-xs font-semibold text-white drop-shadow-sm"
                    style={{ display: percentage < 10 ? 'none' : 'block' }}
                  >
                    {formattedValue} {definition.unit}
                  </span>
                </div>
                
                {/* Max value indicator */}
                <div className="absolute top-0 right-0 h-full flex items-center pr-2">
                  <div className="flex items-center">
                    <span className="text-xs font-medium text-gray-600">
                      max: {maxValueFormatted}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper function to format values with proper precision
function formatValue(value: number, precision?: number): string {
  if (precision !== undefined) {
    return value.toFixed(precision);
  }
  return value.toString();
}

// Helper function to get the appropriate bar color based on icon type and percentage
function getColorForIconType(iconType: string, percentage: number): string {
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

// Helper function to get a human-readable title for the icon type
function getIconTypeTitle(iconType: string): string {
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
    default:
      return iconType.charAt(0).toUpperCase() + iconType.slice(1);
  }
}
