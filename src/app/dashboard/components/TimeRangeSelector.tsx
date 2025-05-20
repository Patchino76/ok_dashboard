'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type TimeRange = '8h' | '1d' | '3d';

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

export function TimeRangeSelector({ 
  selectedRange, 
  onChange,
  className 
}: TimeRangeSelectorProps) {
  const timeRanges: TimeRange[] = ['8h', '1d', '3d'];
  
  const getLabel = (range: TimeRange): string => {
    switch (range) {
      case '8h': return '8 часа';
      case '1d': return '1 ден';
      case '3d': return '3 дни';
      default: return range;
    }
  };

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {timeRanges.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            selectedRange === range
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          )}
        >
          {getLabel(range)}
        </button>
      ))}
    </div>
  );
}
