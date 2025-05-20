'use client';

import React from 'react';
import { TagDefinition, TagValue } from '@/lib/tags/types';
import { cn } from '@/lib/utils';
import { renderTagIcon } from '@/lib/utils/kpi/iconUtils';
import { calculateDisplayValue, calculatePercentage, formatTagValue } from '@/lib/utils/kpi/valueCalculations';
import { getColorForIconType, getIconTypeTitle } from '@/lib/utils/kpi/visualUtils';

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
          // Get the raw value for display
          const rawValue = value?.value !== undefined ? Number(value.value) : 0;
          
          // Calculate display value (handles inverse logic internally)
          const displayValue = calculateDisplayValue(value, definition);
          
          // Format values for display
          const formattedValue = formatTagValue(rawValue, definition);
          const maxVal = definition.maxValue !== undefined ? Number(definition.maxValue) : 0;
          const maxValueFormatted = formatTagValue(maxVal, definition);
          
          // Calculate percentage with our utility
          const percentage = calculatePercentage(value, definition);
          
          // Get color using our utility
          const barColor = getColorForIconType(iconType, definition.inverse ? 100 - percentage : percentage);
          
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


