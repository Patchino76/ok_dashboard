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
  // Sort tags by value for better visualization
  const sortedTags = [...tags].sort((a, b) => {
    const valueA = a.value?.value !== undefined ? Number(a.value.value) : 0;
    const valueB = b.value?.value !== undefined ? Number(b.value.value) : 0;
    return valueB - valueA;
  });

  // Find the maximum value for scaling
  const maxValue = Math.max(
    ...sortedTags.map(tag => tag.value?.value !== undefined ? Number(tag.value.value) : 0),
    ...sortedTags.map(tag => tag.definition.maxValue !== undefined ? Number(tag.definition.maxValue) : 0)
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
        {sortedTags.map(({ definition, value }) => {
          const currentValue = value?.value !== undefined ? Number(value.value) : 0;
          const percentage = maxValue ? (currentValue / maxValue) * 100 : 0;
          const formattedValue = formatValue(currentValue, definition.precision);
          const maxValueFormatted = formatValue(
            definition.maxValue !== undefined ? Number(definition.maxValue) : 0,
            definition.precision
          );
          
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
              
              <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "absolute top-0 left-0 h-full rounded-full",
                    getBarColor(percentage)
                  )}
                  style={{ width: `${percentage}%` }}
                />
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-end px-2">
                  <span className="text-xs font-medium text-gray-600">
                    {maxValueFormatted} {definition.unit}
                  </span>
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

// Helper function to get the appropriate bar color based on percentage
function getBarColor(percentage: number): string {
  if (percentage > 80) return "bg-red-500";
  if (percentage > 60) return "bg-amber-500";
  return "bg-green-500";
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
