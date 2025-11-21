export interface ShiftInfo {
  shift: 1 | 2 | 3;
  name: string;
  startHour: number;
  endHour: number;
}

export interface HourlyForecastPoint {
  time: string;
  actual: number | null;
  optimistic: number;
  expected: number;
  pessimistic: number;
  target: number;
}

export interface Uncertainty {
  name: string;
  color: string;
  factor: number;
  stoppageProb: number;
  avgStoppage: number;
}

export interface PerMillSetpoint {
  millId: string;
  currentRate: number;
  requiredShiftRate: number;
  requiredDayRate: number;
  adjustmentNeeded: number; // Adjustment needed to reach target (can be positive or negative)
}

export interface OreFeedTimelinePoint {
  time: string;
  actualRate: number;
  requiredShiftRate: number;
  requiredDayRate: number;
}

export interface Forecast {
  shiftInfo: ShiftInfo;
  hoursToShiftEnd: number;
  hoursToEndOfDay: number;
  productionSoFar: number;
  productionToday: number;
  forecastShiftOptimistic: number;
  forecastShiftExpected: number;
  forecastShiftPessimistic: number;
  forecastDayOptimistic: number;
  forecastDayExpected: number;
  forecastDayPessimistic: number;
  requiredRateShift: number;
  requiredRateDay: number;
  requiredRateShiftAdjusted: number;
  requiredRateDayAdjusted: number;
  hourlyForecast: HourlyForecastPoint[];
  uncertainty: Uncertainty;
  expectedStoppages: number;
  expectedDowntime: number;
  canMeetShiftTarget: boolean;
  canMeetDayTarget: boolean;
  perMillSetpoints: PerMillSetpoint[];
  oreFeedTimeline: OreFeedTimelinePoint[];
}

export interface UseProductionForecastArgs {
  shiftTarget: number;
  dayTarget: number;
  currentOreRate: number;
  adjustedOreRate: number;
  uncertaintyPercent: number; // 0-30% uncertainty level
  mills: string[];
  selectedMills: string[];
  // Real-time production data (optional - will calculate if not provided)
  actualShiftProduction?: number;
  actualDayProduction?: number;
  // Individual mill ore rates (optional - will use equal distribution if not provided)
  millOreRates?: Record<string, number>;
}
