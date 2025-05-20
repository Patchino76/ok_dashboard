import { TrendDirection, TrendPoint } from '@/lib/types';

interface RegressionResult {
  slope: number;
  rSquared: number;
  percentChange: number;
}

/**
 * Filters out invalid points from trend data
 * @param trendPoints Array of trend points to filter
 * @returns Array with only valid points (non-null, non-zero)
 */
export function filterValidPoints(trendPoints: TrendPoint[]): TrendPoint[] {
  return trendPoints.filter(point => point.value !== null && point.value !== 0);
}

/**
 * Calculates linear regression for trend points
 * @param points Array of trend data points
 * @returns Regression result with slope, r-squared, and percent change
 */
export function calculateRegression(points: TrendPoint[]): RegressionResult {
  if (points.length < 2) {
    return { slope: 0, rSquared: 0, percentChange: 0 };
  }

  // Extract x and y values
  const n = points.length;
  const xValues = points.map((_, i) => i);
  const yValues = points.map(p => Number(p.value));

  // Calculate means
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const x = xValues[i];
    const y = yValues[i];
    numerator += (x - xMean) * (y - yMean);
    denominator += (x - xMean) ** 2;
  }

  const slope = denominator ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  const yPredicted = xValues.map(x => slope * x + intercept);
  
  const ssTotal = yValues.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
  const ssResidual = yValues.reduce((sum, y, i) => sum + (y - yPredicted[i]) ** 2, 0);
  
  const rSquared = ssTotal ? 1 - (ssResidual / ssTotal) : 0;

  // Calculate percent change from first to last point
  const firstValue = yValues[0];
  const lastValue = yValues[n - 1];
  const percentChange = firstValue ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  return { slope, rSquared, percentChange };
}

/**
 * Determines trend direction based on percentage change and significance
 * @param percentChange Percentage change in values
 * @param rSquared R-squared value from regression
 * @returns Trend direction: 'up', 'down', or 'neutral'
 */
export function calculateTrendDirection(
  percentChange: number,
  rSquared: number
): TrendDirection {
  const isSignificant = Math.abs(percentChange) >= 3 && rSquared > 0.1;
  
  if (!isSignificant) {
    return 'neutral';
  }
  
  return percentChange > 0 ? 'up' : 'down';
}
