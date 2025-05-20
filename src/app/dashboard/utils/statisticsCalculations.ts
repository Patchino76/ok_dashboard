/**
 * Utility functions for statistical calculations
 */

import { TagTrendPoint } from "@/lib/tags/types";

/**
 * Calculate basic statistics from an array of values
 */
export function calculateStatistics(data: number[]) {
  if (!data || data.length === 0) return null;

  // Calculate mean (average)
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;

  // Calculate standard deviation
  const squaredDifferences = data.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / data.length;
  const stdDev = Math.sqrt(variance);

  // Calculate min and max
  const min = Math.min(...data);
  const max = Math.max(...data);

  // Calculate quartiles
  const sortedData = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(sortedData.length * 0.25);
  const q3Index = Math.floor(sortedData.length * 0.75);
  const q1 = sortedData[q1Index];
  const median = sortedData.length % 2 === 0 
    ? (sortedData[sortedData.length / 2 - 1] + sortedData[sortedData.length / 2]) / 2
    : sortedData[Math.floor(sortedData.length / 2)];
  const q3 = sortedData[q3Index];
  
  // Calculate interquartile range
  const iqr = q3 - q1;

  return {
    mean,
    median,
    stdDev,
    min,
    max,
    q1,
    q3,
    iqr,
    count: data.length
  };
}

/**
 * Generate histogram data from an array of values
 */
export function generateHistogramData(data: number[], bucketCount = 10) {
  if (!data || data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  
  // Create buckets
  const bucketSize = (max - min) / bucketCount;
  const buckets = Array(bucketCount).fill(0).map((_, index) => ({
    min: min + index * bucketSize,
    max: min + (index + 1) * bucketSize,
    count: 0
  }));

  // Count values in each bucket
  data.forEach(val => {
    // Special case for the maximum value, put it in the last bucket
    if (val === max) {
      buckets[bucketCount - 1].count++;
      return;
    }

    const bucketIndex = Math.floor((val - min) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      buckets[bucketIndex].count++;
    }
  });

  // Format bucket labels and prepare final data
  return buckets.map((bucket, index) => ({
    name: `${bucket.min.toFixed(1)} - ${bucket.max.toFixed(1)}`,
    value: bucket.count,
    min: bucket.min,
    max: bucket.max,
    frequency: bucket.count / data.length
  }));
}

/**
 * Generate marker data for mean and standard deviations
 */
export function generateStatisticalMarkers(statistics: ReturnType<typeof calculateStatistics>, histogramData: ReturnType<typeof generateHistogramData>[0][]) {
  if (!statistics || histogramData.length === 0) return [];

  const { mean, stdDev } = statistics;
  const markers = [
    { value: mean, label: 'Mean', color: '#0ea5e9' },
    { value: mean - stdDev, label: '-1σ', color: '#84cc16' },
    { value: mean + stdDev, label: '+1σ', color: '#84cc16' },
    { value: mean - 2 * stdDev, label: '-2σ', color: '#eab308' },
    { value: mean + 2 * stdDev, label: '+2σ', color: '#eab308' },
    { value: mean - 3 * stdDev, label: '-3σ', color: '#ef4444' },
    { value: mean + 3 * stdDev, label: '+3σ', color: '#ef4444' }
  ];

  return markers;
}

/**
 * Process trend data for statistics calculations
 * Filters out stoppages (values close to zero) and trims outliers
 */
export function processTrendDataForStatistics(trendData: TagTrendPoint[]) {
  if (!trendData || trendData.length === 0) return [];
  
  // Extract numerical values, filtering out nulls
  const values = trendData
    .filter(point => point.value !== null)
    .map(point => point.value as number);
  
  return removeStoppagesAndOutliers(values);
}

/**
 * Remove stoppages (values close to zero) and outliers beyond 5 sigma
 */
export function removeStoppagesAndOutliers(data: number[]) {
  if (data.length === 0) return [];
  
  // First, filter out values close to zero (stoppages)
  // Using a small threshold to account for sensor noise
  const nonZeroThreshold = 0.5;
  const nonZeroValues = data.filter(val => val > nonZeroThreshold);
  
  // If after filtering stoppages we have no data, return empty array
  if (nonZeroValues.length === 0) return [];
  
  // Calculate mean and standard deviation of non-zero values
  const mean = nonZeroValues.reduce((sum, val) => sum + val, 0) / nonZeroValues.length;
  const squaredDifferences = nonZeroValues.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / nonZeroValues.length;
  const stdDev = Math.sqrt(variance);
  
  // Filter out outliers beyond 5 sigma
  const lowerBound = mean - 5 * stdDev;
  const upperBound = mean + 5 * stdDev;
  
  return nonZeroValues.filter(val => val >= lowerBound && val <= upperBound);
}
