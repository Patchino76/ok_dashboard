"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ParameterSimulationCard } from "./parameter-simulation-card"
import { TargetFractionDisplay } from "./target-fraction-display"
import { Zap, Activity, Play, Pause, BarChart2, AlertCircle, RotateCcw } from "lucide-react"
import { useXgboostStore } from "@/app/mills-ai/stores/xgboost-store"
import { millsTags } from "@/lib/tags/mills-tags"

// Define tag interface to match the structure in mills-tags.ts
interface TagInfo {
  id: number
  name: string
  desc: string
  unit: string
  precision: number
  group: string
  icon: string
}

// Define type for millsTags structure
type MillsTagsType = typeof millsTags
type TagKey = keyof MillsTagsType

import { usePredictTarget } from "@/app/mills-ai/hooks/use-predict-target"
import { useGetModels } from "@/app/mills-ai/hooks/use-get-models"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ParameterData {
  timestamp: number
  value: number
  target: number
  pv: number
}

export default function XgboostSimulationDashboard() {
  const {
    parameters,
    parameterBounds,
    currentTarget,
    currentPV,
    targetData,
    modelName,
    availableModels,
    modelFeatures,
    modelTarget,
    lastTrained,
    currentMill,
    sliderValues,
    isSimulationMode,
    updateParameter,
    updateSliderValue,
    setSimulationMode,
    setPredictedTarget,
    addTargetDataPoint,
    setModelName,
    setAvailableModels,
    setModelMetadata,
    startSimulation,
    stopSimulation,
    setCurrentMill,
    fetchRealTimeData,
    startRealTimeUpdates,
    resetSlidersToPVs,
    resetFeatures,
    resetSliders,
    predictWithCurrentValues
  } = useXgboostStore()

  const [predictionMode, setPredictionMode] = useState('auto')
  const [autoPredict, setAutoPredict] = useState(false)
  const { predictTarget, isPredicting } = usePredictTarget()
  const { models, isLoading: isLoadingModels, error: modelsError, refetch } = useGetModels()
  
  // Debounced prediction effect for slider changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Trigger prediction when slider values change (with 500ms debounce)
      if (Object.keys(sliderValues).length > 0) {
        predictWithCurrentValues();
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [sliderValues, predictWithCurrentValues]);

  // Load available models on component mount (only once)
  useEffect(() => {
    console.log(' Model loading effect triggered');
    console.log('Models:', models);
    console.log('IsLoading:', isLoadingModels);
    console.log('Error:', modelsError);
    
    if (models) {
      const modelIds = Object.keys(models)
      console.log(' Available model IDs:', modelIds);
      setAvailableModels(modelIds)
      
      const defaultModelId = "xgboost_PSI80_mill8";
      
      // Always prefer mill 8 over mill 6 when both are available
      // This ensures mill 8 is selected even if persistence has mill 6 saved
      if (models[defaultModelId] && modelName !== defaultModelId) {
        console.log(' Forcing default model (mill 8 preferred):', defaultModelId);
        setModelName(defaultModelId);
        const model = models[defaultModelId];
        setModelMetadata(
          model.features,
          model.target_col,
          model.last_trained
        );
      }
      // Only update model and metadata on initial load or if current model doesn't exist
      else if (!modelName || !models[modelName]) {
        console.log(' Setting up default model:', defaultModelId);
        // Try to use default model first
        if (models[defaultModelId]) {
          console.log(' Found default model, setting up:', models[defaultModelId]);
          setModelName(defaultModelId);
          const model = models[defaultModelId];
          setModelMetadata(
            model.features,
            model.target_col,
            model.last_trained
          );
        } 
        // If default doesn't exist, use the first available
        else if (modelIds.length > 0) {
          console.log(' Default model not found, using first available:', modelIds[0]);
          const firstModel = models[modelIds[0]];
          setModelName(modelIds[0]);
          setModelMetadata(
            firstModel.features,
            firstModel.target_col,
            firstModel.last_trained
          );
        } else {
          console.log(' No models available at all');
        }
      } else {
        console.log(' Model already set:', modelName);
      }
    } else {
      console.log(' Models not loaded yet or failed to load');
    }
  }, [models, modelName, setModelName, setAvailableModels, setModelMetadata, isLoadingModels, modelsError])

  // Start real-time data updates when model features are available
  useEffect(() => {
    console.log(' Real-time updates effect triggered');
    let cleanup: (() => void) | undefined;
    
    const setupRealTimeUpdates = () => {
      // Check if modelFeatures exists and has items
      if (modelFeatures && modelFeatures.length > 0) {
        console.log(' Model features available, starting real-time updates:', modelFeatures);
        console.log(' About to call startRealTimeUpdates()');
        
        try {
          // Call startRealTimeUpdates and store the cleanup function
          const cleanupFn = startRealTimeUpdates();
          if (typeof cleanupFn === 'function') {
            cleanup = cleanupFn;
          }
          console.log(' startRealTimeUpdates() called successfully');
        } catch (error) {
          console.error('Error starting real-time updates:', error);
        }
      } else {
        console.log(' Model features not available yet or empty');
        console.log('Debug info:');
        console.log('- modelFeatures is null/undefined:', !modelFeatures);
        console.log('- modelFeatures is empty array:', modelFeatures?.length === 0);
        console.log('- modelName:', modelName);
        console.log('- models loaded:', !!models);
        
        // Force trigger if we have a model name but no features
        if (modelName && models && models[modelName] && !modelFeatures) {
          console.log(' Forcing model metadata update for:', modelName);
          const model = models[modelName];
          setModelMetadata(model.features, model.target_col, model.last_trained);
        }
      }
    };
    
    setupRealTimeUpdates();
    
    // Cleanup function that will be called when the component unmounts or dependencies change
    return () => {
      console.log('🧹 Cleaning up real-time updates in useEffect');
      if (cleanup) {
        cleanup();
      }
      // Always call stopRealTimeUpdates to ensure cleanup
      useXgboostStore.getState().stopRealTimeUpdates();
    };
  }, [modelFeatures, startRealTimeUpdates, modelName, models, setModelMetadata])

  // Removed automatic prediction on slider changes to prevent duplicate API calls
  // Predictions now only trigger from:
  // 1. Real-time data updates (every 30 seconds)
  // 2. Manual "Predict Target" button click

  /**
   * Get tag ID for a specific feature/target and mill number from millsTags
   * @param targetKey The feature/target key (e.g., "PSI80", "MotorAmp")
   * @param millNumber The mill number (e.g., 8 for Mill08)
   * @returns The tag ID or null if not found
   */
  const getTagId = (targetKey: string, millNumber: number): number | null => {
    // Check if the targetKey exists in millsTags
    if (!millsTags || !(targetKey in millsTags)) {
      console.error(`Target ${targetKey} not found in millsTags`)
      return null
    }

    // Use type assertion to access the tags array
    // This is safe because we've checked that targetKey exists in millsTags
    const tags = millsTags[targetKey as TagKey] as TagInfo[]
    
    // Find the entry for the specific mill number
    const millName = `Mill${String(millNumber).padStart(2, '0')}`
    const tagInfo = tags.find((tag: TagInfo) => tag.name === millName)
    
    if (!tagInfo) {
      console.error(`Mill ${millNumber} (${millName}) not found for target ${targetKey}`)
      return null
    }
    
    console.log(`Found tag ID ${tagInfo.id} for ${targetKey}, mill ${millNumber} (${millName})`)
    return tagInfo.id
  }
  
  const handlePrediction = async () => {
    // Use the new clean dual data source approach
    await predictWithCurrentValues()
  }

  // Number of parameters in range
  const inRangeCount = parameters.filter(param => {
    const min = parameterBounds[param.id]?.[0] || 0
    const max = parameterBounds[param.id]?.[1] || 100
    return param.value >= min && param.value <= max
  }).length

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              System Overview
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant={isPredicting ? "destructive" : "default"}>
                {isPredicting ? "PREDICTING" : "READY"}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                XGBoost Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col">
              <Label className="mb-1">Mill Selection</Label>
              <Select
                value={`Mill${currentMill.toString().padStart(2, '0')}`}
                onValueChange={(value) => {
                  const millNumber = parseInt(value.replace('Mill', ''));
                  setCurrentMill(millNumber);
                  
                  // Update model name based on mill selection
                  const newModelName = `xgboost_PSI80_mill${millNumber}`;
                  if (availableModels.includes(newModelName)) {
                    setModelName(newModelName);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mill" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mill06">Mill 06</SelectItem>
                  <SelectItem value="Mill07">Mill 07</SelectItem>
                  <SelectItem value="Mill08">Mill 08</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-col">
              <Label className="mb-1">Select Model</Label>
              <Select
                value={modelName}
                onValueChange={(value) => setModelName(value)}
                disabled={isLoadingModels}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels
                    .filter(model => model.includes(`mill${currentMill}`))
                    .map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              
              {modelsError && (
                <div className="flex items-center gap-2 text-red-500 mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Error loading models</span>
                </div>
              )}
              
              {modelFeatures && modelTarget && (
                <div className="mt-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">Target: <span className="text-blue-500">{modelTarget}</span></span>
                    <span className="font-semibold">Features: <span className="text-green-500">{modelFeatures.length}</span></span>
                    {lastTrained && <span className="text-xs text-muted-foreground">Last trained: {new Date(lastTrained).toLocaleString()}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-4xl font-bold">{parameters.length}</div>
              <div className="text-sm text-muted-foreground">Active Parameters</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-500">{inRangeCount}</div>
              <div className="text-sm text-muted-foreground">In Range</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-500">
                {currentTarget?.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Fraction Target</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-500">
                ACTIVE
              </div>
              <div className="text-sm text-muted-foreground">Real-time Data</div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="simulation-mode"
                  checked={isSimulationMode}
                  onCheckedChange={setSimulationMode}
                />
                <Label htmlFor="simulation-mode" className="flex items-center gap-1">
                  {isSimulationMode ? (
                    <>
                      <span className="text-red-500">🎯</span>
                      Simulation Mode (Sliders)
                    </>
                  ) : (
                    <>
                      <span className="text-blue-500">📊</span>
                      Real-time Mode (PV)
                    </>
                  )}
                </Label>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => resetFeatures()}
                disabled={!modelFeatures || modelFeatures.length === 0}
                className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Features SP
              </Button>
              <Button 
                onClick={handlePrediction}
                disabled={isPredicting}
                className="flex items-center gap-1"
              >
                <Zap className="h-4 w-4" />
                {isPredicting ? "Predicting..." : "Predict Target"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Display */}
      <TargetFractionDisplay
        currentTarget={currentTarget}
        currentPV={currentPV}
        targetData={targetData}
        isOptimizing={isPredicting}
        isSimulationMode={isSimulationMode}
      />

      {/* Parameter Control Cards Grid */}
      {/* Add debugging outside of rendering to avoid TypeScript errors */}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {parameters
          .filter(parameter => {
            // Only show parameters that are included in the selected model's features
            return !modelFeatures || modelFeatures.includes(parameter.id);
          })
          .map((parameter) => (
            <ParameterSimulationCard
              key={`${modelName}-${parameter.id}`} // Include modelName in key to force re-render
              parameter={parameter}
              bounds={parameterBounds[parameter.id] || [0, 100]}
              sliderValue={sliderValues[parameter.id] ?? parameter.value}
              resetSliders={resetSliders}
              isSimulationMode={isSimulationMode}
              onParameterUpdate={(id: string, value: number) => {
                // Always update slider values for all parameters
                updateSliderValue(id, value)
              }}
            />
        ))}
      </div>
    </div>
  )
}
