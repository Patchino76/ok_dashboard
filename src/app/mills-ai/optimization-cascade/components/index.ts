// Shared type definitions
export interface CascadeParameter {
  id: string
  name: string
  unit: string
  value: number
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
  varType: "MV" | "CV" | "DV"
}

// Component exports
export { default as CascadeOptimizationDashboard } from './cascade-optimization-dashboard';
export { ParameterCascadeOptimizationCard } from './parameter-cascade-optimization-card';
