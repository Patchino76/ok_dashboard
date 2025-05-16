/**
 * Utility functions for trend visualization and chart scaling
 */
import { TagTrendPoint } from "@/lib/tags/types";

/**
 * Apply a moving average smoothing to data points
 */
export const smoothData = (data: any[], windowSize: number = 3) => {
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
};

/**
 * Format trend data for chart display
 */
export const formatTrendData = (trendPoints: any[], applySmoothing: boolean = false) => {
  if (!trendPoints || !Array.isArray(trendPoints) || trendPoints.length === 0) {
    return [];
  }
  
  // Sort points by timestamp to ensure proper display
  const sortedPoints = [...trendPoints].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  // Map the points to the format needed for the chart
  const formattedData = sortedPoints.map(point => {
    // Simple date formatting
    const date = new Date(point.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    // Ensure value is never negative
    const safeValue = typeof point.value === 'number' ? Math.max(0, point.value) : null;
    
    return {
      time: formattedTime,
      value: safeValue
    };
  });
  
  // Apply smoothing if requested
  return applySmoothing ? smoothData(formattedData, 3) : formattedData;
};

/**
 * Calculate appropriate min and max values for Y-axis scaling
 */
export const calculateAxisBounds = (validPoints: TagTrendPoint[], regressionLineData: TagTrendPoint[]) => {
  // Combine all data points (both actual data and regression line)
  const allPoints = [...validPoints, ...regressionLineData];
  
  // Extract all numeric values
  const values = allPoints
    .map(point => point.value)
    .filter((value): value is number => typeof value === 'number' && !isNaN(value));
  
  if (values.length === 0) return { minValue: 0, maxValue: 100 };
  
  // Calculate min and max
  let min = Math.min(...values);
  const max = Math.max(...values);
  
  // Never show negative values
  min = Math.max(0, min);
  
  // Calculate the data range
  const range = max - min;
  
  // Determine if we're dealing with very small values (< 0.1)
  const isVerySmallValue = max < 0.1;
  
  // Determine if we have small variations relative to the base value
  // For very small values, we use a different threshold
  const variationThreshold = isVerySmallValue ? 0.5 : 0.1; // 50% for very small values, 10% otherwise
  const isSmallVariation = min > 0 ? (range / min < variationThreshold) : true;
  
  // Adjust padding based on value size and variation
  let paddingPercentage;
  if (isVerySmallValue) {
    // For very small values like 0.038, use minimal padding
    paddingPercentage = 0.1; // 10% padding
  } else if (isSmallVariation) {
    // For normal values with small variations
    paddingPercentage = 0.05; // 5% padding
  } else {
    // For normal values with large variations
    paddingPercentage = 0.2; // 20% padding
  }
  
  const padding = range * paddingPercentage;
  
  // Calculate nice round numbers for min and max
  const niceMin = min === 0 ? 0 : roundToNiceNumber(min - padding, isVerySmallValue, isSmallVariation);
  const niceMax = roundToCeilingNiceNumber(max + padding, isVerySmallValue, isSmallVariation);
  
  return {
    minValue: niceMin,
    maxValue: niceMax,
    isVerySmallValue
  };
};

/**
 * Round a number down to a nice human-readable value
 */
const roundToNiceNumber = (value: number, isVerySmallValue: boolean, isSmallVariation: boolean): number => {
  // Special handling for very small values (< 0.1)
  if (isVerySmallValue) {
    // Determine the magnitude for very small values
    const decimalPlaces = Math.abs(Math.floor(Math.log10(value))) + 1;
    const factor = Math.pow(10, decimalPlaces);
    
    // Round to appropriate decimal places based on magnitude
    return Math.floor(value * factor) / factor;
  }
  
  // Determine the magnitude of the value for normal cases
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  
  // For small variations, use finer-grained rounding
  if (isSmallVariation) {
    if (magnitude >= 1000) {
      return Math.floor(value / 100) * 100;
    } else if (magnitude >= 100) {
      return Math.floor(value / 10) * 10;
    } else if (magnitude >= 10) {
      return Math.floor(value);
    } else if (magnitude >= 1) {
      return Math.floor(value * 10) / 10; // Round to 0.1
    } else if (magnitude >= 0.1) {
      return Math.floor(value * 100) / 100; // Round to 0.01
    } else {
      return Math.floor(value * 1000) / 1000; // Round to 0.001
    }
  } else {
    // Standard rounding for larger variations
    if (magnitude >= 1000) {
      return Math.floor(value / 1000) * 1000;
    } else if (magnitude >= 100) {
      return Math.floor(value / 100) * 100;
    } else if (magnitude >= 10) {
      return Math.floor(value / 10) * 10;
    } else if (magnitude >= 1) {
      return Math.floor(value);
    } else if (magnitude >= 0.1) {
      return Math.floor(value * 10) / 10; // Round to 0.1
    } else {
      return Math.floor(value * 100) / 100; // Round to 0.01
    }
  }
};

/**
 * Round a number up to a nice human-readable value
 */
const roundToCeilingNiceNumber = (value: number, isVerySmallValue: boolean, isSmallVariation: boolean): number => {
  // Special handling for very small values (< 0.1)
  if (isVerySmallValue) {
    // Determine the magnitude for very small values
    const decimalPlaces = Math.abs(Math.floor(Math.log10(value))) + 1;
    const factor = Math.pow(10, decimalPlaces);
    
    // Round to appropriate decimal places based on magnitude
    return Math.ceil(value * factor) / factor;
  }
  
  // Determine the magnitude of the value for normal cases
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  
  // For small variations, use finer-grained rounding
  if (isSmallVariation) {
    if (magnitude >= 1000) {
      return Math.ceil(value / 100) * 100;
    } else if (magnitude >= 100) {
      return Math.ceil(value / 10) * 10;
    } else if (magnitude >= 10) {
      return Math.ceil(value);
    } else if (magnitude >= 1) {
      return Math.ceil(value * 10) / 10; // Round to 0.1
    } else if (magnitude >= 0.1) {
      return Math.ceil(value * 100) / 100; // Round to 0.01
    } else {
      return Math.ceil(value * 1000) / 1000; // Round to 0.001
    }
  } else {
    // Standard rounding for larger variations
    if (magnitude >= 1000) {
      return Math.ceil(value / 1000) * 1000;
    } else if (magnitude >= 100) {
      return Math.ceil(value / 100) * 100;
    } else if (magnitude >= 10) {
      return Math.ceil(value / 10) * 10;
    } else if (magnitude >= 1) {
      return Math.ceil(value);
    } else if (magnitude >= 0.1) {
      return Math.ceil(value * 10) / 10; // Round to 0.1
    } else {
      return Math.ceil(value * 100) / 100; // Round to 0.01
    }
  }
};

/**
 * Format Y-axis tick values with appropriate precision
 */
export const formatYAxisTick = (value: number, precision: number | undefined, isVerySmallValue: boolean | undefined): string => {
  // For very small values, show more decimal places
  if (isVerySmallValue === true) {
    // Use at least 3 decimal places for very small values
    const decimalPlaces = Math.max(3, precision || 0);
    return value.toFixed(decimalPlaces);
  }
  
  return value.toFixed(precision || 0);
};
