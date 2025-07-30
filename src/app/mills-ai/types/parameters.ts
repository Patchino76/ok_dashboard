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
  /** Absolute minimum value possible for this parameter */
  min: number;
  /** Absolute maximum value possible for this parameter */
  max: number;
  /** Current minimum value selected for training/prediction */
  currentMin: number;
  /** Current maximum value selected for training/prediction */
  currentMax: number;
  /** Measurement unit (e.g., t/h, m³/h) */
  unit: string;
  /** Description of the parameter in Bulgarian */
  description: string;
}
