import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"

interface Parameter {
  id: string
  name: string
  unit: string
  value: number
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
}

interface TargetData {
  timestamp: number
  value: number
  target: number
}

type ParameterBounds = {
  [key: string]: [number, number] // [min, max]
}

interface XgboostState {
  // Parameters
  parameters: Parameter[]
  parameterBounds: ParameterBounds
  
  // Target data
  currentTarget: number | null
  targetData: TargetData[]
  
  // Model settings
  modelName: string
  
  // Actions
  updateParameter: (id: string, value: number) => void
  setPredictedTarget: (target: number) => void
  addTargetDataPoint: (dataPoint: TargetData) => void
  setModelName: (name: string) => void
}

// Icons for parameters
const parameterIcons: Record<string, string> = {
  Ore: "⛏️",
  WaterMill: "💧",
  WaterZumpf: "🌊",
  PressureHC: "📊",
  DensityHC: "🧪",
  MotorAmp: "⚡",
  Shisti: "🪨",
  Daiki: "🧬"
}

// Colors for parameters
const parameterColors: Record<string, string> = {
  Ore: "amber",
  WaterMill: "blue",
  WaterZumpf: "cyan",
  PressureHC: "red",
  DensityHC: "purple",
  MotorAmp: "yellow",
  Shisti: "green",
  Daiki: "orange"
}

// Units for parameters
const parameterUnits: Record<string, string> = {
  Ore: "t/h",
  WaterMill: "m³/h",
  WaterZumpf: "m³/h",
  PressureHC: "bar",
  DensityHC: "g/L",
  MotorAmp: "A",
  Shisti: "%",
  Daiki: "%"
}

// Parameter bounds from the requirements
const initialBounds: ParameterBounds = {
  Ore: [160.0, 200.0],
  WaterMill: [5.0, 20.0],
  WaterZumpf: [160.0, 250.0],
  PressureHC: [0.3, 0.5],
  DensityHC: [1600, 1800],
  MotorAmp: [180, 220],
  Shisti: [0.05, 0.3],
  Daiki: [0.1, 0.4]
}

export const useXgboostStore = create<XgboostState>()(
  devtools(
    persist(
      (set) => ({
        // Initialize parameters with default values (middle of the range)
        parameters: Object.entries(initialBounds).map(([id, [min, max]]) => ({
          id,
          name: id,
          unit: parameterUnits[id] || "",
          value: min + (max - min) / 2, // Default to middle of range
          trend: [],
          color: parameterColors[id] || "blue",
          icon: parameterIcons[id] || "📈"
        })),
        
        // Parameter bounds
        parameterBounds: initialBounds,
        
        // Target data
        currentTarget: null,
        targetData: [],
        
        // Default model name
        modelName: "xgboost_PSI80_mill8",
        
        // Actions
        updateParameter: (id, value) => 
          set((state) => ({
            parameters: state.parameters.map(param => 
              param.id === id 
                ? { 
                    ...param, 
                    value,
                    trend: [
                      ...param.trend, 
                      { timestamp: Date.now(), value }
                    ].slice(-20) // Keep last 20 points
                  } 
                : param
            )
          })),
          
        setPredictedTarget: (target) => 
          set({ currentTarget: target }),
          
        addTargetDataPoint: (dataPoint) => 
          set((state) => ({
            targetData: [...state.targetData, dataPoint].slice(-50) // Keep last 50 points
          })),
          
        setModelName: (modelName) => 
          set({ modelName })
      }),
      {
        name: "xgboost-simulation-storage"
      }
    )
  )
)
