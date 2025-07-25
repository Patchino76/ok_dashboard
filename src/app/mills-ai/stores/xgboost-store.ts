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
  sp?: number | null // Optional setpoint value from prediction
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
  sliderValues: Record<string, number>
  isSimulationMode: boolean
  currentTarget: number | null
  currentPV: number | null
  targetData: TargetData[]
  modelName: string
  availableModels: string[]
  modelFeatures: string[] | null
  modelTarget: string | null
  lastTrained: string | null
  currentMill: number
  dataUpdateInterval: NodeJS.Timeout | null
  resetSliders: boolean
  updateParameter: (id: string, value: number) => void
  updateSliderValue: (id: string, value: number) => void
  setSimulationMode: (isSimulation: boolean) => void
  setPredictedTarget: (target: number) => void
  addTargetDataPoint: (dataPoint: Omit<TargetData, 'pv'>) => void
  setModelName: (name: string) => void
  setAvailableModels: (models: string[]) => void
  setModelMetadata: (features: string[], target: string, lastTrained: string | null) => void
  startSimulation: () => void
  stopSimulation: () => void
  updateSimulatedPV: () => void
  resetSlidersToPVs: () => void
  predictWithCurrentValues: () => Promise<void>
  setCurrentMill: (millNumber: number) => void
  fetchRealTimeData: () => Promise<void>
  startRealTimeUpdates: () => void
  stopRealTimeUpdates: () => void
  updateParameterFromRealData: (featureName: string, value: number, timestamp: number, trend?: Array<{ timestamp: number; value: number }>) => void
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
  Class_12: "🔢",
  Class_15: "🔢"
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
  Class_12: "rose",
  Class_15: "rose"
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
  Class_12: "%",
  Class_15: "%"
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
  Class_12: [20, 60],     // Percentage range for Class_12
  Class_15: [20, 60]      // Percentage range for Class_15 (same as Class_12)
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
    // persist(
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
        
        // Slider values (separate from PV values)
        sliderValues: {
          "Ore": 190,
          "WaterMill": 15,
          "WaterZumpf": 200,
          "PressureHC": 0.4,
          "DensityHC": 1700,
          "MotorAmp": 200,
          "Shisti": 0.2,
          "Daiki": 0.3,
        },
        
        // Simulation mode switch
        isSimulationMode: false,
        
        // Target data
        currentTarget: null,
        currentPV: 50, // Initial PV value around 50
        targetData: [],
        
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
          
        updateSliderValue: (id, value) => 
          set((state) => ({
            sliderValues: {
              ...state.sliderValues,
              [id]: value
            }
          })),
          
        setSimulationMode: (isSimulation) => 
          set({ isSimulationMode: isSimulation }),
          
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
            // Generate simulated PV value (real-time updates are always active)
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
        
        startSimulation: () => {
          // Real-time updates are now always active, no state change needed
        },
          
        stopSimulation: () => {
          // Real-time updates are now always active, no state change needed
        },
          
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
          console.log('📊 fetchRealTimeData called');
          const state = useXgboostStore.getState();
          const { modelFeatures, modelTarget, currentMill } = state;
          
          console.log('State check:', {
            modelFeatures,
            modelTarget,
            currentMill,
            hasMillsTags: !!millsTags,
            millsTagsKeys: Object.keys(millsTags || {})
          });
          
          if (!modelFeatures || modelFeatures.length === 0) {
            console.warn('❌ No model features available for real-time data fetch');
            console.warn('Current modelFeatures:', modelFeatures);
            return;
          }

          console.log('✅ Fetching real-time data for features:', modelFeatures);
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
                // Fetch current tag value
                const tagData = await fetchTagValue(tagId);
                console.log(`Received data for ${featureName}:`, tagData);
                
                // Fetch trend data for this feature
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const trendResponse = await fetch(`${apiUrl}/api/tag-trend/${tagId}?hours=8`, {
                  headers: { 'Accept': 'application/json' },
                  cache: 'no-store'
                });
                
                let trendData = { timestamps: [], values: [] };
                if (trendResponse.ok) {
                  trendData = await trendResponse.json();
                  console.log(`Received trend data for ${featureName}:`, trendData);
                } else {
                  console.warn(`Failed to fetch trend data for ${featureName}: ${trendResponse.statusText}`);
                }
                
                // Process trend data into the format we need
                const trend = [];
                if (trendData.timestamps && trendData.values && 
                    Array.isArray(trendData.timestamps) && Array.isArray(trendData.values)) {
                  for (let i = 0; i < trendData.timestamps.length; i++) {
                    trend.push({
                      timestamp: new Date(trendData.timestamps[i]).getTime(),
                      value: trendData.values[i]
                    });
                  }
                }
                
                if (tagData && typeof tagData.value === 'number') {
                  return {
                    featureName,
                    value: tagData.value,
                    timestamp: tagData.timestamp || Date.now(),
                    trend
                  };
                }
              } catch (error) {
                console.error(`Error fetching data for feature ${featureName}:`, error);
              }
              return null;
            });

            // Also fetch the target PV value (PSI80) if it's the model target
            let targetPromise = null;
            let targetTrendPromise = null;
            if (modelTarget === 'PSI80') {
              const targetTagId = getTagId('PSI80', currentMill);
              if (targetTagId) {
                console.log(`Fetching target PV data for PSI80 -> tag ID ${targetTagId}`);
                
                // Fetch current target value
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
                
                // Fetch target trend data
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                targetTrendPromise = fetch(`${apiUrl}/api/tag-trend/${targetTagId}?hours=8`, {
                  headers: { 'Accept': 'application/json' },
                  cache: 'no-store'
                })
                .then(async response => {
                  if (response.ok) {
                    const data = await response.json();
                    console.log('Received target trend data:', data);
                    return data;
                  } else {
                    console.warn(`Failed to fetch target trend data: ${response.statusText}`);
                    return { timestamps: [], values: [] };
                  }
                })
                .catch(error => {
                  console.error('Error fetching target trend data:', error);
                  return { timestamps: [], values: [] };
                });
              }
            }

            // Wait for all promises to resolve
            const [featureResults, targetResult, targetTrendData] = await Promise.all([
              Promise.all(featurePromises),
              targetPromise,
              targetTrendPromise
            ]);

            console.log('Real-time data results:', featureResults);
            console.log('Target PV result:', targetResult);
            console.log('Target trend data:', targetTrendData);
            
            // Update parameters with real-time data
            featureResults.forEach(result => {
              if (result) {
                console.log(`Updating parameter ${result.featureName} with value ${result.value} and trend data`);
                state.updateParameterFromRealData(result.featureName, result.value, result.timestamp, result.trend);
              }
            });

            // Use our new clean dual data source prediction logic
            const validFeatureResults = featureResults.filter(result => result !== null);
            if (validFeatureResults.length > 0) {
              console.log('Real-time data updated, triggering prediction with current values');
              // Use the new predictWithCurrentValues function which handles dual data source logic
              await state.predictWithCurrentValues();
            }

            // Update target PV and add to target data
            if (targetResult) {
              console.log(`Updating target PV with value ${targetResult.value}`);
              
              // Update current PV
              set({ currentPV: targetResult.value });
              
              // Process target trend data if available
              let targetTrendPoints: TargetData[] = [];
              if (targetTrendData && targetTrendData.timestamps && targetTrendData.values &&
                  Array.isArray(targetTrendData.timestamps) && Array.isArray(targetTrendData.values)) {
                
                // Get the current target (SP) value
                const currentTarget = state.currentTarget || 0;
                
                // Convert API trend data to our format
                targetTrendPoints = targetTrendData.timestamps.map((timestamp: string, index: number) => ({
                  timestamp: new Date(timestamp).getTime(),
                  value: targetTrendData.values[index],
                  target: currentTarget,
                  pv: targetTrendData.values[index],
                  sp: currentTarget
                }));
                
                console.log('Processed target trend points:', targetTrendPoints);
              }
              
              // Add current point to target data
              const newDataPoint = {
                timestamp: targetResult.timestamp,
                value: targetResult.value,
                target: state.currentTarget || 0,
                pv: targetResult.value,
                sp: state.currentTarget // Add SP to the trend data
              };
              
              // Combine trend data with current point and keep last 50 points
              set(state => ({
                targetData: [
                  ...targetTrendPoints,
                  newDataPoint
                ].slice(-50) // Keep last 50 points for trend
              }));
            }
            
          } catch (error) {
            console.error('Error fetching real-time data:', error);
          }
        },
        
        startRealTimeUpdates: () => {
          console.log('🚀 startRealTimeUpdates called');
          const state = useXgboostStore.getState();
          console.log('Current state:', {
            modelFeatures: state.modelFeatures,
            modelName: state.modelName,
            currentMill: state.currentMill
          });
          
          // Stop any existing interval
          if (state.dataUpdateInterval) {
            console.log('🗑️ Clearing existing interval');
            clearInterval(state.dataUpdateInterval);
          }
          
          // Start new interval for real-time updates (every 1 minute)
          console.log('⏰ Setting up 1-minute interval for real-time updates');
          const intervalId = setInterval(() => {
            console.log('⏰ Interval triggered, calling fetchRealTimeData');
            state.fetchRealTimeData().catch(error => {
              console.error('Error in scheduled fetchRealTimeData:', error);
            });
          }, 60000); // 1 minute = 60000ms
          
          // Update the state with the new interval ID
          set({ 
            dataUpdateInterval: intervalId
          }, false, 'setRealTimeUpdateInterval');
          
          // Fetch initial data immediately
          console.log('📊 Fetching initial real-time data immediately');
          state.fetchRealTimeData().catch(error => {
            console.error('Error in initial fetchRealTimeData:', error);
          });
          
          // Return cleanup function
          return () => {
            console.log('🧹 Cleanup: Clearing interval in startRealTimeUpdates');
            clearInterval(intervalId);
          };
        },
        
        stopRealTimeUpdates: () => {
          const state = useXgboostStore.getState();
          
          if (state.dataUpdateInterval) {
            console.log('🛑 Stopping real-time updates');
            clearInterval(state.dataUpdateInterval);
          }
          
          set({ 
            dataUpdateInterval: null
          }, false, 'stopRealTimeUpdates');
        },
        
        updateParameterFromRealData: (featureName, value, timestamp, trend = []) => 
          set(state => {
            // Update slider values in real-time mode to keep them in sync
            const updatedSliderValues = state.isSimulationMode 
              ? state.sliderValues // Preserve slider values in simulation mode
              : { ...state.sliderValues, [featureName]: value }; // Update slider values in real-time mode
              
            return {
              parameters: state.parameters.map(param => 
                param.id === featureName 
                  ? { 
                      ...param, 
                      // In real-time mode: update both value and trend
                      // In simulation mode: only update trend (preserve user slider values)
                      value: state.isSimulationMode ? param.value : value,
                      // Update trend data
                      trend: Array.isArray(trend) && trend.length > 0 
                        ? trend // Use the entire fetched trend data
                        : [...param.trend, { timestamp, value }].slice(-50) // Add current point to existing trend
                    } 
                  : param
              ),
              sliderValues: updatedSliderValues
            };
          }),
          
        resetSlidersToPVs: () => {
          set(state => {
            const updatedSliderValues = { ...state.sliderValues };
            
            // Assign the current real-time PV values to the slider values
            state.parameters.forEach(param => {
              updatedSliderValues[param.id] = param.value;
            });
            
            console.log('Reset sliders to current PV values', updatedSliderValues);
            
            return { 
              sliderValues: updatedSliderValues,
              resetSliders: !state.resetSliders  // Toggle the reset flag
            };
          });
        },

        predictWithCurrentValues: async () => {
          const state = useXgboostStore.getState();
          const { modelFeatures, modelName, isSimulationMode, parameters, sliderValues } = state;
          
          if (!modelFeatures || modelFeatures.length === 0) {
            console.warn('No model features available for prediction');
            return;
          }
          
          // DEBUG: Log current model state
          console.log('🔍 PREDICTION DEBUG:');
          console.log('Model name:', modelName);
          console.log('Model features from store:', modelFeatures);
          console.log('Model features length:', modelFeatures.length);
          console.log('Is simulation mode:', isSimulationMode);
          console.log('Available parameters:', parameters.map(p => p.id));
          console.log('Slider values:', sliderValues);
          
          try {
            // Build prediction data from appropriate source
            const predictionData: Record<string, number> = {};
            
            if (isSimulationMode) {
              // Use slider values for prediction
              console.log('🎯 Simulation mode: Using slider values for prediction');
              modelFeatures.forEach(featureName => {
                if (sliderValues[featureName] !== undefined) {
                  predictionData[featureName] = sliderValues[featureName];
                }
              });
            } else {
              // Use PV values for prediction
              console.log('📊 Real-time mode: Using PV values for prediction');
              modelFeatures.forEach(featureName => {
                const parameter = parameters.find(p => p.id === featureName);
                if (parameter) {
                  predictionData[featureName] = parameter.value;
                }
              });
            }
            
            console.log('Prediction data (only model features):', predictionData);
            
            // Call prediction API with correct payload structure
            const response = await mlApiClient.post('/api/v1/ml/predict', {
              model_id: modelName,
              data: predictionData  // API expects 'data' field, not 'features'
            });
            
            if (response.data && typeof response.data.prediction === 'number') {
              const prediction = response.data.prediction;
              console.log('✅ Prediction successful:', prediction);
              
              // Update target with prediction
              set({ currentTarget: prediction });
              
              // Add to target data for trending
              const timestamp = Date.now();
              set(state => ({
                targetData: [
                  ...state.targetData,
                  {
                    timestamp,
                    value: prediction,
                    target: prediction,
                    sp: prediction,
                    pv: state.currentPV || 50
                  }
                ].slice(-50)
              }));
            } else {
              console.error('Invalid prediction response:', response.data);
            }
          } catch (error) {
            console.error('❌ Prediction failed:', error);
          }
        },
      })
      // {
      //   name: "xgboost-simulation-storage"
      // }
    // )
  )
)
