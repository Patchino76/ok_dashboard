import React from 'react';

type FillBarProps = {
  currentValue: number;
  maxValue: number;
  height?: number;
  className?: string;
  barColor?: string;
  barColorClass?: string; // Tailwind class for bar color
  backgroundColor?: string;
  backgroundColorClass?: string; // Tailwind class for background color
  showValues?: boolean; // Whether to show min/max values as text
  unit?: string; // Unit to display with max value
  inverse?: boolean; // Whether to invert the fill (for cases where lower is better)
}

/**
 * A horizontal fill bar that visualizes a current value relative to a maximum value
 * with optional min (0) and max value labels
 */
export const FillBar = ({
  currentValue,
  maxValue,
  height = 4,
  className = '',
  barColor,
  barColorClass = 'bg-blue-500', // Default blue Tailwind class
  backgroundColor,
  backgroundColorClass = 'bg-gray-200', // Default gray Tailwind class
  showValues = true, // Show min/max values by default
  unit = '', // Unit to display with max value
  inverse = false, // Default to normal fill direction (higher is better)
}: FillBarProps) => {
  // Ensure we have valid values to work with
  if (!currentValue || !maxValue || maxValue <= 0) {
    return null;
  }

  // Calculate the fill percentage (capped at 100%)
  // The calculation happens in a utility function for consistency
  const fillPercentage = Math.min(100, Math.max(0, (inverse ? maxValue - currentValue : currentValue) / maxValue * 100));
  
  return (
    <div className={`flex flex-col w-full ${className}`}>
      {/* Bar with fill */}
      <div 
        className={`w-full rounded-full overflow-hidden ${showValues ? 'mb-1' : ''} ${backgroundColorClass}`}
        style={{ height: `${height}px`, backgroundColor }}
      >
        <div 
          className={`h-full transition-all duration-300 ease-in-out ${barColorClass}`}
          style={{ 
            width: `${fillPercentage}%`, 
            backgroundColor: barColor 
          }}
        />
      </div>
      
      {/* Min/Max value labels */}
      {showValues && (
        <div className="flex justify-between w-full text-xs text-gray-500">
          <span>0</span>
          <span>{maxValue}{unit ? ` ${unit}` : ''}</span>
        </div>
      )}  
    </div>
  );
};
