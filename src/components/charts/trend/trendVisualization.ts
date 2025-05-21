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
    // Format date and time
    const date = new Date(point.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    // Create formatting for display and tooltip
    const formattedDate = `${day}.${month}`;
    const fullDateTime = `${formattedDate} ${formattedTime}`;
    
    // Track if this is the start of a new day (midnight or first point of the day)
    const isNewDay = date.getHours() === 0 && date.getMinutes() === 0;
    
    // Ensure value is never negative
    const safeValue = typeof point.value === 'number' ? Math.max(0, point.value) : null;
    
    return {
      time: formattedTime,      // Used for basic tick display
      fullDateTime,            // Used for tooltips
      date: formattedDate,     // Date part for reference
      timestamp: date.getTime(), // Raw timestamp for sorting
      isNewDay,                // Flag for day markers
      value: safeValue
    };
  });
  
  // Apply smoothing if requested
  return applySmoothing ? smoothData(formattedData, 15) : formattedData;
};

/**
 * Format a date for display with the specified format
 */
export const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
};

/**
 * Check if two dates represent the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() && 
         date1.getMonth() === date2.getMonth() && 
         date1.getFullYear() === date2.getFullYear();
};

/**
 * Generate day markers for the X-axis
 */
export const generateDayMarkers = (points: any[]): { value: number; label: string }[] => {
  if (!points || points.length === 0) return [];
  
  const markers: { value: number; label: string }[] = [];
  let currentDay: Date | null = null;
  
  // Sort points by timestamp
  const sortedPoints = [...points].sort((a, b) => a.timestamp - b.timestamp);
  
  // Process each point
  for (let i = 0; i < sortedPoints.length; i++) {
    const date = new Date(sortedPoints[i].timestamp);
    
    // If this is a new day or the first point
    if (!currentDay || !isSameDay(date, currentDay)) {
      // Mark the start of the day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      
      markers.push({
        value: dayStart.getTime(),
        label: formatDate(dayStart)
      });
      
      currentDay = new Date(date);
    }
  }
  
  return markers;
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
  
  if (values.length === 0) return { minValue: 0, maxValue: 100, isVerySmallValue: false };
  
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
    if (value < 0.001) {
      // Values in the thousandths range (0.0001 - 0.001)
      return Math.floor(value * 10000) / 10000;
    } else if (value < 0.01) {
      // Values in the hundredths range (0.001 - 0.01)
      return Math.floor(value * 1000) / 1000;
    } else if (value < 0.1) {
      // Values in the tenths range (0.01 - 0.1)
      return Math.floor(value * 100) / 100;
    }
  }
  
  // For small variations, we want to round more precisely
  if (isSmallVariation) {
    if (value < 1) {
      return Math.floor(value * 10) / 10; // Round to nearest 0.1
    } else if (value < 10) {
      return Math.floor(value * 2) / 2; // Round to nearest 0.5
    } else if (value < 100) {
      return Math.floor(value); // Round to nearest 1
    } else if (value < 1000) {
      return Math.floor(value / 5) * 5; // Round to nearest 5
    } else if (value < 10000) {
      return Math.floor(value / 10) * 10; // Round to nearest 10
    } else {
      return Math.floor(value / 100) * 100; // Round to nearest 100
    }
  }
  
  // Regular values with normal variations use more standard rounding
  if (value < 1) {
    return 0; // Round to 0 for small values
  } else if (value < 10) {
    return Math.floor(value); // Round to nearest 1
  } else if (value < 100) {
    return Math.floor(value / 5) * 5; // Round to nearest 5
  } else if (value < 1000) {
    return Math.floor(value / 10) * 10; // Round to nearest 10
  } else if (value < 10000) {
    return Math.floor(value / 100) * 100; // Round to nearest 100
  } else {
    return Math.floor(value / 1000) * 1000; // Round to nearest 1000
  }
};

/**
 * Round a number up to a nice human-readable value
 */
const roundToCeilingNiceNumber = (value: number, isVerySmallValue: boolean, isSmallVariation: boolean): number => {
  // Special handling for very small values (< 0.1)
  if (isVerySmallValue) {
    // Determine the magnitude for very small values
    if (value < 0.001) {
      // Values in the thousandths range (0.0001 - 0.001)
      return Math.ceil(value * 10000) / 10000;
    } else if (value < 0.01) {
      // Values in the hundredths range (0.001 - 0.01)
      return Math.ceil(value * 1000) / 1000;
    } else if (value < 0.1) {
      // Values in the tenths range (0.01 - 0.1)
      return Math.ceil(value * 100) / 100;
    }
  }
  
  // For small variations, we want to round more precisely
  if (isSmallVariation) {
    if (value < 1) {
      return Math.ceil(value * 10) / 10; // Round to nearest 0.1
    } else if (value < 10) {
      return Math.ceil(value * 2) / 2; // Round to nearest 0.5
    } else if (value < 100) {
      return Math.ceil(value); // Round to nearest 1
    } else if (value < 1000) {
      return Math.ceil(value / 5) * 5; // Round to nearest 5
    } else if (value < 10000) {
      return Math.ceil(value / 10) * 10; // Round to nearest 10
    } else {
      return Math.ceil(value / 100) * 100; // Round to nearest 100
    }
  }
  
  // Regular values with normal variations use more standard rounding
  if (value < 1) {
    return 1; // Round up to 1 for small values
  } else if (value < 10) {
    return Math.ceil(value); // Round to nearest 1
  } else if (value < 100) {
    return Math.ceil(value / 5) * 5; // Round to nearest 5
  } else if (value < 1000) {
    return Math.ceil(value / 10) * 10; // Round to nearest 10
  } else if (value < 10000) {
    return Math.ceil(value / 100) * 100; // Round to nearest 100
  } else {
    return Math.ceil(value / 1000) * 1000; // Round to nearest 1000
  }
};

/**
 * Format Y-axis tick values with appropriate precision
 */
export const formatYAxisTick = (value: number, precision: number | undefined, isVerySmallValue: boolean | undefined): string => {
  if (isVerySmallValue) {
    // For very small values, show more decimal places
    return value.toFixed(4);
  }
  
  if (precision !== undefined) {
    // Use the defined precision if provided
    return value.toFixed(precision);
  }
  
  // Default formatting based on value range
  if (value < 0.1) {
    return value.toFixed(3);
  } else if (value < 1) {
    return value.toFixed(2);
  } else if (value < 10) {
    return value.toFixed(1);
  } else {
    return Math.round(value).toString();
  }
};
