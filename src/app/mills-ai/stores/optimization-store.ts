import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Types for optimization
export interface OptimizationConfig {
  model_id: string
  target_setpoint: number
  parameter_bounds: Record<string, [number, number]>
  iterations: number
  maximize: boolean
}

export interface OptimizationResult {
  id: string
  timestamp: number
  config: OptimizationConfig
  best_parameters: Record<string, number>
  best_score: number
  optimization_history: Array<{
    iteration: number
    parameters: Record<string, number>
    score: number
  }>
  convergence_data: Array<{
    iteration: number
    best_score: number
  }>
  feature_importance?: Record<string, number>
  recommendations?: string[]
  duration_seconds: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  error_message?: string
}

export interface OptimizationState {
  // Configuration
  targetSetpoint: number
  parameterBounds: Record<string, [number, number]>
  iterations: number
  maximize: boolean
  
  // Status
  isOptimizing: boolean
  optimizationProgress: number
  currentOptimizationId: string | null
  
  // Results
  currentResults: OptimizationResult | null
  optimizationHistory: OptimizationResult[]
  bestParameters: Record<string, number> | null
  
  // Actions
  setTargetSetpoint: (value: number) => void
  updateParameterBounds: (id: string, bounds: [number, number]) => void
  setParameterBounds: (bounds: Record<string, [number, number]>) => void
  setIterations: (iterations: number) => void
  setMaximize: (maximize: boolean) => void
  
  // Optimization control
  startOptimization: (config: OptimizationConfig) => void
  stopOptimization: () => void
  updateProgress: (progress: number) => void
  setOptimizationId: (id: string) => void
  
  // Results management
  setResults: (results: OptimizationResult) => void
  addToHistory: (results: OptimizationResult) => void
  clearResults: () => void
  clearHistory: () => void
  
  // Utility
  getOptimizationConfig: (modelId: string) => OptimizationConfig
  resetToDefaults: () => void
}

const initialState = {
  targetSetpoint: 50.0,
  parameterBounds: {},
  iterations: 50,
  maximize: true,
  isOptimizing: false,
  optimizationProgress: 0,
  currentOptimizationId: null,
  currentResults: null,
  optimizationHistory: [],
  bestParameters: null,
}

export const useOptimizationStore = create<OptimizationState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Configuration actions
      setTargetSetpoint: (value: number) => {
        set({ targetSetpoint: value }, false, 'setTargetSetpoint')
      },

      updateParameterBounds: (id: string, bounds: [number, number]) => {
        set(
          (state) => ({
            parameterBounds: {
              ...state.parameterBounds,
              [id]: bounds,
            },
          }),
          false,
          'updateParameterBounds'
        )
      },

      setParameterBounds: (bounds: Record<string, [number, number]>) => {
        set({ parameterBounds: bounds }, false, 'setParameterBounds')
      },

      setIterations: (iterations: number) => {
        set({ iterations }, false, 'setIterations')
      },

      setMaximize: (maximize: boolean) => {
        set({ maximize }, false, 'setMaximize')
      },

      // Optimization control
      startOptimization: (config: OptimizationConfig) => {
        const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
      setResults: (results: OptimizationResult) => {
        set(
          {
            currentResults: results,
            bestParameters: results.best_parameters,
            isOptimizing: results.status === 'running',
            optimizationProgress: results.status === 'completed' ? 100 : get().optimizationProgress,
          },
          false,
          'setResults'
        )
      },

      addToHistory: (results: OptimizationResult) => {
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
            bestParameters: null,
            optimizationProgress: 0,
          },
          false,
          'clearResults'
        )
      },

      clearHistory: () => {
        set({ optimizationHistory: [] }, false, 'clearHistory')
      },

      // Utility functions
      getOptimizationConfig: (modelId: string): OptimizationConfig => {
        const state = get()
        return {
          model_id: modelId,
          target_setpoint: state.targetSetpoint,
          parameter_bounds: state.parameterBounds,
          iterations: state.iterations,
          maximize: state.maximize,
        }
      },

      resetToDefaults: () => {
        set(
          {
            ...initialState,
            // Preserve history and current results
            optimizationHistory: get().optimizationHistory,
            currentResults: get().currentResults,
          },
          false,
          'resetToDefaults'
        )
      },
    }),
    {
      name: 'optimization-store',
    }
  )
)
