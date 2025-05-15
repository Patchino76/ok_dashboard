import { TagTrendPoint } from '@/lib/tags/types';

// Define trend direction type
export type TrendDirection = 'up' | 'down' | 'neutral';

type TrendResult = {
  direction: TrendDirection;
  percentage: string;
};

// Regression result type for reuse
export type RegressionResult = {
  slope: number;          // Slope of the regression line
  intercept: number;      // Y-intercept of the regression line
  startValue: number;     // First value on the regression line
  endValue: number;       // Last value on the regression line
  percentChange: number;  // Percentage change from start to end
  rSquared: number;       // R-squared value (goodness of fit)
};


/**
 * Filter trend points to remove null values and zeros
 * 
 * @param trendPoints Array of trend data points
 * @returns Filtered array of valid points
 */
export function filterValidPoints(trendPoints: TagTrendPoint[] | undefined): TagTrendPoint[] {
  if (!trendPoints) return [];
  
  // Filter out zeros and null values
  return trendPoints.filter(point => 
    point.value !== null && point.value !== 0
  );
}

/**
 * Calculate linear regression for a set of trend points
 * 
 * @param points Array of trend data points
 * @returns Regression analysis result
 */
export function calculateRegression(points: TagTrendPoint[]): RegressionResult | null {
  if (points.length < 2) return null;
  
  // Convert timestamps to numeric values (milliseconds since epoch)
  const data = points.map(point => ({
    x: new Date(point.timestamp).getTime(),
    y: point.value as number
  }));
  
  // Calculate means
  const n = data.length;
  const sumX = data.reduce((sum, p) => sum + p.x, 0);
  const sumY = data.reduce((sum, p) => sum + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  
  // Calculate slope and intercept
  const numerator = data.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  const denominator = data.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2), 0);
  
  if (denominator === 0) return null;
  
  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;
  
  // Calculate R-squared (coefficient of determination)
  const totalSumOfSquares = data.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const residualSumOfSquares = data.reduce((sum, p) => {
    const predicted = slope * p.x + intercept;
    return sum + Math.pow(p.y - predicted, 2);
  }, 0);
  
  const rSquared = 1 - (residualSumOfSquares / totalSumOfSquares);
  
  // Calculate start and end values on the regression line
  const startX = data[0].x;
  const endX = data[data.length - 1].x;
  const startValue = slope * startX + intercept;
  const endValue = slope * endX + intercept;
  
  // Calculate percentage change
  const percentChange = startValue !== 0 
    ? ((endValue - startValue) / Math.abs(startValue)) * 100
    : 0;
  
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
 * Generate regression line points for plotting
 * Similar to mfc-dashboard approach
 * 
 * @param regression Regression result
 * @param points Original data points (for timestamps)
 * @returns Array of points for the regression line
 */
export function generateRegressionLine(regression: RegressionResult, points: TagTrendPoint[]): TagTrendPoint[] {
  if (!regression || points.length < 2) return [];
  
  // Use all points for the regression line to match the data points
  return points.map(point => {
    // Get the index for this point (using timestamp order)
    const timestamp = new Date(point.timestamp).getTime();
    
    // Calculate the regression value for this timestamp
    const value = regression.slope * timestamp + regression.intercept;
    
    return {
      timestamp: point.timestamp,
      value: value
    };
  });
}

/**
 * Calculate trend based on linear regression
 * 
 * @param trendPoints Array of trend data points
 * @returns Object with trend direction and percentage change
 */
export function calculateTrend(trendPoints: TagTrendPoint[] | undefined): TrendResult {
  // Default to neutral if no data or not enough points
  if (!trendPoints || trendPoints.length < 2) {
    return { direction: 'neutral', percentage: '0%' };
  }
  
  // Filter out zeros and null values
  const validPoints = filterValidPoints(trendPoints);
  
  // If we don't have enough valid points after filtering
  if (validPoints.length < 2) {
    return { direction: 'neutral', percentage: '0%' };
  }
  
  // Calculate regression
  const regression = calculateRegression(validPoints);
  
  if (!regression) {
    return { direction: 'neutral', percentage: '0%' };
  }
  
  // Round the percentage change
  const percentChange = Math.round(regression.percentChange);
  
  // Add significance threshold - only show trend if change is significant
  // and the R-squared value indicates a good fit
  const isSignificant = Math.abs(percentChange) >= 3 && regression.rSquared > 0.1;
  
  const direction: TrendDirection = !isSignificant 
    ? 'neutral' 
    : percentChange > 0 ? 'up' : 'down';
  
  return {
    direction,
    percentage: `${percentChange > 0 ? '+' : ''}${percentChange}%`
  };
}
