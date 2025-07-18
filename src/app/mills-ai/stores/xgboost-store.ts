import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { millsTags } from "@/lib/tags/mills-tags"
import { fetchTagValue } from "@/hooks/useTagValue"
import { mlApiClient } from "@/lib/api-client"

interface Parameter {
  id: string
  name: string
  unit: string
  value: number
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
}

interface PredictionResponse {
  prediction: number;
  [key: string]: any;
}

interface TargetData {
  timestamp: number
  value: number
  target: number
  pv: number
  sp?: number // Optional setpoint value from prediction
}

type ParameterBounds = {
  [key: string]: [number, number] // [min, max]
}

// Type for mills tags keys
type TagKey = keyof typeof millsTags

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
  
  // Real-time data settings
  currentMill: number
  dataUpdateInterval: number | null
  
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
  
  // Real-time data actions
  setCurrentMill: (millNumber: number) => void
  fetchRealTimeData: () => Promise<void>
  startRealTimeUpdates: () => void
  stopRealTimeUpdates: () => void
  updateParameterFromRealData: (featureName: string, value: number, timestamp: number) => void
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
  DensityHC: [1600, 1900],
  MotorAmp: [180, 220],
  Shisti: [0.05, 0.3],
  Daiki: [0.1, 0.4],
  PumpRPM: [800, 1200],   // Typical pump RPM range for industrial applications
  Grano: [0.5, 5.0],      // Granularity measurement in mm
  Class_12: [20, 60]      // Percentage range for Class_12
}

// Utility function to get tag ID from mills tags
const getTagId = (targetKey: string, millNumber: number): number | null => {
  // Check if the targetKey exists in millsTags
  if (!millsTags || !(targetKey in millsTags)) {
    console.error(`Target ${targetKey} not found in millsTags`)
    return null
  }

  // Use type assertion to access the tags array
  const tags = millsTags[targetKey as TagKey] as Array<{id: number, name: string}>
  
  // Find the entry for the specific mill number
  const millName = `Mill${String(millNumber).padStart(2, '0')}`
  const tagInfo = tags.find((tag) => tag.name === millName)
  
  if (!tagInfo) {
    console.error(`Mill ${millNumber} (${millName}) not found for target ${targetKey}`)
    return null
  }

  return tagInfo.id
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
        
        // Real-time data settings
        currentMill: 8,
        dataUpdateInterval: null,
        
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
                    ].slice(-50) // Keep last 50 points
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
        },
        
        setCurrentMill: (millNumber) => 
          set({ currentMill: millNumber }),
        
        fetchRealTimeData: async () => {
          const state = useXgboostStore.getState();
          const { modelFeatures, modelTarget, currentMill } = state;
          
          if (!modelFeatures || modelFeatures.length === 0) {
            console.warn('No model features available for real-time data fetch');
            return;
          }

          console.log('Fetching real-time data for features:', modelFeatures);
          console.log('Model target:', modelTarget);
          console.log('Current mill:', currentMill);
          console.log('Available millsTags keys:', Object.keys(millsTags));

          try {
            // Create a mapping from model feature names to mills tags keys
            // Handle both uppercase and lowercase variations
            const featureMapping: Record<string, string> = {
              // Uppercase variations (from model)
              'Ore': 'Ore',
              'WaterMill': 'WaterMill', 
              'WaterZumpf': 'WaterZumpf',
              'ZumpfLevel': 'ZumpfLevel',
              'DensityHC': 'DensityHC',
              'PressureHC': 'PressureHC',
              'MotorAmp': 'MotorAmp',
              'PSI80': 'PSI80',
              'PumpRPM': 'PumpRPM',
              'Shisti': 'Shisti',
            };

            // Fetch real-time data for each feature
            const featurePromises = modelFeatures.map(async (featureName) => {
              console.log(`Processing feature: "${featureName}"`);
              
              // Map the feature name to the correct mills tags key
              const millsTagKey = featureMapping[featureName] || featureName;
              console.log(`Feature "${featureName}" mapped to millsTagKey: "${millsTagKey}"`);
              
              const tagId = getTagId(millsTagKey, currentMill);
              if (!tagId) {
                console.warn(`Could not find tag ID for feature ${featureName} (mapped to ${millsTagKey}) and mill ${currentMill}`);
                console.warn('Available millsTags keys:', Object.keys(millsTags));
                return null;
              }

              console.log(`Fetching data for feature ${featureName} -> tag ID ${tagId}`);

              try {
                const tagData = await fetchTagValue(tagId);
                console.log(`Received data for ${featureName}:`, tagData);
                
                if (tagData && typeof tagData.value === 'number') {
                  return {
                    featureName,
                    value: tagData.value,
                    timestamp: tagData.timestamp || Date.now()
                  };
                }
              } catch (error) {
                console.error(`Error fetching data for feature ${featureName}:`, error);
              }
              return null;
            });

            // Also fetch the target PV value (PSI80) if it's the model target
            let targetPromise = null;
            if (modelTarget === 'PSI80') {
              const targetTagId = getTagId('PSI80', currentMill);
              if (targetTagId) {
                console.log(`Fetching target PV data for PSI80 -> tag ID ${targetTagId}`);
                targetPromise = fetchTagValue(targetTagId).then(tagData => {
                  console.log('Received target PV data:', tagData);
                  if (tagData && typeof tagData.value === 'number') {
                    return {
                      value: tagData.value,
                      timestamp: tagData.timestamp || Date.now()
                    };
                  }
                  return null;
                }).catch(error => {
                  console.error('Error fetching target PV data:', error);
                  return null;
                });
              }
            }

            // Wait for all promises to resolve
            const [featureResults, targetResult] = await Promise.all([
              Promise.all(featurePromises),
              targetPromise
            ]);

            console.log('Real-time data results:', featureResults);
            console.log('Target PV result:', targetResult);
            
            // Update parameters with real-time data
            featureResults.forEach(result => {
              if (result) {
                console.log(`Updating parameter ${result.featureName} with value ${result.value}`);
                state.updateParameterFromRealData(result.featureName, result.value, result.timestamp);
              }
            });

            // Prepare feature data for prediction
            const validFeatureResults = featureResults.filter(result => result !== null);
            if (validFeatureResults.length > 0) {
              try {
                // Prepare data for prediction API call
                const predictionData: Record<string, number> = {};
                validFeatureResults.forEach(result => {
                  if (result) {
                    predictionData[result.featureName] = result.value;
                  }
                });

                console.log('Calling prediction API with data:', predictionData);
                
                // Call the prediction API
                const response = await mlApiClient.post<PredictionResponse>('/api/v1/ml/predict', {
                  model_id: 'xgboost_PSI80_mill8', // Using the model for mill 8
                  data: predictionData
                });

                console.log('Prediction API response:', response.data);
                
                // Extract the predicted SP value
                const predictedSP = response.data.prediction;
                console.log('Predicted SP value:', predictedSP);
                
                // Update current target with predicted SP
                set({ currentTarget: predictedSP });
              } catch (error) {
                console.error('Error calling prediction API:', error);
              }
            }

            // Update target PV and add to target data
            if (targetResult) {
              console.log(`Updating target PV with value ${targetResult.value}`);
              
              // Update current PV
              set({ currentPV: targetResult.value });
              
              // Add to target data for trend line with both PV and SP
              set(state => ({
                targetData: [
                  ...state.targetData,
                  {
                    timestamp: targetResult.timestamp,
                    value: targetResult.value,
                    target: state.currentTarget || 0,
                    pv: targetResult.value,
                    sp: state.currentTarget // Add SP to the trend data
                  }
                ].slice(-50) // Keep last 50 points for trend
              }));
            }
            
          } catch (error) {
            console.error('Error fetching real-time data:', error);
          }
        },
        
        startRealTimeUpdates: () => {
          const state = useXgboostStore.getState();
          
          // Stop any existing interval
          if (state.dataUpdateInterval) {
            clearInterval(state.dataUpdateInterval);
          }
          
          // Start new interval for real-time updates (every 10 seconds)
          const intervalId = setInterval(() => {
            state.fetchRealTimeData();
          }, 10000);
          
          set({ 
            dataUpdateInterval: intervalId,
            simulationActive: true 
          });
          
          // Fetch initial data immediately
          state.fetchRealTimeData();
        },
        
        stopRealTimeUpdates: () => {
          const state = useXgboostStore.getState();
          
          if (state.dataUpdateInterval) {
            clearInterval(state.dataUpdateInterval);
          }
          
          set({ 
            dataUpdateInterval: null,
            simulationActive: false 
          });
        },
        
        updateParameterFromRealData: (featureName, value, timestamp) => 
          set(state => ({
            parameters: state.parameters.map(param => 
              param.id === featureName 
                ? { 
                    ...param, 
                    value,
                    trend: [...param.trend, { timestamp, value }].slice(-50) // Keep last 50 points
                  } 
                : param
            )
          })),
      }),
      {
        name: "xgboost-simulation-storage"
      }
    )
  )
)
