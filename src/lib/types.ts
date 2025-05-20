/**
 * Types for trend visualization
 */
export type TrendDirection = 'up' | 'down' | 'neutral';

export interface TrendPoint {
  timestamp: string;
  value: number | null;
}
