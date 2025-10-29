import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { millsParameters } from "../../data/mills-parameters";

// Parameter interface for cascade store
export interface CascadeParameter {
  id: string;
  name: string;
  unit: string;
  value: number;
  sliderSP: number; // Slider setpoint value for simulation
  trend: Array<{ timestamp: number; value: number }>;
  predictionTrend?: Array<{ timestamp: number; value: number }>;
  color: string;
  icon: string;
  varType?: "MV" | "CV" | "DV";
  isLab?: boolean;
}

// Target data interface - compatible with CascadeTargetTrend component
export interface TargetData {
  timestamp: number;
  value: number; // Current PV value
  target: number; // Target/setpoint value
  pv: number; // Process variable (same as value)
  sp?: number | null; // Setpoint (same as target)
}

// Parameter distribution interface for target-driven optimization
export interface ParameterDistribution {
  mean: number;
  std: number;
  median: number;
  percentiles: Record<string, number>; // {5: val, 25: val, 50: val, 75: val, 95: val}
  min_value: number;
  max_value: number;
  sample_count: number;
}

// Cascade-specific optimization interfaces
export interface CascadeOptimizationConfig {
  mill_number: number;
  mv_bounds: Record<string, [number, number]>; // Manipulated variables bounds
  cv_bounds: Record<string, [number, number]>; // Controlled variables bounds
  dv_values: Record<string, number>; // Disturbance variables values
  target_variable: string;
  target_setpoint?: number;
  maximize?: boolean;
  n_trials?: number;
  timeout_seconds?: number;
}

// Target-driven optimization configuration
export interface TargetDrivenOptimizationConfig {
  mill_number: number;
  target_value: number;
  target_variable: string;
  tolerance: number; // ±1% = 0.01
  mv_bounds: Record<string, [number, number]>;
  cv_bounds: Record<string, [number, number]>;
  dv_values: Record<string, number>;
  n_trials: number;
  confidence_level: number; // 0.90 for 90%
}

export interface CascadeOptimizationResult {
  id: string;
  timestamp: number;
  config: CascadeOptimizationConfig;
  best_mv_values: Record<string, number>; // Optimized MV values
  predicted_cvs: Record<string, number>; // Predicted CV values
  predicted_target: number; // Predicted target value
  is_feasible: boolean;
  constraint_violations: string[];
  optimization_history: Array<{
    trial: number;
    mv_values: Record<string, number>;
    predicted_target: number;
    is_feasible: boolean;
  }>;
  convergence_data: Array<{
    trial: number;
    best_target: number;
  }>;
  duration_seconds: number;
  status: "running" | "completed" | "failed" | "cancelled";
  error_message?: string;
  // GPR-specific fields
  cv_uncertainties?: Record<string, number>; // Uncertainty for each CV (σ)
  target_uncertainty?: number; // Uncertainty for target prediction (σ)
  best_target_uncertainty?: number; // Uncertainty for best target value (σ)
}

// Target-driven optimization result with distributions
export interface TargetDrivenOptimizationResult {
  id: string;
  timestamp: number;
  config: TargetDrivenOptimizationConfig;
  target_achieved: boolean;
  best_distance: number;
  target_value: number;
  tolerance: number;
  best_mv_values: Record<string, number>;
  best_cv_values: Record<string, number>;
  best_target_value: number;
  mv_distributions: Record<string, ParameterDistribution>;
  cv_distributions: Record<string, ParameterDistribution>;
  successful_trials: number;
  total_trials: number;
  success_rate: number;
  confidence_level: number;
  optimization_time: number;
  status: "running" | "completed" | "failed" | "cancelled";
  error_message?: string;
}

export interface CascadeOptimizationState {
  // Configuration
  millNumber: number;
  targetVariable: string;
  targetSetpoint: number;
  maximize: boolean;
  nTrials: number;
  timeoutSeconds: number;

  // Target-driven optimization configuration
  targetValue: number;
  tolerance: number; // ±1% = 0.01
  confidenceLevel: number; // 0.90 for 90%
  isTargetDrivenMode: boolean; // Switch between regular and target-driven optimization

  // Parameter bounds for optimization
  mvBounds: Record<string, [number, number]>; // Manipulated variables bounds
  cvBounds: Record<string, [number, number]>; // Controlled variables bounds
  dvValues: Record<string, number>; // Disturbance variables current values
  
  // Optimization search space bounds (adjustable markers on MV sliders)
  mvOptimizationBounds: Record<string, [number, number]>; // User-adjustable bounds for Optuna search

  // Settings
  autoApplyResults: boolean;

  // Status
  isOptimizing: boolean;
  optimizationProgress: number;
  currentOptimizationId: string | null;

  // Results
  currentResults: CascadeOptimizationResult | null;
  optimizationHistory: CascadeOptimizationResult[];
  bestMVValues: Record<string, number> | null;
  proposedSetpoints: Record<string, number> | null;

  // Target-driven optimization results
  currentTargetResults: TargetDrivenOptimizationResult | null;
  targetOptimizationHistory: TargetDrivenOptimizationResult[];
  parameterDistributions: {
    mv_distributions: Record<string, ParameterDistribution>;
    cv_distributions: Record<string, ParameterDistribution>;
  };

  // CASCADE-SPECIFIC STATE (migrated from xgboost-store)
  // Model state
  modelName: string | null;
  modelFeatures: string[];
  modelTarget: string | null;
  lastTrained: string | null;
  availableModels: Record<string, any>;
  modelType: "xgb" | "gpr"; // Model type selector
  useUncertainty: boolean; // GPR: Use uncertainty-aware optimization
  uncertaintyWeight: number; // GPR: Weight for uncertainty penalty

  // Parameter state
  parameters: CascadeParameter[];
  parameterBounds: Record<string, [number, number]>;
  sliderValues: Record<string, number>; // Legacy - keeping for compatibility

  // Target state
  currentTarget: number;
  currentPV: number;
  targetData: TargetData[];
  simulationTarget: number | null;

  // Real-time data state (removed - using XGBoost store instead)

  // Actions - Configuration
  setMillNumber: (mill: number) => void;
  setTargetVariable: (variable: string) => void;
  setTargetSetpoint: (value: number) => void;
  setMaximize: (maximize: boolean) => void;
  setNTrials: (trials: number) => void;
  setTimeoutSeconds: (seconds: number) => void;
  setModelType: (type: "xgb" | "gpr") => void;
  setUseUncertainty: (use: boolean) => void;
  setUncertaintyWeight: (weight: number) => void;

  // Actions - Target-driven optimization configuration
  setTargetValue: (value: number) => void;
  setTolerance: (tolerance: number) => void;
  setConfidenceLevel: (level: number) => void;
  setTargetDrivenMode: (enabled: boolean) => void;

  // Actions - Parameter bounds
  updateMVBounds: (id: string, bounds: [number, number]) => void;
  setMVBounds: (bounds: Record<string, [number, number]>) => void;
  updateCVBounds: (id: string, bounds: [number, number]) => void;
  setCVBounds: (bounds: Record<string, [number, number]>) => void;
  updateDVValue: (id: string, value: number) => void;
  setDVValues: (values: Record<string, number>) => void;
  
  // Actions - Optimization search space bounds
  updateMVOptimizationBounds: (id: string, bounds: [number, number]) => void;
  setMVOptimizationBounds: (bounds: Record<string, [number, number]>) => void;
  initializeMVOptimizationBounds: () => void; // Initialize from mvBounds

  // Actions - Optimization control
  startOptimization: (config: CascadeOptimizationConfig) => void;
  startTargetOptimization: (config: TargetDrivenOptimizationConfig) => void;
  stopOptimization: () => void;
  updateProgress: (progress: number) => void;
  setOptimizationId: (id: string) => void;

  // Actions - Results management
  setResults: (results: CascadeOptimizationResult) => void;
  addToHistory: (results: CascadeOptimizationResult) => void;
  clearResults: () => void;
  clearHistory: () => void;

  // Actions - Target-driven results management
  setTargetResults: (results: TargetDrivenOptimizationResult) => void;
  addToTargetHistory: (results: TargetDrivenOptimizationResult) => void;
  setParameterDistributions: (distributions: {
    mv_distributions: Record<string, ParameterDistribution>;
    cv_distributions: Record<string, ParameterDistribution>;
  }) => void;
  clearTargetResults: () => void;
  clearTargetHistory: () => void;

  // Actions - Proposed setpoints management
  setProposedSetpoints: (setpoints: Record<string, number>) => void;
  clearProposedSetpoints: () => void;
  setAutoApplyResults: (auto: boolean) => void;

  // CASCADE-SPECIFIC ACTIONS (migrated from xgboost-store)
  // Model actions
  setModelName: (name: string) => void;
  setModelMetadata: (
    features: string[],
    target: string,
    lastTrained: string
  ) => void;
  setAvailableModels: (models: Record<string, any>) => void;

  // Parameter actions
  updateSliderValue: (id: string, value: number) => void;
  updateSliderSP: (id: string, value: number) => void; // New action for slider SP
  updateParameterFromRealData: (
    id: string,
    value: number,
    trend: Array<{ timestamp: number; value: number }>
  ) => void;
  updateCVPredictions: (predicted: Record<string, number>) => void;
  resetFeatures: () => void;
  resetSliders: () => void;
  getMVSliderValues: () => Record<string, number>; // Get all MV slider values
  getDVSliderValues: (dvFeatures?: string[]) => Record<string, number>; // Get DV slider values (optionally filtered by feature list)
  initializeMVSlidersWithPVs: (xgboostParameters?: any[]) => void; // Initialize MV slider values with current PV values

  // Target actions
  setPredictedTarget: (value: number) => void;
  addTargetDataPoint: (pv: number, sp?: number) => void;
  setSimulationTarget: (value: number | null) => void;

  // Real-time data actions (removed - using XGBoost store instead)

  // Prediction actions (removed - using hardcoded defaults instead)

  // Utility functions
  getOptimizationConfig: () => CascadeOptimizationConfig;
  getTargetOptimizationConfig: () => TargetDrivenOptimizationConfig;
  resetToDefaults: () => void;
  hasValidConfiguration: () => boolean;
  hasValidTargetConfiguration: () => boolean;
  getParameterBoundsFromDistributions: (confidenceLevel?: number) => {
    mv_bounds: Record<string, [number, number]>;
    cv_bounds: Record<string, [number, number]>;
  };
  getTagId: (millNumber: number, featureName: string) => string | null;
}

const initialState = {
  // Configuration defaults
  millNumber: 6,
  targetVariable: "PSI200",
  targetSetpoint: 25.0,
  maximize: false, // Typically minimize PSI for better quality
  nTrials: 300,
  timeoutSeconds: 300, // 5 minutes

  // Target-driven optimization defaults
  targetValue: 23.0, // Default target PSI200 value
  tolerance: 0.01, // ±1% tolerance
  confidenceLevel: 0.9, // 90% confidence intervals
  isTargetDrivenMode: false, // Start with regular optimization

  // Parameter bounds (will be populated from model metadata)
  mvBounds: {},
  cvBounds: {},
  dvValues: {},
  
  // Optimization search space bounds (initialized from mvBounds)
  mvOptimizationBounds: {},

  // Settings
  autoApplyResults: false,

  // Status
  isOptimizing: false,
  optimizationProgress: 0,
  currentOptimizationId: null,

  // Results
  currentResults: null,
  optimizationHistory: [],
  bestMVValues: null,
  proposedSetpoints: null,

  // Target-driven optimization results
  currentTargetResults: null,
  targetOptimizationHistory: [],
  parameterDistributions: {
    mv_distributions: {},
    cv_distributions: {},
  },

  // CASCADE-SPECIFIC STATE (migrated from xgboost-store)
  // Model state
  modelName: null,
  modelFeatures: [],
  modelTarget: null,
  lastTrained: null,
  availableModels: {},
  modelType: "xgb", // Default to XGBoost
  useUncertainty: false, // GPR uncertainty-aware optimization disabled by default
  uncertaintyWeight: 1.0, // Default uncertainty weight

  // Parameter state
  parameters: millsParameters.map((param) => {
    const midValue = (param.min + param.max) / 2;
    return {
      ...param,
      trend: [],
      predictionTrend: [],
      // Keep the original varType from millsParameters (MV, CV, DV)
      sliderSP: midValue, // Initialize slider SP to midpoint
    };
  }),
  parameterBounds: millsParameters.reduce((acc, param) => {
    acc[param.id] = [param.min, param.max];
    return acc;
  }, {} as Record<string, [number, number]>),
  sliderValues: {},

  // Target state
  currentTarget: 0,
  currentPV: 0,
  targetData: [],
  simulationTarget: null,

  // Real-time data state (removed - using XGBoost store instead)
};

export const useCascadeOptimizationStore = create<CascadeOptimizationState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Configuration actions
      setMillNumber: (mill: number) => {
        set({ millNumber: mill }, false, "setMillNumber");
      },

      setTargetVariable: (variable: string) => {
        set({ targetVariable: variable }, false, "setTargetVariable");
      },

      setTargetSetpoint: (value: number) => {
        set({ targetSetpoint: value }, false, "setTargetSetpoint");
      },

      setMaximize: (maximize: boolean) => {
        set({ maximize }, false, "setMaximize");
      },

      setNTrials: (trials: number) => {
        set(
          { nTrials: Math.max(1, Math.min(1000, trials)) },
          false,
          "setNTrials"
        );
      },

      setTimeoutSeconds: (seconds: number) => {
        set(
          { timeoutSeconds: Math.max(30, Math.min(3600, seconds)) },
          false,
          "setTimeoutSeconds"
        );
      },

      setModelType: (type: "xgb" | "gpr") => {
        set({ modelType: type }, false, "setModelType");
      },

      setUseUncertainty: (use: boolean) => {
        set({ useUncertainty: use }, false, "setUseUncertainty");
      },

      setUncertaintyWeight: (weight: number) => {
        set(
          { uncertaintyWeight: Math.max(0.1, Math.min(5.0, weight)) },
          false,
          "setUncertaintyWeight"
        );
      },

      // Target-driven optimization configuration actions
      setTargetValue: (value: number) => {
        set({ targetValue: value }, false, "setTargetValue");
      },

      setTolerance: (tolerance: number) => {
        set(
          { tolerance: Math.max(0.001, Math.min(0.1, tolerance)) }, // 0.1% to 10%
          false,
          "setTolerance"
        );
      },

      setConfidenceLevel: (level: number) => {
        set(
          { confidenceLevel: Math.max(0.5, Math.min(0.99, level)) }, // 50% to 99%
          false,
          "setConfidenceLevel"
        );
      },

      setTargetDrivenMode: (enabled: boolean) => {
        set({ isTargetDrivenMode: enabled }, false, "setTargetDrivenMode");
      },

      // Parameter bounds actions
      updateMVBounds: (id: string, bounds: [number, number]) => {
        set(
          (state) => ({
            mvBounds: {
              ...state.mvBounds,
              [id]: bounds,
            },
          }),
          false,
          "updateMVBounds"
        );
      },

      setMVBounds: (bounds: Record<string, [number, number]>) => {
        set({ mvBounds: bounds }, false, "setMVBounds");
      },

      updateCVBounds: (id: string, bounds: [number, number]) => {
        set(
          (state) => ({
            cvBounds: {
              ...state.cvBounds,
              [id]: bounds,
            },
          }),
          false,
          "updateCVBounds"
        );
      },

      setCVBounds: (bounds: Record<string, [number, number]>) => {
        set({ cvBounds: bounds }, false, "setCVBounds");
      },

      updateDVValue: (id: string, value: number) => {
        set(
          (state) => ({
            dvValues: {
              ...state.dvValues,
              [id]: value,
            },
          }),
          false,
          "updateDVValue"
        );
      },

      setDVValues: (values: Record<string, number>) => {
        set({ dvValues: values }, false, "setDVValues");
      },
      
      // Optimization search space bounds
      updateMVOptimizationBounds: (id: string, bounds: [number, number]) => {
        set(
          (state) => ({
            mvOptimizationBounds: {
              ...state.mvOptimizationBounds,
              [id]: bounds,
            },
          }),
          false,
          "updateMVOptimizationBounds"
        );
      },
      
      setMVOptimizationBounds: (bounds: Record<string, [number, number]>) => {
        set({ mvOptimizationBounds: bounds }, false, "setMVOptimizationBounds");
      },
      
      initializeMVOptimizationBounds: () => {
        const { mvBounds } = get();
        // Initialize optimization bounds from mvBounds (copy values)
        const optBounds: Record<string, [number, number]> = {};
        Object.entries(mvBounds).forEach(([id, bounds]) => {
          optBounds[id] = [bounds[0], bounds[1]]; // Create a copy
        });
        set({ mvOptimizationBounds: optBounds }, false, "initializeMVOptimizationBounds");
      },

      // Optimization control
      startOptimization: (config: CascadeOptimizationConfig) => {
        const optimizationId = `cascade_opt_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        set(
          {
            isOptimizing: true,
            optimizationProgress: 0,
            currentOptimizationId: optimizationId,
            currentResults: null,
          },
          false,
          "startOptimization"
        );
      },

      startTargetOptimization: (config: TargetDrivenOptimizationConfig) => {
        const optimizationId = `target_opt_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        set(
          {
            isOptimizing: true,
            optimizationProgress: 0,
            currentOptimizationId: optimizationId,
            currentTargetResults: null,
          },
          false,
          "startTargetOptimization"
        );
      },

      stopOptimization: () => {
        set(
          {
            isOptimizing: false,
            optimizationProgress: 0,
            currentOptimizationId: null,
          },
          false,
          "stopOptimization"
        );
      },

      updateProgress: (progress: number) => {
        set(
          { optimizationProgress: Math.max(0, Math.min(100, progress)) },
          false,
          "updateProgress"
        );
      },

      setOptimizationId: (id: string) => {
        set({ currentOptimizationId: id }, false, "setOptimizationId");
      },

      // Results management
      setResults: (results: CascadeOptimizationResult) => {
        set(
          {
            currentResults: results,
            bestMVValues: results.best_mv_values,
            isOptimizing: results.status === "running",
            optimizationProgress:
              results.status === "completed" ? 100 : get().optimizationProgress,
          },
          false,
          "setResults"
        );
      },

      addToHistory: (results: CascadeOptimizationResult) => {
        set(
          (state) => ({
            optimizationHistory: [results, ...state.optimizationHistory].slice(
              0,
              50
            ), // Keep last 50 results
          }),
          false,
          "addToHistory"
        );
      },

      clearResults: () => {
        set(
          {
            currentResults: null,
            bestMVValues: null,
            optimizationProgress: 0,
            proposedSetpoints: null,
          },
          false,
          "clearResults"
        );
      },

      clearHistory: () => {
        set({ optimizationHistory: [] }, false, "clearHistory");
      },

      // Target-driven results management
      setTargetResults: (results: TargetDrivenOptimizationResult) => {
        set(
          {
            currentTargetResults: results,
            bestMVValues: results.best_mv_values,
            parameterDistributions: {
              mv_distributions: results.mv_distributions,
              cv_distributions: results.cv_distributions,
            },
            isOptimizing: results.status === "running",
            optimizationProgress:
              results.status === "completed" ? 100 : get().optimizationProgress,
          },
          false,
          "setTargetResults"
        );
      },

      addToTargetHistory: (results: TargetDrivenOptimizationResult) => {
        set(
          (state) => ({
            targetOptimizationHistory: [
              results,
              ...state.targetOptimizationHistory,
            ].slice(0, 50), // Keep last 50 results
          }),
          false,
          "addToTargetHistory"
        );
      },

      setParameterDistributions: (distributions: {
        mv_distributions: Record<string, ParameterDistribution>;
        cv_distributions: Record<string, ParameterDistribution>;
      }) => {
        set(
          { parameterDistributions: distributions },
          false,
          "setParameterDistributions"
        );
      },

      clearTargetResults: () => {
        set(
          {
            currentTargetResults: null,
            parameterDistributions: {
              mv_distributions: {},
              cv_distributions: {},
            },
          },
          false,
          "clearTargetResults"
        );
      },

      clearTargetHistory: () => {
        set({ targetOptimizationHistory: [] }, false, "clearTargetHistory");
      },

      // Proposed setpoints management
      setProposedSetpoints: (setpoints: Record<string, number>) => {
        set({ proposedSetpoints: setpoints }, false, "setProposedSetpoints");
      },

      clearProposedSetpoints: () => {
        set({ proposedSetpoints: null }, false, "clearProposedSetpoints");
      },

      setAutoApplyResults: (auto: boolean) => {
        set({ autoApplyResults: auto }, false, "setAutoApplyResults");
      },

      // Utility functions
      getOptimizationConfig: (): CascadeOptimizationConfig => {
        const {
          millNumber,
          mvBounds,
          cvBounds,
          dvValues,
          targetVariable,
          targetSetpoint,
          maximize,
          nTrials,
          timeoutSeconds,
        } = get();

        return {
          mill_number: millNumber,
          mv_bounds: mvBounds,
          cv_bounds: cvBounds,
          dv_values: dvValues,
          target_variable: targetVariable,
          target_setpoint: targetSetpoint,
          maximize,
          n_trials: nTrials,
          timeout_seconds: timeoutSeconds,
        };
      },

      getTargetOptimizationConfig: (): TargetDrivenOptimizationConfig => {
        const {
          millNumber,
          targetValue,
          targetVariable,
          tolerance,
          mvBounds,
          cvBounds,
          dvValues,
          nTrials,
          confidenceLevel,
        } = get();

        return {
          mill_number: millNumber,
          target_value: targetValue,
          target_variable: targetVariable,
          tolerance,
          mv_bounds: mvBounds,
          cv_bounds: cvBounds,
          dv_values: dvValues,
          n_trials: nTrials,
          confidence_level: confidenceLevel,
        };
      },

      hasValidConfiguration: (): boolean => {
        const { mvBounds, cvBounds, dvValues, targetVariable } = get();
        return (
          Object.keys(mvBounds).length > 0 &&
          Object.keys(cvBounds).length > 0 &&
          Object.keys(dvValues).length > 0 &&
          targetVariable.length > 0
        );
      },

      hasValidTargetConfiguration: (): boolean => {
        const {
          mvBounds,
          cvBounds,
          dvValues,
          targetVariable,
          targetValue,
          tolerance,
        } = get();
        return (
          Object.keys(mvBounds).length > 0 &&
          Object.keys(cvBounds).length > 0 &&
          Object.keys(dvValues).length > 0 &&
          targetVariable.length > 0 &&
          targetValue > 0 &&
          tolerance > 0
        );
      },

      getParameterBoundsFromDistributions: (confidenceLevel?: number) => {
        const { parameterDistributions, confidenceLevel: defaultConfidence } =
          get();
        const level = confidenceLevel || defaultConfidence;

        // Calculate percentile keys for confidence level
        const alpha = 1 - level;
        const lowerKey = ((alpha / 2) * 100).toFixed(1);
        const upperKey = ((1 - alpha / 2) * 100).toFixed(1);

        const mv_bounds: Record<string, [number, number]> = {};
        const cv_bounds: Record<string, [number, number]> = {};

        // Extract MV bounds from distributions
        Object.entries(parameterDistributions.mv_distributions).forEach(
          ([param, dist]) => {
            if (
              dist.percentiles[lowerKey] !== undefined &&
              dist.percentiles[upperKey] !== undefined
            ) {
              mv_bounds[param] = [
                dist.percentiles[lowerKey],
                dist.percentiles[upperKey],
              ];
            }
          }
        );

        // Extract CV bounds from distributions
        Object.entries(parameterDistributions.cv_distributions).forEach(
          ([param, dist]) => {
            if (
              dist.percentiles[lowerKey] !== undefined &&
              dist.percentiles[upperKey] !== undefined
            ) {
              cv_bounds[param] = [
                dist.percentiles[lowerKey],
                dist.percentiles[upperKey],
              ];
            }
          }
        );

        return { mv_bounds, cv_bounds };
      },

      resetToDefaults: () => {
        set(
          {
            targetSetpoint: 50.0,
            targetValue: 23.0,
            tolerance: 0.01,
            confidenceLevel: 0.9,
            isTargetDrivenMode: false,
            maximize: false,
            nTrials: 50,
            timeoutSeconds: 300,
            autoApplyResults: false,
            mvBounds: {},
            cvBounds: {},
            dvValues: {},
            currentTargetResults: null,
            parameterDistributions: {
              mv_distributions: {},
              cv_distributions: {},
            },
          },
          false,
          "resetToDefaults"
        );
      },

      // CASCADE-SPECIFIC ACTIONS IMPLEMENTATION
      // Model actions
      setModelName: (name: string) => {
        set({ modelName: name }, false, "setModelName");
      },

      setModelMetadata: (
        features: string[],
        target: string,
        lastTrained: string
      ) => {
        set(
          {
            modelFeatures: features,
            modelTarget: target,
            lastTrained,
          },
          false,
          "setModelMetadata"
        );
      },

      setAvailableModels: (models: Record<string, any>) => {
        set({ availableModels: models }, false, "setAvailableModels");
      },

      // Parameter actions
      updateSliderValue: (id: string, value: number) => {
        set(
          (state) => ({
            sliderValues: {
              ...state.sliderValues,
              [id]: value,
            },
            parameters: state.parameters.map((param) =>
              param.id === id ? { ...param, value } : param
            ),
          }),
          false,
          "updateSliderValue"
        );
      },

      updateSliderSP: (id: string, value: number) => {
        set(
          (state) => ({
            parameters: state.parameters.map((param) =>
              param.id === id ? { ...param, sliderSP: value } : param
            ),
          }),
          false,
          "updateSliderSP"
        );
      },

      updateParameterFromRealData: (
        id: string,
        value: number,
        trend: Array<{ timestamp: number; value: number }>
      ) => {
        set(
          (state) => ({
            parameters: state.parameters.map((param) =>
              param.id === id ? { ...param, trend } : param
            ),
          }),
          false,
          "updateParameterFromRealData"
        );
      },

      updateCVPredictions: (predicted: Record<string, number>) => {
        const timestamp = Date.now();
        console.log("🔮 Updating CV predictions in store:", predicted);

        set(
          (state) => {
            // Debug: Show all CV parameters in store
            const cvParams = state.parameters.filter((p) => p.varType === "CV");
            console.log(
              "🔍 CV parameters in store:",
              cvParams.map((p) => ({
                id: p.id,
                name: p.name,
                varType: p.varType,
              }))
            );
            console.log("🔍 Predicted CV keys:", Object.keys(predicted));

            return {
              parameters: state.parameters.map((param) => {
                if (
                  param.varType === "CV" &&
                  predicted[param.id] !== undefined
                ) {
                  const existingTrend = param.predictionTrend ?? [];
                  const updatedTrend = [
                    ...existingTrend,
                    {
                      timestamp,
                      value: predicted[param.id]!,
                    },
                  ].slice(-50);

                  console.log(`📊 Updated ${param.id} prediction trend:`, {
                    newValue: predicted[param.id],
                    trendLength: updatedTrend.length,
                    latestValue: updatedTrend[updatedTrend.length - 1],
                  });

                  return {
                    ...param,
                    predictionTrend: updatedTrend,
                  };
                } else if (param.varType === "CV") {
                  console.log(
                    `⚠️ CV parameter ${param.id} not found in predictions or not CV type`
                  );
                }
                return param;
              }),
            };
          },
          false,
          "updateCVPredictions"
        );
      },

      resetFeatures: () => {
        set(
          (state) => {
            const resetParameters = state.parameters.map((param) => {
              const bounds = state.parameterBounds[param.id] || [
                param.value,
                param.value,
              ];
              const defaultValue = (bounds[0] + bounds[1]) / 2;
              return {
                ...param,
                value: defaultValue,
              };
            });

            const resetSliderValues = resetParameters.reduce((acc, param) => {
              acc[param.id] = param.value;
              return acc;
            }, {} as Record<string, number>);

            return {
              parameters: resetParameters,
              sliderValues: resetSliderValues,
            };
          },
          false,
          "resetFeatures"
        );
      },

      resetSliders: () => {
        set(
          (state) => {
            const resetSliderValues = state.parameters.reduce((acc, param) => {
              const bounds = state.parameterBounds[param.id] || [
                param.value,
                param.value,
              ];
              acc[param.id] = (bounds[0] + bounds[1]) / 2;
              return acc;
            }, {} as Record<string, number>);

            // Also reset sliderSP values
            const resetParameters = state.parameters.map((param) => {
              const bounds = state.parameterBounds[param.id] || [
                param.value,
                param.value,
              ];
              const midValue = (bounds[0] + bounds[1]) / 2;
              return {
                ...param,
                sliderSP: midValue,
                predictionTrend:
                  param.varType === "CV" ? [] : param.predictionTrend,
              };
            });

            return {
              sliderValues: resetSliderValues,
              parameters: resetParameters,
            };
          },
          false,
          "resetSliders"
        );
      },

      getMVSliderValues: (): Record<string, number> => {
        const { parameters } = get();
        const mvSliderValues: Record<string, number> = {};

        parameters.forEach((param) => {
          if (param.varType === "MV") {
            mvSliderValues[param.id] = param.sliderSP;
          }
        });

        return mvSliderValues;
      },

      getDVSliderValues: (dvFeatures?: string[]): Record<string, number> => {
        const { parameters } = get();
        const dvSliderValues: Record<string, number> = {};

        parameters.forEach((param) => {
          if (param.varType === "DV") {
            // If dvFeatures filter is provided, only include DVs that are in the list
            if (!dvFeatures || dvFeatures.includes(param.id)) {
              // Use sliderSP if available, otherwise use value
              dvSliderValues[param.id] = param.sliderSP || param.value;
            }
          }
        });

        return dvSliderValues;
      },

      initializeMVSlidersWithPVs: (xgboostParameters?: any[]) => {
        console.log(
          "🔄 Initializing MV slider values with current PV values..."
        );

        set(
          (state) => {
            const updatedParameters = state.parameters.map((param) => {
              // Only update MV parameters (Manipulated Variables)
              if (param.varType === "MV") {
                // Find the corresponding parameter in XGBoost store to get current PV value
                const xgboostParam = xgboostParameters?.find(
                  (p) => p.id === param.id
                );
                const currentPV = xgboostParam?.value ?? param.value;

                console.log(
                  `📊 Setting MV slider ${param.id} from PV: ${currentPV} (XGBoost: ${xgboostParam?.value}, Cascade: ${param.value})`
                );
                return {
                  ...param,
                  sliderSP: currentPV, // Set slider SP to current PV value from XGBoost store
                };
              }
              return param;
            });

            return {
              parameters: updatedParameters,
            };
          },
          false,
          "initializeMVSlidersWithPVs"
        );

        // Log the updated MV slider values
        const mvValues = get().getMVSliderValues();
        console.log("✅ MV sliders initialized with PV values:", mvValues);
      },

      // Target actions
      setPredictedTarget: (value: number) => {
        set({ currentTarget: value }, false, "setPredictedTarget");
      },

      addTargetDataPoint: (pv: number, sp?: number) => {
        set(
          (state) => {
            const target = sp || state.currentTarget;
            const newDataPoint: TargetData = {
              timestamp: Date.now(),
              value: pv,
              target: target,
              pv: pv,
              sp: sp,
            };

            const updatedTargetData = [...state.targetData, newDataPoint].slice(
              -50
            ); // Keep last 50 points

            return {
              targetData: updatedTargetData,
              currentPV: pv,
              currentTarget: target,
            };
          },
          false,
          "addTargetDataPoint"
        );
      },

      setSimulationTarget: (value: number | null) => {
        console.log(
          "🟣 PURPLE SP UPDATED - setSimulationTarget called with:",
          value?.toFixed(2) ?? "null"
        );
        set({ simulationTarget: value }, false, "setSimulationTarget");
      },

      // Real-time data actions (removed - using XGBoost store instead)

      // Prediction actions (removed - using hardcoded defaults instead)

      // Utility function to get tag ID
      getTagId: (millNumber: number, featureName: string): string | null => {
        // This would implement the tag ID lookup logic
        // For now, return a simulated tag ID
        return `Mill${millNumber}_${featureName}`;
      },
    }),
    {
      name: "cascade-optimization-store",
    }
  )
);
