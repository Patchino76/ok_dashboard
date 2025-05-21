/**
 * Common trend visualization utilities
 */
import { TagTrendPoint } from "@/lib/tags/types";

/**
 * Apply a moving average smoothing to data points
 */
export function smoothData(data: any[], windowSize: number = 3) {
  if (!data || data.length < windowSize) return data;
  
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    
    // Calculate average of points in the window
    for (let j = Math.max(0, i - Math.floor(windowSize/2)); 
         j <= Math.min(data.length - 1, i + Math.floor(windowSize/2)); 
         j++) {
      if (data[j].value !== undefined && !isNaN(data[j].value)) {
        sum += data[j].value;
        count++;
      }
    }
    
    // Create a new point with the smoothed value
    result.push({
      ...data[i],
      value: count > 0 ? sum / count : data[i].value
    });
  }
  
  return result;
}

/**
 * Format trend data for chart display
 */
export function formatTrendData(trendPoints: TagTrendPoint[], applySmoothing: boolean = false) {
  if (!trendPoints || !Array.isArray(trendPoints) || trendPoints.length === 0) {
    return [];
  }
  
  // Sort points by timestamp to ensure proper display
  const sortedPoints = [...trendPoints].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  // Map the points to the format needed for the chart
  const formattedData = sortedPoints.map((point) => ({
    timestamp: point.timestamp,
    value: typeof point.value === 'number' ? point.value : null,
    x: new Date(point.timestamp).getTime()
  }));
  
  // Apply smoothing if requested
  return applySmoothing ? smoothData(formattedData) : formattedData;
}

/**
 * Calculate appropriate min and max values for Y-axis based on data
 */
export function calculateAxisBounds(data: number[]) {
  if (!data || data.length === 0) return [0, 100];
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  
  // Round values to be divisible by 20
  const minValue = Math.floor(min / 20) * 20;
  const maxValue = Math.ceil(max / 20) * 20;
  
  return [minValue, maxValue];
}
