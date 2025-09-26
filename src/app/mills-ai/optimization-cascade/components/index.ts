// Shared type definitions
export interface CascadeParameter {
  id: string
  name: string
  unit: string
  value: number
  sliderSP: number // Slider setpoint value for simulation
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
  varType: "MV" | "CV" | "DV" | "TARGET"
}

// Component exports
export { default as CascadeOptimizationDashboard } from './cascade-optimization-dashboard';
export { default as ParameterCascadeOptimizationCard } from './parameter-cascade-optimization-card';
