"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ParameterSimulationCard } from "./parameter-simulation-card"
import { TargetFractionDisplay } from "./target-fraction-display"
import { Zap, Activity, Play, Pause, BarChart2, AlertCircle, RotateCcw } from "lucide-react"
import { useXgboostStore } from "@/app/mills-ai/stores/xgboost-store"
import { millsTags } from "@/lib/tags/mills-tags"
import { toast } from "sonner"
import { useGetModels } from "@/app/mills-ai/hooks/use-get-models"

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

interface ParameterData {
  timestamp: number
  value: number
  target: number
  pv: number
}

export default function XgboostSimulationDashboard() {
  // Get the store instance
  const store = useXgboostStore();
  
  // Destructure store values with proper types
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
    stopRealTimeUpdates,
    setCurrentMill,
    fetchRealTimeData,
    startRealTimeUpdates,
    resetSlidersToPVs,
    resetFeatures,
    resetSliders,
    predictWithCurrentValues
  } = store;

  const [predictionMode, setPredictionMode] = useState('auto')
  const [autoPredict, setAutoPredict] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false);
  // Use the useGetModels hook to fetch models
  const { models, isLoading: isLoadingModels, error: modelsError } = useGetModels();
  
  // Get the selected model from the models object
  const selectedModel = modelName && models ? models[modelName] : null;
  
  // Update available models in store when models are loaded
  useEffect(() => {
    if (models && Object.keys(models).length > 0) {
      console.log('Updating available models in store:', Object.keys(models));
      setAvailableModels(Object.keys(models));
    }
  }, [models, setAvailableModels]);
  
  // Removed duplicated real-time setup on model change.
  // Real-time updates are now started exclusively by the modelFeatures-driven effect below.

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

  // Handle model selection and metadata updates when models or current mill changes
  useEffect(() => {
    if (!models || Object.keys(models).length === 0) {
      console.log('No models loaded yet');
      return;
    }

    const modelIds = Object.keys(models);
    console.log('Available models:', modelIds);
    console.log('Current model:', modelName);
    console.log('Current mill:', currentMill);

    // Find a suitable model for the current mill
    const findSuitableModel = () => {
      // First try to find a model for the current mill
      const modelsForCurrentMill = modelIds.filter(m => m.endsWith(`_mill${currentMill}`));
      if (modelsForCurrentMill.length > 0) {
        return modelsForCurrentMill[0];
      }
      
      // If no model for current mill, try the default model
      const defaultModelId = "xgboost_PSI80_mill8";
      if (modelIds.includes(defaultModelId)) {
        return defaultModelId;
      }
      
      // Fall back to the first available model
      return modelIds.length > 0 ? modelIds[0] : null;
    };

    // If we don't have a model selected or the current model is not in the available models
    if (!modelName || !models[modelName]) {
      const modelToUse = findSuitableModel();
      
      if (modelToUse) {
        console.log('Setting initial model:', modelToUse);
        setModelName(modelToUse);
        
        // Update model metadata
        const selectedModel = models[modelToUse];
        if (selectedModel) {
          console.log('Updating model metadata for:', modelToUse);
          setModelMetadata(
            selectedModel.features,
            selectedModel.target_col,
            selectedModel.last_trained
          );
        }
      } else {
        console.warn('No valid models found');
      }
    } else if (models[modelName]) {
      // If we have a valid model name, ensure its metadata is up to date
      const currentModel = models[modelName];
      console.log('Updating metadata for existing model:', modelName);
      setModelMetadata(
        currentModel.features,
        currentModel.target_col,
        currentModel.last_trained
      );
    }
  }, [models, modelName, currentMill, setModelName, setModelMetadata]);

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
    if (isPredicting) return;
    setIsPredicting(true);
    try {
      await predictWithCurrentValues();
      toast.success('Prediction completed successfully');
    } catch (error) {
      console.error('Error during prediction:', error);
      toast.error('Failed to make prediction');
    } finally {
      setIsPredicting(false);
    }
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
      <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              System Overview
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 ${isPredicting ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}>
                {isPredicting ? "PREDICTING" : "READY"}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                XGBoost Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div className="flex flex-col">
              <Label className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">Mill Selection</Label>
              <Select
                value={`Mill${currentMill.toString().padStart(2, '0')}`}
                key={`mill-select-${currentMill}`}
                onValueChange={(value) => {
                  const millNumber = parseInt(value.replace('Mill', ''));
                  setCurrentMill(millNumber);
                  
                  // Find the first model for the selected mill
                  const modelForMill = availableModels.find(m => m.endsWith(`_mill${millNumber}`));
                  if (modelForMill) {
                    setModelName(modelForMill);
                    
                    // Update model metadata if models are loaded
                    const selectedModel = models?.[modelForMill];
                    if (selectedModel) {
                      setModelMetadata(
                        selectedModel.features,
                        selectedModel.target_col,
                        selectedModel.last_trained
                      );
                    }
                  }
                }}
              >
                <SelectTrigger className="rounded-md border-gray-200 dark:border-gray-700 h-10">
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
              <Label className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">Select Model</Label>
              <Select
                value={modelName}
                key={`model-select-${modelName}`}
                onValueChange={async (value) => {
                  if (value === modelName) return; // Skip if no change
                  
                  console.log('Model selection changed from', modelName, 'to', value);
                  
                  // Show loading state
                  const loadingToast = toast.loading('Switching models...');
                  
                  try {
                    // Stop any ongoing real-time updates
                    await stopRealTimeUpdates();
                    
                    // Clear existing data
                    setPredictedTarget(0);
                    
                    // Update the model name in the store
                    setModelName(value);
                    
                    if (!models || !models[value]) {
                      throw new Error(`Model not found: ${value}`);
                    }
                    
                    const selectedModel = models[value];
                    console.log('Updating model metadata for:', value, selectedModel);
                    
                    // Update model metadata with the new model's features and target
                    setModelMetadata(
                      selectedModel.features,
                      selectedModel.target_col,
                      selectedModel.last_trained
                    );
                    
                    // Do not start updates or trigger prediction here.
                    // The modelFeatures-driven effect will start updates and the store
                    // will trigger prediction after the first real-time fetch.
                    
                    toast.success(`Successfully switched to model: ${value}`, { id: loadingToast });
                  } catch (error) {
                    console.error('Error during model switch:', error);
                    toast.error(`Failed to switch to model: ${value}`, { id: loadingToast });
                    
                    // Try to revert to the previous model if available
                    if (modelName && models?.[modelName]) {
                      console.log('Reverting to previous model:', modelName);
                      setModelName(modelName);
                      setModelMetadata(
                        models[modelName].features,
                        models[modelName].target_col,
                        models[modelName].last_trained
                      );
                    }
                  } finally {
                    toast.dismiss(loadingToast);
                  }
                }}
                disabled={isLoadingModels || !availableModels?.length}
              >
                <SelectTrigger className="rounded-md border-gray-200 dark:border-gray-700 h-10">
                  <SelectValue placeholder={isLoadingModels ? "Loading models..." : availableModels?.length ? "Select a model" : "No models available"} />
                </SelectTrigger>
                <SelectContent>
                  {availableModels && availableModels.length > 0 ? (
                    availableModels
                      .filter(model => {
                        // Extract mill number from model name (e.g., 'xgboost_PSI80_mill8' -> '8')
                        const millMatch = model.match(/_mill(\d+)$/);
                        const modelMill = millMatch ? parseInt(millMatch[1], 10) : null;
                        return modelMill === currentMill;
                      })
                      .map((model) => (
                        <SelectItem key={model} value={model}>
                          {model.replace(`_mill${currentMill}`, '')}
                        </SelectItem>
                      ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {isLoadingModels ? 'Loading models...' : 'No models available'}
                    </div>
                  )}
                </SelectContent>
              </Select>
              
              {modelsError && (
                <div className="flex items-center gap-2 text-red-500 mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Error loading models</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4">
            <div className="text-sm">
              <span className="text-gray-500">Target:</span> <span className="font-medium text-blue-600">{modelTarget || 'PSI80'}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Features:</span> <span className="font-medium text-green-600">{modelFeatures?.length || 9}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Last trained:</span> <span className="font-medium">{lastTrained ? new Date(lastTrained).toLocaleString() : '8/11/2025, 9:45:32 AM'}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Switch
                  id="simulation-mode"
                  checked={!isSimulationMode}
                  onCheckedChange={(checked) => setSimulationMode(!checked)}
                  className="mr-2"
                />
                <Label htmlFor="simulation-mode" className="text-sm font-medium">
                  Real-time Mode (PV)
                </Label>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => resetFeatures()}
                disabled={!modelFeatures || modelFeatures.length === 0}
                className="h-9 px-3 rounded-md border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset Features SP
              </Button>
              <Button 
                onClick={handlePrediction}
                disabled={isPredicting}
                className="h-9 px-4 rounded-md bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                <Zap className="h-4 w-4 mr-1" />
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
        modelName={selectedModel?.name}
        targetVariable={selectedModel?.target_col}
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
