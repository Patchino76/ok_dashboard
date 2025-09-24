import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { millsParameters } from '../../data/mills-parameters'

// Parameter interface for cascade store
export interface CascadeParameter {
  id: string
  name: string
  unit: string
  value: number
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
  varType?: 'MV' | 'CV' | 'DV'
  isLab?: boolean
}

// Target data interface - compatible with CascadeTargetTrend component
export interface TargetData {
  timestamp: number
  value: number  // Current PV value
  target: number // Target/setpoint value
  pv: number     // Process variable (same as value)
  sp?: number | null // Setpoint (same as target)
}

// Cascade-specific optimization interfaces
export interface CascadeOptimizationConfig {
  mill_number: number
  mv_bounds: Record<string, [number, number]>  // Manipulated variables bounds
  cv_bounds: Record<string, [number, number]>  // Controlled variables bounds  
  dv_values: Record<string, number>            // Disturbance variables values
  target_variable: string
  target_setpoint?: number
  maximize?: boolean
  n_trials?: number
  timeout_seconds?: number
}

export interface CascadeOptimizationResult {
  id: string
  timestamp: number
  config: CascadeOptimizationConfig
  best_mv_values: Record<string, number>       // Optimized MV values
  predicted_cvs: Record<string, number>        // Predicted CV values
  predicted_target: number                     // Predicted target value
  is_feasible: boolean
  constraint_violations: string[]
  optimization_history: Array<{
    trial: number
    mv_values: Record<string, number>
    predicted_target: number
    is_feasible: boolean
  }>
  convergence_data: Array<{
    trial: number
    best_target: number
  }>
  duration_seconds: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  error_message?: string
}

export interface CascadeOptimizationState {
  // Configuration
  millNumber: number
  targetVariable: string
  targetSetpoint: number
  maximize: boolean
  nTrials: number
  timeoutSeconds: number
  
  // Parameter bounds for optimization
  mvBounds: Record<string, [number, number]>   // Manipulated variables bounds
  cvBounds: Record<string, [number, number]>   // Controlled variables bounds
  dvValues: Record<string, number>             // Disturbance variables current values
  
  // Settings
  autoApplyResults: boolean
  
  // Status
  isOptimizing: boolean
  optimizationProgress: number
  currentOptimizationId: string | null
  
  // Results
  currentResults: CascadeOptimizationResult | null
  optimizationHistory: CascadeOptimizationResult[]
  bestMVValues: Record<string, number> | null
  proposedSetpoints: Record<string, number> | null
  
  // CASCADE-SPECIFIC STATE (migrated from xgboost-store)
  // Model state
  modelName: string | null
  modelFeatures: string[]
  modelTarget: string | null
  lastTrained: string | null
  availableModels: Record<string, any>
  
  // Parameter state
  parameters: CascadeParameter[]
  parameterBounds: Record<string, [number, number]>
  sliderValues: Record<string, number>
  
  // Target state
  currentTarget: number
  currentPV: number
  targetData: TargetData[]
  
  // Real-time data state (removed - using XGBoost store instead)
  
  // Actions - Configuration
  setMillNumber: (mill: number) => void
  setTargetVariable: (variable: string) => void
  setTargetSetpoint: (value: number) => void
  setMaximize: (maximize: boolean) => void
  setNTrials: (trials: number) => void
  setTimeoutSeconds: (seconds: number) => void
  
  // Actions - Parameter bounds
  updateMVBounds: (id: string, bounds: [number, number]) => void
  setMVBounds: (bounds: Record<string, [number, number]>) => void
  updateCVBounds: (id: string, bounds: [number, number]) => void
  setCVBounds: (bounds: Record<string, [number, number]>) => void
  updateDVValue: (id: string, value: number) => void
  setDVValues: (values: Record<string, number>) => void
  
  // Actions - Optimization control
  startOptimization: (config: CascadeOptimizationConfig) => void
  stopOptimization: () => void
  updateProgress: (progress: number) => void
  setOptimizationId: (id: string) => void
  
  // Actions - Results management
  setResults: (results: CascadeOptimizationResult) => void
  addToHistory: (results: CascadeOptimizationResult) => void
  clearResults: () => void
  clearHistory: () => void
  
  // Actions - Proposed setpoints management
  setProposedSetpoints: (setpoints: Record<string, number>) => void
  clearProposedSetpoints: () => void
  setAutoApplyResults: (auto: boolean) => void
  
  // CASCADE-SPECIFIC ACTIONS (migrated from xgboost-store)
  // Model actions
  setModelName: (name: string) => void
  setModelMetadata: (features: string[], target: string, lastTrained: string) => void
  setAvailableModels: (models: Record<string, any>) => void
  
  // Parameter actions
  updateSliderValue: (id: string, value: number) => void
  updateParameterFromRealData: (id: string, value: number, trend: Array<{ timestamp: number; value: number }>) => void
  resetFeatures: () => void
  resetSliders: () => void
  
  // Target actions
  setPredictedTarget: (value: number) => void
  addTargetDataPoint: (pv: number, sp?: number) => void
  
  // Real-time data actions (removed - using XGBoost store instead)
  
  // Prediction actions (removed - using hardcoded defaults instead)
  
  // Utility functions
  getOptimizationConfig: () => CascadeOptimizationConfig
  resetToDefaults: () => void
  hasValidConfiguration: () => boolean
  getTagId: (millNumber: number, featureName: string) => string | null
}

const initialState = {
  // Configuration defaults
  millNumber: 7,
  targetVariable: 'PSI200',
  targetSetpoint: 50.0,
  maximize: false, // Typically minimize PSI for better quality
  nTrials: 50,
  timeoutSeconds: 300, // 5 minutes
  
  // Parameter bounds (will be populated from model metadata)
  mvBounds: {},
  cvBounds: {},
  dvValues: {},
  
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
  
  // CASCADE-SPECIFIC STATE (migrated from xgboost-store)
  // Model state
  modelName: null,
  modelFeatures: [],
  modelTarget: null,
  lastTrained: null,
  availableModels: {},
  
  // Parameter state
  parameters: millsParameters.map(param => ({
    ...param,
    trend: [],
    varType: undefined,
  })),
  parameterBounds: millsParameters.reduce((acc, param) => {
    acc[param.id] = [param.min, param.max];
    return acc;
  }, {} as Record<string, [number, number]>),
  sliderValues: {},
  
  // Target state
  currentTarget: 0,
  currentPV: 0,
  targetData: [],
  
  // Real-time data state (removed - using XGBoost store instead)
}

export const useCascadeOptimizationStore = create<CascadeOptimizationState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Configuration actions
      setMillNumber: (mill: number) => {
        set({ millNumber: mill }, false, 'setMillNumber')
      },

      setTargetVariable: (variable: string) => {
        set({ targetVariable: variable }, false, 'setTargetVariable')
      },

      setTargetSetpoint: (value: number) => {
        set({ targetSetpoint: value }, false, 'setTargetSetpoint')
      },

      setMaximize: (maximize: boolean) => {
        set({ maximize }, false, 'setMaximize')
      },

      setNTrials: (trials: number) => {
        set({ nTrials: Math.max(1, Math.min(1000, trials)) }, false, 'setNTrials')
      },

      setTimeoutSeconds: (seconds: number) => {
        set({ timeoutSeconds: Math.max(30, Math.min(3600, seconds)) }, false, 'setTimeoutSeconds')
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
          'updateMVBounds'
        )
      },

      setMVBounds: (bounds: Record<string, [number, number]>) => {
        set({ mvBounds: bounds }, false, 'setMVBounds')
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
          'updateCVBounds'
        )
      },

      setCVBounds: (bounds: Record<string, [number, number]>) => {
        set({ cvBounds: bounds }, false, 'setCVBounds')
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
          'updateDVValue'
        )
      },

      setDVValues: (values: Record<string, number>) => {
        set({ dvValues: values }, false, 'setDVValues')
      },

      // Optimization control
      startOptimization: (config: CascadeOptimizationConfig) => {
        const optimizationId = `cascade_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        set(
          {
            isOptimizing: true,
            optimizationProgress: 0,
            currentOptimizationId: optimizationId,
            currentResults: null,
          },
          false,
          'startOptimization'
        )
      },

      stopOptimization: () => {
        set(
          {
            isOptimizing: false,
            optimizationProgress: 0,
            currentOptimizationId: null,
          },
          false,
          'stopOptimization'
        )
      },

      updateProgress: (progress: number) => {
        set({ optimizationProgress: Math.max(0, Math.min(100, progress)) }, false, 'updateProgress')
      },

      setOptimizationId: (id: string) => {
        set({ currentOptimizationId: id }, false, 'setOptimizationId')
      },

      // Results management
      setResults: (results: CascadeOptimizationResult) => {
        set(
          {
            currentResults: results,
            bestMVValues: results.best_mv_values,
            isOptimizing: results.status === 'running',
            optimizationProgress: results.status === 'completed' ? 100 : get().optimizationProgress,
          },
          false,
          'setResults'
        )
      },

      addToHistory: (results: CascadeOptimizationResult) => {
        set(
          (state) => ({
            optimizationHistory: [results, ...state.optimizationHistory].slice(0, 50), // Keep last 50 results
          }),
          false,
          'addToHistory'
        )
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
          'clearResults'
        )
      },

      clearHistory: () => {
        set({ optimizationHistory: [] }, false, 'clearHistory')
      },

      // Proposed setpoints management
      setProposedSetpoints: (setpoints: Record<string, number>) => {
        set({ proposedSetpoints: setpoints }, false, 'setProposedSetpoints')
      },

      clearProposedSetpoints: () => {
        set({ proposedSetpoints: null }, false, 'clearProposedSetpoints')
      },

      setAutoApplyResults: (auto: boolean) => {
        set({ autoApplyResults: auto }, false, 'setAutoApplyResults')
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
          timeoutSeconds 
        } = get()
        
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
        }
      },

      hasValidConfiguration: (): boolean => {
        const { mvBounds, cvBounds, dvValues, targetVariable } = get()
        return (
          Object.keys(mvBounds).length > 0 &&
          Object.keys(cvBounds).length > 0 &&
          Object.keys(dvValues).length > 0 &&
          targetVariable.length > 0
        )
      },
      
      resetToDefaults: () => {
        set({
          targetSetpoint: 50.0,
          maximize: false,
          nTrials: 50,
          timeoutSeconds: 300,
          autoApplyResults: false,
          mvBounds: {},
          cvBounds: {},
          dvValues: {},
        }, false, 'resetToDefaults')
      },

      // CASCADE-SPECIFIC ACTIONS IMPLEMENTATION
      // Model actions
      setModelName: (name: string) => {
        set({ modelName: name }, false, 'setModelName')
      },

      setModelMetadata: (features: string[], target: string, lastTrained: string) => {
        set({ 
          modelFeatures: features, 
          modelTarget: target, 
          lastTrained 
        }, false, 'setModelMetadata')
      },

      setAvailableModels: (models: Record<string, any>) => {
        set({ availableModels: models }, false, 'setAvailableModels')
      },

      // Parameter actions
      updateSliderValue: (id: string, value: number) => {
        set((state) => ({
          sliderValues: {
            ...state.sliderValues,
            [id]: value,
          },
          parameters: state.parameters.map(param =>
            param.id === id ? { ...param, value } : param
          ),
        }), false, 'updateSliderValue')
      },

      updateParameterFromRealData: (id: string, value: number, trend: Array<{ timestamp: number; value: number }>) => {
        set((state) => ({
          parameters: state.parameters.map(param =>
            param.id === id ? { ...param, trend } : param
          ),
        }), false, 'updateParameterFromRealData')
      },

      resetFeatures: () => {
        set((state) => {
          const resetParameters = state.parameters.map(param => {
            const bounds = state.parameterBounds[param.id] || [param.value, param.value];
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
        }, false, 'resetFeatures')
      },

      resetSliders: () => {
        set((state) => {
          const resetSliderValues = state.parameters.reduce((acc, param) => {
            const bounds = state.parameterBounds[param.id] || [param.value, param.value];
            acc[param.id] = (bounds[0] + bounds[1]) / 2;
            return acc;
          }, {} as Record<string, number>);

          return { sliderValues: resetSliderValues };
        }, false, 'resetSliders')
      },

      // Target actions
      setPredictedTarget: (value: number) => {
        set({ currentTarget: value }, false, 'setPredictedTarget')
      },

      addTargetDataPoint: (pv: number, sp?: number) => {
        set((state) => {
          const target = sp || state.currentTarget;
          const newDataPoint: TargetData = {
            timestamp: Date.now(),
            value: pv,
            target: target,
            pv: pv,
            sp: sp,
          };

          const updatedTargetData = [...state.targetData, newDataPoint].slice(-50); // Keep last 50 points

          return {
            targetData: updatedTargetData,
            currentPV: pv,
            currentTarget: target,
          };
        }, false, 'addTargetDataPoint')
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
      name: 'cascade-optimization-store',
    }
  )
)
