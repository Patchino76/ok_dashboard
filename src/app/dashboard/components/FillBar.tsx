import React from 'react';

type FillBarProps = {
  currentValue: number;
  maxValue: number;
  height?: number;
  className?: string;
  barColor?: string;
  backgroundColor?: string;
  showValues?: boolean; // Whether to show min/max values as text
  unit?: string; // Unit to display with max value
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
  barColor = '#3b82f6', // Default blue color
  backgroundColor = '#e5e7eb', // Default gray background
  showValues = true, // Show min/max values by default
  unit = '', // Unit to display with max value
}: FillBarProps) => {
  // Ensure we have valid values to work with
  if (!currentValue || !maxValue || maxValue <= 0) {
    return null;
  }

  // Calculate the fill percentage (capped at 100%)
  const fillPercentage = Math.min(100, Math.max(0, (currentValue / maxValue) * 100));
  
  return (
    <div className={`flex flex-col w-full ${className}`}>
      {/* Bar with fill */}
      <div 
        className={`w-full rounded-full overflow-hidden ${showValues ? 'mb-1' : ''}`}
        style={{ height: `${height}px`, backgroundColor }}
      >
        <div 
          className="h-full transition-all duration-300 ease-in-out"
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
