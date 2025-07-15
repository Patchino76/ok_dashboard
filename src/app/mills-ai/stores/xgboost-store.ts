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
  pv: number
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
  currentPV: number | null
  targetData: TargetData[]
  simulationActive: boolean
  
  // Model settings
  modelName: string
  availableModels: string[]
  modelFeatures: string[] | null
  modelTarget: string | null
  lastTrained: string | null
  
  // Actions
  updateParameter: (id: string, value: number) => void
  setPredictedTarget: (target: number) => void
  addTargetDataPoint: (dataPoint: Omit<TargetData, 'pv'>) => void
  setModelName: (name: string) => void
  setAvailableModels: (models: string[]) => void
  setModelMetadata: (features: string[], target: string, lastTrained: string | null) => void
  startSimulation: () => void
  stopSimulation: () => void
  updateSimulatedPV: () => void
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
  Daiki: "🧬",
  PumpRPM: "🔄",
  Grano: "📏",
  Class_12: "🔢"
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
  Daiki: "orange",
  PumpRPM: "indigo",
  Grano: "slate",
  Class_12: "rose"
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
  Daiki: "%",
  PumpRPM: "rpm",
  Grano: "mm",
  Class_12: "%"
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
  Daiki: [0.1, 0.4],
  PumpRPM: [800, 1200],   // Typical pump RPM range for industrial applications
  Grano: [0.5, 5.0],      // Granularity measurement in mm
  Class_12: [20, 60]      // Percentage range for Class_12
}

export const useXgboostStore = create<XgboostState>()(
  devtools(
    persist(
      (set) => ({
        // Initialize parameters with default values (middle of the range)
        parameters: [
          {
            id: "Ore",
            name: "Ore Input",
            unit: "t/h",
            value: 190,
            trend: [],
            color: parameterColors.Ore,
            icon: parameterIcons.Ore,
          },
          {
            id: "WaterMill",
            name: "Water Mill",
            unit: "m³/h",
            value: 15,
            trend: [],
            color: parameterColors.WaterMill,
            icon: parameterIcons.WaterMill,
          },
          {
            id: "WaterZumpf",
            name: "Water Zumpf",
            unit: "m³/h",
            value: 200,
            trend: [],
            color: parameterColors.WaterZumpf,
            icon: parameterIcons.WaterZumpf,
          },
          {
            id: "PressureHC",
            name: "HC Pressure",
            unit: "bar",
            value: 0.4,
            trend: [],
            color: parameterColors.PressureHC,
            icon: parameterIcons.PressureHC,
          },
          {
            id: "DensityHC",
            name: "HC Density",
            unit: "g/L",
            value: 1700,
            trend: [],
            color: parameterColors.DensityHC,
            icon: parameterIcons.DensityHC,
          },
          {
            id: "MotorAmp",
            name: "Motor Amperage",
            unit: "A",
            value: 200,
            trend: [],
            color: parameterColors.MotorAmp,
            icon: parameterIcons.MotorAmp,
          },
          {
            id: "Shisti",
            name: "Shisti",
            unit: "%",
            value: 0.2,
            trend: [],
            color: parameterColors.Shisti,
            icon: parameterIcons.Shisti,
          },
          {
            id: "Daiki",
            name: "Daiki",
            unit: "%",
            value: 0.3,
            trend: [],
            color: parameterColors.Daiki,
            icon: parameterIcons.Daiki,
          },
        ],
        
        // Parameter bounds
        parameterBounds: initialBounds,
        
        // Target data
        currentTarget: null,
        currentPV: 50, // Initial PV value around 50
        targetData: [],
        simulationActive: false,
        
        // Model settings
        modelName: "xgboost_PSI80_mill8",
        availableModels: [],
        modelFeatures: null,
        modelTarget: null,
        lastTrained: null,
        
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
          set((state) => {
            // Generate a simulated PV value around 50 (with random variation)
            const basePV = state.currentPV || 50
            const variation = (Math.random() * 2 - 1) * 2 // Random variation between -2 and +2
            const pv = Math.max(45, Math.min(55, basePV + variation)) // Keep between 45-55
            
            // Update current PV
            return {
              currentPV: pv,
              targetData: [...state.targetData, { ...dataPoint, pv }].slice(-50) // Keep last 50 points
            }
          }),
        
        updateSimulatedPV: () =>
          set((state) => {
            if (!state.simulationActive) return {}
            
            // Only update if simulation is active
            // Generate a simulated PV value around 50 (with random variation)
            const basePV = state.currentPV || 50
            const variation = (Math.random() * 2 - 1) * 1 // Random variation between -1 and +1
            const pv = Math.max(45, Math.min(55, basePV + variation)) // Keep between 45-55
            
            // Add to trend data
            const timestamp = Date.now()
            const targetValue = state.currentTarget || 50 // Use current target or default to 50
            
            return {
              currentPV: pv,
              targetData: [...state.targetData, { 
                timestamp, 
                value: targetValue, 
                target: targetValue,
                pv
              }].slice(-50) // Keep last 50 points
            }
          }),
        
        startSimulation: () =>
          set({ simulationActive: true }),
          
        stopSimulation: () =>
          set({ simulationActive: false }),
          
        setModelName: (modelName) => 
          set({ modelName }),
          
        setAvailableModels: (models) =>
          set({ availableModels: models }),
          
        setModelMetadata: (features, target, lastTrained) => {
          // First update the basic metadata
          set({ 
            modelFeatures: features,
            modelTarget: target,
            lastTrained
          });
          
          // Then ensure parameters array includes all necessary features
          if (features && features.length > 0) {
            set(state => {
              // Keep track of existing parameter IDs
              const existingParamIds = state.parameters.map(p => p.id);
              
              // Create array for new parameters that need to be added
              const newParameters: Parameter[] = [];
              
              // For each feature in the model, check if we need to add it
              features.forEach(featureId => {
                if (!existingParamIds.includes(featureId)) {
                  // This feature doesn't exist in parameters yet, add it
                  // with sensible defaults
                  newParameters.push({
                    id: featureId,
                    name: featureId, // Use ID as name if no better name available
                    unit: parameterUnits[featureId] || '',
                    value: initialBounds[featureId] ? 
                      (initialBounds[featureId][0] + initialBounds[featureId][1]) / 2 : 0,
                    trend: [],
                    color: parameterColors[featureId] || 'gray',
                    icon: parameterIcons[featureId] || '📊'
                  });
                }
              });
              
              // If we have new parameters, add them to the state
              if (newParameters.length > 0) {
                console.log('Adding new parameters for model:', newParameters);
                return {
                  parameters: [...state.parameters, ...newParameters]
                };
              }
              
              // No changes needed
              return {};
            });
          }
        }
      }),
      {
        name: "xgboost-simulation-storage"
      }
    )
  )
)
