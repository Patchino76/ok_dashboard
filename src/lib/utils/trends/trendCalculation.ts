/**
 * Common trend calculation utilities
 */
import { TagTrendPoint } from "@/lib/tags/types";

export interface RegressionResult {
  slope: number;        // Slope of the regression line
  intercept: number;    // Y-intercept of the regression line
  startValue: number;   // Predicted value at start of trend
  endValue: number;     // Predicted value at end of trend
  percentChange: number;// Percentage change from start to end
  rSquared: number;     // R-squared value (goodness of fit)
}

/**
 * Filter trend points to remove null values and zeros
 */
export function filterValidPoints(trendPoints: TagTrendPoint[] | undefined): TagTrendPoint[] {
  if (!trendPoints) return [];
  
  return trendPoints.filter(point => 
    point.value !== null && point.value !== 0
  );
}

/**
 * Calculate linear regression for a set of trend points
 */
export function calculateRegression(points: TagTrendPoint[]): RegressionResult | null {
  if (points.length < 2) return null;
  
  // Convert timestamps to numeric values (milliseconds since epoch)
  const data = points.map(point => ({
    x: new Date(point.timestamp).getTime(),
    y: point.value as number
  }));
  
  // Simple linear regression calculation
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  
  for (const point of data) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
    sumYY += point.y * point.y;
  }
  
  const n = data.length;
  const denominator = n * sumXX - sumX * sumX;
  
  if (denominator === 0) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared
  const meanY = sumY / n;
  const totalVariation = sumYY - n * meanY * meanY;
  const explainedVariation = sumYY - sumY * sumY / n - slope * slope * (sumXX - sumX * sumX / n);
  const rSquared = 1 - explainedVariation / totalVariation;
  
  // Calculate start and end values
  const startX = data[0].x;
  const endX = data[data.length - 1].x;
  const startValue = intercept + slope * startX;
  const endValue = intercept + slope * endX;
  
  // Calculate percent change
  const percentChange = startValue !== 0 ? ((endValue - startValue) / Math.abs(startValue)) * 100 : 0;
  
  return {
    slope,
    intercept,
    startValue,
    endValue,
    percentChange,
    rSquared
  };
}

/**
 * Generate regression line data points based on original data
 */
export function generateRegressionLineData(
  originalData: Array<{ timestamp: string }>, 
  regression: { slope: number, intercept: number }
): Array<{ timestamp: string, regressionValue: number }> {
  if (!originalData || originalData.length < 2) return [];
  
  return originalData.map((point, index) => {
    const x = index; // Use index for simpler charting
    return {
      timestamp: point.timestamp,
      regressionValue: regression.slope * x + regression.intercept
    };
  });
}
