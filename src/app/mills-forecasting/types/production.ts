/**
 * Real-time production data types for mills forecasting
 */

/**
 * Real-time production metrics from API
 */
export interface RealTimeProductionData {
  currentOreRate: number;
  actualShiftProduction: number;
  actualDayProduction: number;
  activeMillsCount: number;
  timestamp: Date;
}

/**
 * Production data update payload
 */
export interface ProductionDataUpdate {
  currentOreRate: number;
  actualShiftProduction: number;
  actualDayProduction: number;
  activeMillsCount: number;
}
