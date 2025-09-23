import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

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
  
  // Utility functions
  getOptimizationConfig: () => CascadeOptimizationConfig
  resetToDefaults: () => void
  hasValidConfiguration: () => boolean
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
    }),
    {
      name: 'cascade-optimization-store',
    }
  )
)
