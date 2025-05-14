import React from 'react';
import { TagTrendPoint } from '@/lib/tags/types';
import { filterValidPoints } from '../utils/trendCalculation';

type SparklineProps = {
  data: TagTrendPoint[]
  color: string
  className?: string
  height?: number
  width?: number
  showRegressionLine?: boolean
  regressionLineData?: TagTrendPoint[]
  regressionLineColor?: string
}

/**
 * A simple sparkline component that visualizes trend data
 */
export const Sparkline = ({ 
  data, 
  color, 
  className = '', 
  height = 20, 
  width = 80,
  showRegressionLine = false,
  regressionLineData,
  regressionLineColor = 'rgba(255, 255, 255, 0.5)'
}: SparklineProps) => {
  // Filter out null values and zeros
  const validPoints = filterValidPoints(data);
  
  if (validPoints.length < 2) return null;
  
  // Calculate min and max for scaling
  const values = validPoints.map(p => p.value as number);
  let min = Math.min(...values);
  let max = Math.max(...values);
  
  // If regression line is shown, include its values in min/max calculation
  if (showRegressionLine && regressionLineData && regressionLineData.length > 0) {
    const regressionValues = regressionLineData.map(p => p.value as number);
    min = Math.min(min, ...regressionValues);
    max = Math.max(max, ...regressionValues);
  }
  
  // If min and max are the same, we can't draw a meaningful line
  if (min === max) return null;
  
  // Calculate points for the data polyline
  const points = validPoints.map((point, i) => {
    // X coordinate scales with the index
    const x = (i / (validPoints.length - 1)) * width;
    // Y coordinate scales with the value
    const y = height - ((point.value as number - min) / (max - min)) * height;
    return `${x},${y}`;
  }).join(' ');
  
  // Calculate points for the regression line if needed
  let regressionPoints = '';
  if (showRegressionLine && regressionLineData && regressionLineData.length > 1) {
    regressionPoints = regressionLineData.map((point, i) => {
      const x = (i / (regressionLineData.length - 1)) * width;
      const y = height - ((point.value as number - min) / (max - min)) * height;
      return `${x},${y}`;
    }).join(' ');
  }
  
  return (
    <svg width={width} height={height} className={className}>
      {/* Draw regression line first so it's behind the data line */}
      {showRegressionLine && regressionPoints && (
        <polyline
          fill="none"
          stroke={regressionLineColor}
          strokeWidth="1"
          strokeDasharray="2,2"
          points={regressionPoints}
        />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
};
