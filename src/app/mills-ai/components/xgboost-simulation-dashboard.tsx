"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ParameterSimulationCard } from "./parameter-simulation-card"
import { TargetFractionDisplay } from "./target-fraction-display"
import { Zap, Activity, Play, Pause, BarChart2, AlertCircle } from "lucide-react"
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

export function XgboostSimulationDashboard() {
  const { 
    parameters, 
    parameterBounds, 
    currentTarget,
    currentPV,
    targetData, 
    modelName,
    simulationActive,
    availableModels,
    modelFeatures,
    modelTarget,
    lastTrained,
    setPredictedTarget, 
    updateParameter, 
    addTargetDataPoint,
    startSimulation,
    stopSimulation,
    updateSimulatedPV,
    setModelName,
    setAvailableModels,
    setModelMetadata
  } = useXgboostStore()
  const currentMill = 8
  
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
  
  const [autoPredict, setAutoPredict] = useState(false)
  const { predictTarget, isPredicting } = usePredictTarget()
  const { models, isLoading: isLoadingModels, error: modelsError, refetch } = useGetModels()
  
  // Load available models on component mount (only once)
  useEffect(() => {
    if (models) {
      const modelIds = Object.keys(models)
      setAvailableModels(modelIds)
      
      const defaultModelId = "xgboost_PSI80_mill8";
      
      // Only update model and metadata on initial load or if current model doesn't exist
      if (!modelName || !models[modelName]) {
        // Try to use default model first
        if (models[defaultModelId]) {
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
          const firstModel = models[modelIds[0]];
          setModelName(modelIds[0]);
          setModelMetadata(
            firstModel.features,
            firstModel.target_col,
            firstModel.last_trained
          );
        }
      } else {
        // Always ensure metadata is synced with current model
        const currentModel = models[modelName];
        if (currentModel) {
          setModelMetadata(
            currentModel.features,
            currentModel.target_col,
            currentModel.last_trained
          );
        }
      }
    }
  }, [models, modelName, setAvailableModels, setModelMetadata, setModelName])
  
  // Add debug effect to track model features changes
  useEffect(() => {
    console.log('modelFeatures changed:', modelFeatures);
  }, [modelFeatures])
  
  // Handle model selection change
  const handleModelChange = async (value: string) => {
    if (value) {
      console.log('Changing model to:', value);
      
      // First, update model name in store
      setModelName(value);
      
      // Call the API to refresh the models data
      // This ensures we always have the latest model metadata
      console.log('Calling API to refresh models...');
      await refetch();
      
      // Wait for refetch to complete and then update with fresh data
      setTimeout(() => {
        if (models && models[value]) {
          console.log('Refreshed model data:', models[value]);
          console.log('Updated model features:', models[value].features);
          
          // Get model metadata from the refreshed models list
          const model = models[value];
          
          // Update model metadata in store with the freshly fetched features
          setModelMetadata(
            model.features,
            model.target_col,
            model.last_trained
          );
          
          // Force parameter cards to refresh by triggering state update
          setAvailableModels([...availableModels]); // Create new array to force re-render
        } else {
          console.error('Model not found after refresh:', value);
        }
      }, 100); // Give a little time for the state to update after refetch
    }
  }

  const handlePrediction = async () => {
    const paramValues = Object.fromEntries(
      parameters.map(param => [param.id, param.value])
    )
    
    try {
      const result = await predictTarget({
        modelName,
        data: paramValues
      })
      
      if (result?.prediction) {
        setPredictedTarget(result.prediction)
        
        // Add data point to chart
        const now = Date.now()
        addTargetDataPoint({
          timestamp: now,
          value: result.prediction,
          target: result.prediction
        })
      }
    } catch (error) {
      console.error("Prediction failed:", error)
    }
  }

  // Reference for simulation interval
  const simulationInterval = useRef<NodeJS.Timeout | null>(null)
  
  // Start/stop PV simulation
  useEffect(() => {
    if (simulationActive) {
      // Initial update to get first PV value
      updateSimulatedPV()
      
      // Set up interval for PV simulation (update every 1 second)
      simulationInterval.current = setInterval(() => {
        updateSimulatedPV()
      }, 1000)
    } else if (simulationInterval.current) {
      clearInterval(simulationInterval.current)
      simulationInterval.current = null
    }
    
    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current)
      }
    }
  }, [simulationActive, updateSimulatedPV])
  
  // Trigger prediction on parameter change if autoPredict is enabled
  useEffect(() => {
    if (autoPredict) {
      handlePrediction()
    }
  }, [parameters, autoPredict])

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
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="flex flex-col">
              <Label className="mb-1">Select Model</Label>
              <Select
                value={modelName}
                onValueChange={handleModelChange}
                disabled={isLoadingModels}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
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
              <div className="text-4xl font-bold text-orange-500">
                {simulationActive ? "RUNNING" : "PAUSED"}
              </div>
              <div className="text-sm text-muted-foreground">Simulation Status</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4 flex-wrap gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="simulation-toggle"
                  checked={simulationActive}
                  onCheckedChange={simulationActive ? stopSimulation : startSimulation}
                />
                <Label htmlFor="simulation-toggle" className="flex items-center gap-1">
                  {simulationActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {simulationActive ? "Stop" : "Start"} PV Simulation
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-predict-toggle"
                  checked={autoPredict}
                  onCheckedChange={setAutoPredict}
                />
                <Label htmlFor="auto-predict-toggle">
                  Auto-predict on parameter change
                </Label>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => updateSimulatedPV()}
                disabled={!simulationActive}
                className="flex items-center gap-1"
              >
                <BarChart2 className="h-4 w-4" />
                Update PV
              </Button>
              <Button 
                onClick={handlePrediction}
                disabled={isPredicting}
                className="bg-blue-600 hover:bg-blue-700"
              >
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
              onParameterUpdate={(id: string, value: number) => updateParameter(id, value)}
            />
        ))}
      </div>
    </div>
  )
}
