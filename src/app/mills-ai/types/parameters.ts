/**
 * Core parameter types and interfaces for Mills-AI components
 */

export interface ModelParameter {
  /** Unique identifier for the parameter */
  id: string;
  /** Display name in Bulgarian */
  name: string;
  /** Parameter type: 'feature' (input) or 'target' (output) */
  type: "feature" | "target";
  /** Whether the parameter is enabled/selected for use */
  enabled: boolean;
  /** Whether filtering is enabled for this parameter during training */
  filterEnabled?: boolean;
  /** Absolute minimum value possible for this parameter */
  min: number;
  /** Absolute maximum value possible for this parameter */
  max: number;
  /** Current minimum value selected for training/prediction */
  currentMin: number;
  /** Current maximum value selected for training/prediction */
  currentMax: number;
  /** Variable type: MV (Manipulated), CV (Controlled), DV (Disturbance), TARGET (Target/Output) */
  varType: "MV" | "CV" | "DV" | "TARGET";
  /** Measurement unit (e.g., t/h, m³/h) */
  unit: string;
  /** Description of the parameter in Bulgarian */
  description: string;
  /** Whether this parameter has real-time trend data available (for DVs that can be pulled from endpoints) */
  hasTrend?: boolean;
}
