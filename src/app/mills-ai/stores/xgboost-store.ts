import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { millsTags } from "@/lib/tags/mills-tags"
import { fetchTagValue } from "@/hooks/useTagValue"
import { mlApiClient } from "@/lib/api-client"
import { millsParameters } from "../data/mills-parameters"

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
  isFetching: boolean
  resetSliders: boolean
  displayHours: number
  lastFetchedHours: number
  updateParameter: (id: string, value: number) => void
  updateSliderValue: (id: string, value: number) => void
  setSimulationMode: (isSimulation: boolean) => void
  setPredictedTarget: (target: number) => void
  addTargetDataPoint: (dataPoint: Omit<TargetData, 'pv'>) => void
  setModelName: (name: string) => Promise<void>
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
  resetFeatures: () => void
  setDisplayHours: (hours: number) => void
}

// Icons for parameters
const parameterIcons: Record<string, string> = {
  Ore: "⛏️",
  WaterMill: "💧",
  WaterZumpf: "🌊",
  PulpHC: "🌊",
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
  PulpHC: "cyan",
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
  PulpHC: "m³/h",
  PressureHC: "bar",
  DensityHC: "kg/m³",
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
  PulpHC: [300, 600],
  PressureHC: [0.25, 0.55],
  DensityHC: [1500, 1900],
  MotorAmp: [160, 240],
  Shisti: [0, 35],
  Daiki: [10, 60],
  PumpRPM: [700, 1200],   // Typical pump RPM range for industrial applications
  Grano: [30, 80],      // Granularity measurement in mm
  Class_12: [4, 15],     // Percentage range for Class_12
  Class_15: [0.5, 2.5]      // Percentage range for Class_15 (same as Class_12)
}

// Retain up to this many hours of history in memory for trends/targetData.
// UI components can display any window within this retention (e.g., 2h, 8h, 24h, 72h)
const TREND_RETENTION_HOURS = 72;

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
        // Display hours for trend data (default: 4 hours)
        displayHours: 4,
        // Track the hours value used in the last fetch
        lastFetchedHours: 0,
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
            unit: "kg/m³",
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
            value: 5,
            trend: [],
            color: parameterColors.Shisti,
            icon: parameterIcons.Shisti,
          },
          {
            id: "Daiki",
            name: "Daiki",
            unit: "%",
            value: 30,
            trend: [],
            color: parameterColors.Daiki,
            icon: parameterIcons.Daiki,
          },
        ],
        
        // Parameter bounds
        parameterBounds: initialBounds,
        
        // Slider values (separate from PV values)
        sliderValues: {
          // "Ore": 190,
          // "WaterMill": 15,
          // "WaterZumpf": 200,
          // "PressureHC": 0.4,
          // "DensityHC": 1700,
          // "MotorAmp": 200,
          // "Shisti": 0.2,
          // "Daiki": 0.3,
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
        isFetching: false,
        
        // Clear target data
        clearTargetData: () => {
          set({ targetData: [] });
        },

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
              // Keep only points from the last TREND_RETENTION_HOURS
              targetData: (() => {
                const retentionAgo = Date.now() - TREND_RETENTION_HOURS * 60 * 60 * 1000;
                const next = [...state.targetData, { ...dataPoint, pv }];
                return next.filter(p => p.timestamp >= retentionAgo);
              })()
            }
          }),
        
        updateSimulatedPV: () =>
          set((state) => {
            // Use the current PV or default to 50
            const pv = state.currentPV || 50;
            
            // Add to trend data
            const timestamp = Date.now();
            const targetValue = state.currentTarget || 50; // Use current target or default to 50
            
            return {
              currentPV: pv,
              // Keep only points from the last TREND_RETENTION_HOURS
              targetData: (() => {
                const retentionAgo = Date.now() - TREND_RETENTION_HOURS * 60 * 60 * 1000;
                const next = [...state.targetData, {
                  timestamp,
                  value: targetValue,
                  target: targetValue,
                  pv
                }];
                return next.filter(p => p.timestamp >= retentionAgo);
              })()
            }
          }),
        
        startSimulation: () => {
          // Real-time updates are now always active, no state change needed
        },
          
        stopSimulation: () => {
          // Real-time updates are now always active, no state change needed
        },
          
        setModelName: async (modelName) => {
          const currentState = useXgboostStore.getState();
          if (currentState.modelName !== modelName) {
            console.log('Setting model name to:', modelName);
            
            // Stop any existing real-time update interval to prevent stale fetches
            try {
              currentState.stopRealTimeUpdates();
            } catch (e) {
              console.warn('stopRealTimeUpdates raised an error (safe to ignore):', e);
            }

            // Reset state and clear metadata so no fetch will run with stale model info
            set({ 
              modelName,
              targetData: [],
              currentTarget: null,
              currentPV: null,
              modelFeatures: null,
              modelTarget: null,
              lastTrained: null
            });

            // Do NOT fetch here. Dashboard will call setModelMetadata() and then
            // startRealTimeUpdates(), which performs an immediate fetch with correct metadata.
          }
        },
          
        setAvailableModels: (models) =>
          set({ availableModels: models }),
          
        setModelMetadata: (features, target, lastTrained) => {
          console.log('Updating model metadata:', { features, target, lastTrained });
          
          // Get current timestamp for initial data points
          const now = Date.now();
          
          // First, update the model metadata and parameters
          set(state => {
            // Keep track of existing parameter IDs
            const existingParamIds = state.parameters.map(p => p.id);
            
            // Create array for new parameters that need to be added
            const newParameters: Parameter[] = [];
            
            // For each feature in the model, check if we need to add it
            features?.forEach(featureId => {
              if (!existingParamIds.includes(featureId)) {
                // This feature doesn't exist in parameters yet, add it with sensible defaults
                const defaultValue = initialBounds[featureId] ? 
                  (initialBounds[featureId][0] + initialBounds[featureId][1]) / 2 : 0;
                  
                newParameters.push({
                  id: featureId,
                  name: featureId,
                  unit: parameterUnits[featureId] || '',
                  value: defaultValue,
                  trend: [],
                  color: parameterColors[featureId] || 'gray',
                  icon: parameterIcons[featureId] || '📊'
                });
              }
            });
            
            // Create updated parameters array
            const updatedParameters = [...state.parameters];
            if (newParameters.length > 0) {
              console.log('Adding new parameters for model:', newParameters);
              updatedParameters.push(...newParameters);
            }
            
            // Return the initial state update
            return {
              modelFeatures: features,
              modelTarget: target,
              lastTrained,
              parameters: updatedParameters,
              // We'll set these to null initially and let the real-time update handle them
              currentTarget: null,
              currentPV: null,
              // Initialize slider values with current parameter values
              sliderValues: {
                ...state.sliderValues,
                ...Object.fromEntries(
                  updatedParameters.map(p => [p.id, p.value])
                )
              }
            };
          });
          
          // Trigger a real-time data fetch which will update the PV and SP values
          // This will be handled by the existing real-time update mechanism
          // which will automatically update the PV and SP values
          // and trigger a prediction if needed
          
          // Start real-time updates if they're not already running
          const state = useXgboostStore.getState();
          if (!state.dataUpdateInterval) {
            state.startRealTimeUpdates();
          }
        },
        
        setCurrentMill: (millNumber) => 
          set({ currentMill: millNumber }),
        
        fetchRealTimeData: async () => {
          console.log('📊 fetchRealTimeData called');
          const stateAtStart = useXgboostStore.getState();
          // Prevent concurrent fetches to avoid duplicate API calls
          if (stateAtStart.isFetching) {
            console.log('⏭️ Skipping fetchRealTimeData: already fetching');
            return;
          }
          set({ isFetching: true });
          const requestModelName = stateAtStart.modelName;
          const { modelFeatures, modelTarget, currentMill } = stateAtStart;
          
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
          if (!modelTarget) {
            console.warn('❌ No model target available for real-time data fetch');
            return;
          }

          console.log('✅ Fetching real-time data for features:', modelFeatures);
          console.log('Model target:', modelTarget);
          console.log('Current mill:', currentMill);
          console.log('Available millsTags keys:', Object.keys(millsTags));

          try {
            // Decide whether to fetch historical trends (on initial load, after model change, or when displayHours changes)
            const shouldFetchTrends = (() => {
              const s = useXgboostStore.getState();
              const anyParamMissingTrend = s.parameters.some(p => p.trend.length === 0);
              const noTargetTrend = s.targetData.length === 0;
              // Always fetch trends when displayHours changes from previous fetch
              const displayHoursChanged = s.displayHours !== stateAtStart.lastFetchedHours;
              console.log('Display hours check:', { current: s.displayHours, lastFetched: stateAtStart.lastFetchedHours, changed: displayHoursChanged });
              return anyParamMissingTrend || noTargetTrend || displayHoursChanged;
            })();
            console.log('shouldFetchTrends:', shouldFetchTrends);
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
              
              // Check if this is a lab parameter - skip real-time data fetching for lab parameters
              const parameterConfig = millsParameters.find(p => p.id === featureName);
              const isLabParameter = parameterConfig?.isLab || false;
              
              if (isLabParameter) {
                console.log(`⚗️ Skipping real-time data fetch for lab parameter: ${featureName}`);
                return null;
              }
              
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
                
                // Optionally fetch trend data on first load only (retention window)
                let trendData = { timestamps: [], values: [] } as any;
                if (shouldFetchTrends) {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                  // Use displayHours for API calls, but fall back to TREND_RETENTION_HOURS if needed
                  const fetchHours = stateAtStart.displayHours || TREND_RETENTION_HOURS;
                  console.log(`Fetching trend data for ${featureName} with ${fetchHours} hours window`);
                  const trendResponse = await fetch(`${apiUrl}/api/tag-trend/${tagId}?hours=${fetchHours}` , {
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store'
                  });
                  if (trendResponse.ok) {
                    trendData = await trendResponse.json();
                    console.log(`Received trend data for ${featureName}:`, trendData);
                  } else {
                    console.warn(`Failed to fetch trend data for ${featureName}: ${trendResponse.statusText}`);
                  }
                }
                
                // Process trend data into the format we need
                const trend: Array<{ timestamp: number; value: number }> = [];
                // Use displayHours for filtering, but fall back to TREND_RETENTION_HOURS if needed
                const displayHours = stateAtStart.displayHours || TREND_RETENTION_HOURS;
                const retentionAgo = Date.now() - displayHours * 60 * 60 * 1000; // retention window in ms
                
                if (trendData.timestamps && trendData.values && 
                    Array.isArray(trendData.timestamps) && Array.isArray(trendData.values)) {
                  for (let i = 0; i < trendData.timestamps.length; i++) {
                    const timestamp = new Date(trendData.timestamps[i]).getTime();
                    // Only include data from the retention window
                    if (timestamp >= retentionAgo) {
                      trend.push({
                        timestamp,
                        value: trendData.values[i]
                      });
                    }
                  }
                }
                
                // Sort trend data by timestamp to ensure proper ordering
                trend.sort((a, b) => a.timestamp - b.timestamp);
                
                if (tagData && typeof tagData.value === 'number') {
                  // Use polling time for real-time points to avoid identical timestamps
                  let normalizedTimestamp: number = Date.now();
                  return {
                    featureName,
                    value: tagData.value,
                    timestamp: normalizedTimestamp,
                    trend
                  };
                }
              } catch (error) {
                console.error(`Error fetching data for feature ${featureName}:`, error);
              }
              return null;
            });

            // Also fetch the target PV value for the current model target
            let targetPromise = null;
            let targetTrendPromise = null;
            if (modelTarget) {
              const targetTagId = getTagId(modelTarget, currentMill);
              if (targetTagId) {
                console.log(`Fetching target PV data for ${modelTarget} -> tag ID ${targetTagId}`);
                
                // Fetch current target value
                targetPromise = fetchTagValue(targetTagId).then(tagData => {
                  console.log(`Received target PV data for ${modelTarget}:`, tagData);
                  if (tagData && typeof tagData.value === 'number') {
                    // Use polling time for consistency and uniqueness
                    let ts: number = Date.now();
                    return {
                      value: tagData.value,
                      timestamp: ts
                    };
                  }
                return null;
              }).catch(error => {
                console.error(`Error fetching target PV data for ${modelTarget}:`, error);
                return null;
              });
              
              // Fetch target trend data (retention window) only if needed
              if (shouldFetchTrends) {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                // Use displayHours for API calls, but fall back to TREND_RETENTION_HOURS if needed
                const fetchHours = stateAtStart.displayHours || TREND_RETENTION_HOURS;
                console.log(`Fetching target trend data for ${modelTarget} with ${fetchHours} hours window`);
                targetTrendPromise = fetch(`${apiUrl}/api/tag-trend/${targetTagId}?hours=${fetchHours}`, {
                  headers: { 'Accept': 'application/json' },
                  cache: 'no-store'
                })
                .then(async response => {
                  if (response.ok) {
                    const data = await response.json();
                    console.log(`Received target trend data for ${modelTarget}:`, data);
                    return data;
                  } else {
                    console.warn(`Failed to fetch target trend data for ${modelTarget}: ${response.statusText}`);
                    return { timestamps: [], values: [] };
                  }
                })
                .catch(error => {
                  console.error(`Error fetching target trend data for ${modelTarget}:`, error);
                  return { timestamps: [], values: [] };
                });
              } else {
                targetTrendPromise = Promise.resolve({ timestamps: [], values: [] });
              }
            } else {
              console.warn(`Could not find tag ID for target ${modelTarget} and mill ${currentMill}`);
            }
          }

            // Wait for all promises to resolve
            const [featureResults, targetResult, targetTrendData] = await Promise.all([
              Promise.all(featurePromises),
              targetPromise,
              targetTrendPromise
            ]);

            // Drop results if model changed while awaiting
            if (useXgboostStore.getState().modelName !== requestModelName) {
              console.warn('🛑 Dropping stale fetchRealTimeData results due to model change');
              return;
            }

            // Use a fresh snapshot of the state for updates below
            const state = useXgboostStore.getState();

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
            if (validFeatureResults.length > 0 && !state.isSimulationMode) {
              console.log('Real-time data updated, triggering prediction with current values (real-time mode)');
              // Only trigger automatic predictions in real-time mode
              // In simulation mode, predictions are triggered manually by user
              await state.predictWithCurrentValues();
            } else if (state.isSimulationMode) {
              console.log('Real-time data updated, but skipping automatic prediction (simulation mode)');
            }

              // Update target PV and add to target data
            if (targetResult) {
              console.log(`Updating target PV with value ${targetResult.value}`);
              
              // Process target trend data if available
              let targetTrendPoints: TargetData[] = [];
              if (targetTrendData && targetTrendData.timestamps && targetTrendData.values &&
                  Array.isArray(targetTrendData.timestamps) && Array.isArray(targetTrendData.values)) {
                
                // For initial load, use the most recent PV value as the target
                const initialPV = targetTrendData.values.length > 0 
                  ? targetTrendData.values[targetTrendData.values.length - 1] 
                  : 0;
                  
                // If this is the first load, set both PV and target to the same value
                const effectiveSP = state.currentTarget !== null ? state.currentTarget : initialPV;
                
                // Convert API trend data to our format - using retention window to match API call
                // Use displayHours for filtering, but fall back to TREND_RETENTION_HOURS if needed
                const displayHours = stateAtStart.displayHours || TREND_RETENTION_HOURS;
                const retentionAgo = Date.now() - displayHours * 60 * 60 * 1000; // in milliseconds
                
                // Process all trend points first
                const allPoints = targetTrendData.timestamps.map((timestamp: string, index: number) => {
                  const ts = new Date(timestamp).getTime();
                  const value = targetTrendData.values[index];
                  // Initialize SP trend equal to PV trend so both lines overlap initially
                  return {
                    timestamp: ts,
                    value: value,
                    target: value,  // initialize same as PV for historical window
                    pv: value,      // PV is the actual measured historical value
                    sp: value       // SP initialized to PV; predictions will diverge it later
                  } as TargetData;
                });
                
                // Sort all points by timestamp to ensure proper order
                allPoints.sort((a: TargetData, b: TargetData) => a.timestamp - b.timestamp);
                
                // Filter to only include points from the retention window
                targetTrendPoints = allPoints.filter((point: TargetData) => point.timestamp >= retentionAgo);
                
                // If we have points but none in the retention window, keep the most recent points
                if (allPoints.length > 0 && targetTrendPoints.length === 0) {
                  // Take the last 10 points to show some context
                  const recentPoints = allPoints.slice(-10);
                  // Adjust timestamps to be within the retention window
                  const timeNow = Date.now();
                  // Use displayHours for spacing calculation, but fall back to TREND_RETENTION_HOURS if needed
                  const displayHours = stateAtStart.displayHours || TREND_RETENTION_HOURS;
                  const spacingMinutes = (displayHours * 60) / Math.max(recentPoints.length, 1);
                  targetTrendPoints = recentPoints.map((point: TargetData, index: number) => ({
                    ...point,
                    // Distribute points evenly over the retention window
                    timestamp: timeNow - Math.round((displayHours * 60 - index * spacingMinutes) * 60 * 1000)
                  }));
                }
                
                console.log('Processed target trend points with SP:', effectiveSP, targetTrendPoints);
              }

              // Seed targetData with 8h historical series so the chart shows history immediately
              if (shouldFetchTrends && targetTrendPoints.length > 0) {
                set({ targetData: targetTrendPoints });
              }
              
              // Update current PV with the latest value
              set({ currentPV: targetResult.value });
              
              // For real-time updates: Add new data point with updated PV and preserved SP
              
              console.log('🕐 REAL-TIME UPDATE:');
              console.log('Target result timestamp (raw):', targetResult.timestamp);
              
              // Ensure timestamp is a JavaScript number (milliseconds since epoch)
              let normalizedTimestamp: number;
              if (typeof targetResult.timestamp === 'string') {
                normalizedTimestamp = new Date(targetResult.timestamp).getTime();
                console.log('Converted string timestamp to number:', normalizedTimestamp);
              } else {
                normalizedTimestamp = targetResult.timestamp;
              }
              if (!Number.isFinite(normalizedTimestamp)) {
                normalizedTimestamp = Date.now();
              }
              
              console.log('Normalized timestamp:', normalizedTimestamp, '→', new Date(normalizedTimestamp).toLocaleString());
              console.log('Target result value (PV):', targetResult.value);
              console.log('Current target (for SP):', state.currentTarget);

              // Re-read latest state after seeding to avoid stale reference
              const currentStateForRT = useXgboostStore.getState();
              // Get the most recent SP value or sensible fallback to avoid spikes
              const lastDataPoint = currentStateForRT.targetData[currentStateForRT.targetData.length - 1];
              const lastSP = (lastDataPoint?.sp ?? lastDataPoint?.pv);
              const currentSP = currentStateForRT.currentTarget;

              // Prefer last seeded SP, then current target, then current PV
              const effectiveSP =
                (typeof lastSP === 'number' && Number.isFinite(lastSP)) ? lastSP :
                (typeof currentSP === 'number' && Number.isFinite(currentSP)) ? currentSP :
                targetResult.value;
              
              console.log('Current PV:', targetResult.value, 'Effective SP:', effectiveSP);
              
              // Create new data point with updated PV and preserved SP
              const newRealTimePoint: TargetData = {
                timestamp: normalizedTimestamp,
                value: targetResult.value, // This is the actual PV value
                target: effectiveSP,       // This is the target we're trying to reach (ensured to be a number)
                pv: targetResult.value,    // PV is the actual measured value
                sp: effectiveSP            // SP is the predicted/desired value
              };
              
              console.log('Adding real-time data point:', newRealTimePoint);
              
              // Merge: initialize with historical points only once, then append new real-time point
              // Always prune to last TREND_RETENTION_HOURS to keep a consistent retention window
              set(state => {
                const retentionAgo = Date.now() - TREND_RETENTION_HOURS * 60 * 60 * 1000;
                // If targetData is empty and we have historical points, seed with them
                let next = state.targetData.length === 0 && targetTrendPoints.length > 0
                  ? targetTrendPoints
                  : state.targetData;
                // Append the latest real-time point
                next = [...next, newRealTimePoint];
                // Sort by timestamp to stabilize order
                next.sort((a, b) => a.timestamp - b.timestamp);
                // Deduplicate by timestamp (keep the latest value for identical ts)
                const deduped: typeof next = [] as any;
                for (const p of next) {
                  const last = deduped[deduped.length - 1];
                  if (last && last.timestamp === p.timestamp) {
                    deduped[deduped.length - 1] = p; // replace with latest
                  } else {
                    deduped.push(p);
                  }
                }
                // Prune to retention window
                const pruned = deduped.filter(p => p.timestamp >= retentionAgo);
                return { targetData: pruned };
              });
            }
            
          } catch (error) {
            console.error('Error fetching real-time data:', error);
          } finally {
            // Update lastFetchedHours to track which hours value was used for this fetch
            const currentDisplayHours = useXgboostStore.getState().displayHours;
            set({ 
              isFetching: false,
              lastFetchedHours: currentDisplayHours
            });
            console.log(`Updated lastFetchedHours to ${currentDisplayHours}`);
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

        resetFeatures: () => {
          // Get current state
          const state = useXgboostStore.getState();
          
          // Reset all parameters to default values (middle of the range)
          set(state => {
            const updatedParameters = state.parameters.map(p => {
              const bounds = state.parameterBounds[p.id] || initialBounds[p.id] || [0, 100];
              const defaultValue = (bounds[0] + bounds[1]) / 2;
              return {
                ...p,
                value: defaultValue
              };
            });
            
            // Also reset slider values to match
            const updatedSliderValues = { ...state.sliderValues };
            updatedParameters.forEach(p => {
              updatedSliderValues[p.id] = p.value;
            });
            
            return {
              parameters: updatedParameters,
              sliderValues: updatedSliderValues
            };
          });
          
          // Trigger a prediction with the reset values
          setTimeout(() => {
            const updatedState = useXgboostStore.getState();
            updatedState.predictWithCurrentValues();
          }, 100);
        },
        
        setDisplayHours: (hours) => {
          console.log(`Setting display hours to ${hours}`);
          set({ displayHours: hours });
        },

        predictWithCurrentValues: async () => {
          const state = useXgboostStore.getState();
          const { modelFeatures, modelName, isSimulationMode, parameters, sliderValues } = state;
          
          if (!modelFeatures || modelFeatures.length === 0) {
            console.error('❌ No model features available for prediction');
            return;
          }
          
          // CRITICAL FIX: Ensure all model features have slider values initialized
          const updatedSliderValues = { ...sliderValues };
          let needsUpdate = false;
          
          modelFeatures.forEach(featureName => {
            if (!(featureName in updatedSliderValues) || updatedSliderValues[featureName] === undefined) {
              const defaultValue = initialBounds[featureName] ? 
                (initialBounds[featureName][0] + initialBounds[featureName][1]) / 2 : 0;
              updatedSliderValues[featureName] = defaultValue;
              needsUpdate = true;
              console.log(`🔄 CRITICAL FIX: Initializing missing/undefined slider value for ${featureName}: ${defaultValue}`);
            }
          });
          
          // Update the store if we added missing slider values
          if (needsUpdate) {
            set({ sliderValues: updatedSliderValues });
            console.log('🔄 Updated slider values in store:', updatedSliderValues);
          }
          
          // DEBUG: Log current model state
          console.log('🔍 PREDICTION DEBUG:');
          console.log('Model name:', modelName);
          console.log('Model features from store:', modelFeatures);
          console.log('Model features length:', modelFeatures.length);
          console.log('Is simulation mode:', isSimulationMode);
          console.log('Available parameters:', parameters.map(p => p.id));
          console.log('Slider values (after fix):', updatedSliderValues);
          
          try {
            // Build prediction data using hybrid logic
            const predictionData: Record<string, number> = {};
            
            modelFeatures.forEach(featureName => {
              const parameterConfig = millsParameters.find(p => p.id === featureName);
              const isLabParameter = parameterConfig?.isLab || false;
              
              if (isLabParameter) {
                // Lab parameters: Always use slider values and divide by 100 for the API
                if (updatedSliderValues[featureName] !== undefined) {
                  // Convert percentage to decimal for the API (e.g., 35% -> 0.35)
                  predictionData[featureName] = updatedSliderValues[featureName] / 100;
                  console.log(`🧪 ${featureName} (Lab): ${updatedSliderValues[featureName]}% -> ${predictionData[featureName]} (converted to decimal) ✅ ADDED`);
                } else {
                  console.warn(`⚠️ Missing slider value for lab parameter: ${featureName}`);
                }
              } else {
                // Process parameters: Use slider values in simulation mode, PV values in real-time mode
                if (isSimulationMode) {
                  if (updatedSliderValues[featureName] !== undefined) {
                    predictionData[featureName] = updatedSliderValues[featureName];
                    console.log(`📊 ${featureName} (Process-Slider): ${updatedSliderValues[featureName]} ✅ ADDED`);
                  } else {
                    console.warn(`⚠️ Missing slider value for process parameter in simulation mode: ${featureName}`);
                  }
                } else {
                  // Real-time mode: use PV values
                  const parameter = parameters.find(p => p.id === featureName);
                  if (parameter) {
                    predictionData[featureName] = parameter.value;
                    console.log(`📊 ${featureName} (Process-PV): ${parameter.value} ✅ ADDED`);
                  } else {
                    console.warn(`⚠️ Missing parameter for: ${featureName} ❌ NOT ADDED`);
                  }
                }
              }
            });
            
            console.log('Prediction data (hybrid logic):', predictionData);
            
            // Validation: Check for missing features
            const missingFeatures = modelFeatures.filter(feature => !(feature in predictionData));
            if (missingFeatures.length > 0) {
              console.error('❌ Missing features for prediction:', missingFeatures);
              console.error('Required features:', modelFeatures);
              console.error('Available data:', Object.keys(predictionData));
              return;
            }
            
            // Validation: Check for invalid values
            const invalidValues = Object.entries(predictionData).filter(([key, value]) => 
              typeof value !== 'number' || isNaN(value)
            );
            if (invalidValues.length > 0) {
              console.error('❌ Invalid values for prediction:', invalidValues);
              return;
            }
            
            console.log('✅ Validation passed. Calling prediction API...');
            
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
              console.log('🕐 PREDICTION TIMESTAMP DEBUG:');
              console.log('Current time (Date.now()):', timestamp, '→', new Date(timestamp).toLocaleString());
              console.log('Current PV:', state.currentPV);
              console.log('Prediction value:', prediction);
              
              const newPredictionPoint = {
                timestamp,
                value: prediction,
                target: prediction,
                sp: prediction, // SP represents the new predicted setpoint
                pv: state.currentPV || prediction // PV is the actual measured value
              };
              
              console.log('Adding prediction data point:', newPredictionPoint);
              
              set(state => {
                const retentionAgo = Date.now() - TREND_RETENTION_HOURS * 60 * 60 * 1000;
                const merged = [
                  ...state.targetData,
                  newPredictionPoint
                ];
                const pruned = merged.filter(p => p.timestamp >= retentionAgo);
                return { targetData: pruned };
              });
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
