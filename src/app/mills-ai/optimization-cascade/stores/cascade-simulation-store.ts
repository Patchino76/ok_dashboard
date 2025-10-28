import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// Simulation parameter interface
export interface SimulationParameter {
  id: string
  name: string
  unit: string
  value: number
  min: number
  max: number
  varType: "MV" | "CV" | "DV"
}

// Cascade prediction result
export interface CascadePrediction {
  predicted_target: number
  predicted_cvs: Record<string, number>
  is_feasible: boolean
  constraint_violations: string[]
  timestamp: number
  // GPR-specific fields
  cv_uncertainties?: Record<string, number>
  target_uncertainty?: number
}

// Simulation state interface
interface CascadeSimulationState {
  // Simulation parameters
  mvParameters: SimulationParameter[]
  cvParameters: SimulationParameter[]
  dvParameters: SimulationParameter[]
  
  // Current prediction results
  currentPrediction: CascadePrediction | null
  predictionHistory: CascadePrediction[]
  
  // Simulation state
  isSimulating: boolean
  isPredicting: boolean
  autoPredict: boolean
  debounceMs: number
  
  // Actions
  setMVParameters: (parameters: SimulationParameter[]) => void
  setCVParameters: (parameters: SimulationParameter[]) => void
  setDVParameters: (parameters: SimulationParameter[]) => void
  updateMVValue: (id: string, value: number) => void
  updateDVValue: (id: string, value: number) => void
  setCurrentPrediction: (prediction: CascadePrediction) => void
  addPredictionToHistory: (prediction: CascadePrediction) => void
  clearPredictionHistory: () => void
  setIsSimulating: (isSimulating: boolean) => void
  setIsPredicting: (isPredicting: boolean) => void
  setAutoPredict: (autoPredict: boolean) => void
  resetToDefaults: () => void
}

export const useCascadeSimulationStore = create<CascadeSimulationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    mvParameters: [],
    cvParameters: [],
    dvParameters: [],
    currentPrediction: null,
    predictionHistory: [],
    isSimulating: false,
    isPredicting: false,
    autoPredict: true,
    debounceMs: 500,

    // Actions
    setMVParameters: (parameters) => set({ mvParameters: parameters }),
    setCVParameters: (parameters) => set({ cvParameters: parameters }),
    setDVParameters: (parameters) => set({ dvParameters: parameters }),

    updateMVValue: (id, value) => set((state) => ({
      mvParameters: state.mvParameters.map(param =>
        param.id === id ? { ...param, value } : param
      )
    })),

    updateDVValue: (id, value) => set((state) => ({
      dvParameters: state.dvParameters.map(param =>
        param.id === id ? { ...param, value } : param
      )
    })),

    setCurrentPrediction: (prediction) => set({ currentPrediction: prediction }),

    addPredictionToHistory: (prediction) => set((state) => ({
      predictionHistory: [...state.predictionHistory.slice(-49), prediction] // Keep last 50
    })),

    clearPredictionHistory: () => set({ predictionHistory: [] }),

    setIsSimulating: (isSimulating) => set({ isSimulating }),
    setIsPredicting: (isPredicting) => set({ isPredicting }),
    setAutoPredict: (autoPredict) => set({ autoPredict }),

    resetToDefaults: () => set((state) => ({
      mvParameters: state.mvParameters.map(param => ({
        ...param,
        value: (param.min + param.max) / 2
      })),
      dvParameters: state.dvParameters.map(param => ({
        ...param,
        value: (param.min + param.max) / 2
      })),
      currentPrediction: null,
      predictionHistory: []
    }))
  }))
)
