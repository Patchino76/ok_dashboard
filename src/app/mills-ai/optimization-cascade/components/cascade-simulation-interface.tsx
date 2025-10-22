"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Sliders, Target, Play, Pause, RotateCcw, Zap } from "lucide-react"
import { toast } from "sonner"

import { useCascadeSimulationStore, SimulationParameter } from "../stores/cascade-simulation-store"
import { useCascadePrediction } from "../hooks/useCascadePrediction"
import { VerticalParameterSlider } from "./vertical-parameter-slider"
import { CVParameterDisplay } from "./cv-parameter-display"
import { classifyParameters } from "../../data/cascade-parameter-classification"
import { millsParameters } from "../../data/mills-parameters"
import { cascadeBG } from "../translations/bg"

interface CascadeSimulationInterfaceProps {
  modelFeatures?: string[]
  modelTarget?: string
  className?: string
}

export function CascadeSimulationInterface({
  modelFeatures = [],
  modelTarget = "PSI80",
  className = ""
}: CascadeSimulationInterfaceProps) {
  const {
    mvParameters,
    cvParameters,
    dvParameters,
    currentPrediction,
    isSimulating,
    isPredicting,
    autoPredict,
    setMVParameters,
    setCVParameters,
    setDVParameters,
    updateMVValue,
    updateDVValue,
    setCurrentPrediction,
    addPredictionToHistory,
    setIsSimulating,
    setIsPredicting,
    setAutoPredict,
    resetToDefaults
  } = useCascadeSimulationStore()

  const { predictCascade, isLoading, error } = useCascadePrediction()
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  // Initialize parameters from model features
  useEffect(() => {
    if (modelFeatures.length === 0) return

    const { mv_parameters, dv_parameters, unknown_parameters } = classifyParameters(modelFeatures)
    
    // Create simulation parameters from mill parameters
    const createSimulationParams = (paramIds: string[], varType: "MV" | "CV" | "DV"): SimulationParameter[] => {
      return paramIds.map(id => {
        const millParam = millsParameters.find(p => p.id === id)
        return {
          id,
          name: millParam?.name || id,
          unit: millParam?.unit || '',
          value: millParam ? (millParam.min + millParam.max) / 2 : 50,
          min: millParam?.min || 0,
          max: millParam?.max || 100,
          varType
        }
      })
    }

    setMVParameters(createSimulationParams(mv_parameters, "MV"))
    setDVParameters(createSimulationParams(dv_parameters, "DV"))
    setCVParameters(createSimulationParams(unknown_parameters, "CV"))
  }, [modelFeatures, setMVParameters, setCVParameters, setDVParameters])

  // Debounced prediction function
  const debouncedPredict = useCallback(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    const timer = setTimeout(async () => {
      if (!autoPredict || mvParameters.length === 0) return

      setIsPredicting(true)
      
      const mvValues = mvParameters.reduce((acc, param) => {
        acc[param.id] = param.value
        return acc
      }, {} as Record<string, number>)

      const dvValues = dvParameters.reduce((acc, param) => {
        acc[param.id] = param.value
        return acc
      }, {} as Record<string, number>)

      const prediction = await predictCascade(mvValues, dvValues)
      
      if (prediction) {
        setCurrentPrediction(prediction)
        addPredictionToHistory(prediction)
      }
      
      setIsPredicting(false)
    }, 500)

    setDebounceTimer(timer)
  }, [mvParameters, dvParameters, autoPredict, predictCascade, setCurrentPrediction, addPredictionToHistory, setIsPredicting, debounceTimer])

  // Trigger prediction when MV parameters change
  useEffect(() => {
    if (isSimulating && autoPredict) {
      debouncedPredict()
    }
  }, [mvParameters, debouncedPredict, isSimulating, autoPredict])

  // Handle MV parameter changes
  const handleMVChange = useCallback((id: string, value: number) => {
    updateMVValue(id, value)
  }, [updateMVValue])

  // Handle DV parameter changes
  const handleDVChange = useCallback((id: string, value: number) => {
    updateDVValue(id, value)
  }, [updateDVValue])

  // Manual prediction trigger
  const handleManualPredict = useCallback(async () => {
    if (mvParameters.length === 0) {
      toast.error("No MV parameters configured")
      return
    }

    setIsPredicting(true)
    
    const mvValues = mvParameters.reduce((acc, param) => {
      acc[param.id] = param.value
      return acc
    }, {} as Record<string, number>)

    const dvValues = dvParameters.reduce((acc, param) => {
      acc[param.id] = param.value
      return acc
    }, {} as Record<string, number>)

    const prediction = await predictCascade(mvValues, dvValues)
    
    if (prediction) {
      setCurrentPrediction(prediction)
      addPredictionToHistory(prediction)
      toast.success("Prediction completed successfully")
    }
    
    setIsPredicting(false)
  }, [mvParameters, dvParameters, predictCascade, setCurrentPrediction, addPredictionToHistory, setIsPredicting])

  // Handle simulation toggle
  const handleSimulationToggle = useCallback((enabled: boolean) => {
    setIsSimulating(enabled)
    if (enabled) {
      toast.success("Simulation mode activated")
    } else {
      toast.info("Simulation mode deactivated")
    }
  }, [setIsSimulating])

  // Handle reset
  const handleReset = useCallback(() => {
    resetToDefaults()
    // Clear current prediction by setting it to null in the store
    // Note: We need to update the store to handle null values properly
    toast.success("Parameters reset to defaults")
  }, [resetToDefaults])

  // Get predicted CV values
  const predictedCVs = useMemo(() => {
    return currentPrediction?.predicted_cvs || {}
  }, [currentPrediction])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Simulation Controls */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-purple-600" />
              Simulation Controls
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isSimulating ? "default" : "outline"} className={
                isSimulating ? "bg-purple-100 text-purple-800 border-purple-200" : ""
              }>
                {isSimulating ? "ACTIVE" : "INACTIVE"}
              </Badge>
              {isPredicting && (
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                  PREDICTING...
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Simulation Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-sm">Simulation Mode</div>
                <div className="text-xs text-slate-500">Enable interactive parameter control</div>
              </div>
              <Switch
                checked={isSimulating}
                onCheckedChange={handleSimulationToggle}
              />
            </div>

            {/* Auto-Predict Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-sm">Auto-Predict</div>
                <div className="text-xs text-slate-500">Automatic predictions on parameter changes</div>
              </div>
              <Switch
                checked={autoPredict}
                onCheckedChange={setAutoPredict}
                disabled={!isSimulating}
              />
            </div>

            {/* Manual Controls */}
            <div className="flex gap-2">
              <Button
                onClick={handleManualPredict}
                disabled={!isSimulating || isPredicting || isLoading}
                size="sm"
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                Predict
              </Button>
              <Button
                onClick={handleReset}
                disabled={isPredicting || isLoading}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Interface */}
      {isSimulating && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MV Parameters (Left) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-amber-600">🎛️</span>
              {cascadeBG.parameters.manipulated}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {mvParameters.map((param) => (
                <VerticalParameterSlider
                  key={param.id}
                  parameter={param}
                  onValueChange={handleMVChange}
                  disabled={!isSimulating}
                />
              ))}
            </div>
          </div>

          {/* CV Parameters (Center) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-blue-600">📊</span>
              {cascadeBG.parameters.controlled}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {cvParameters.map((param) => (
                <CVParameterDisplay
                  key={param.id}
                  id={param.id}
                  name={param.name}
                  unit={param.unit}
                  predictedValue={predictedCVs[param.id] || null}
                  bounds={[param.min, param.max]}
                />
              ))}
            </div>
          </div>

          {/* Target & DV Parameters (Right) */}
          <div className="space-y-4">
            {/* Target Display */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Target Variable
              </h3>
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-purple-50/90 dark:from-slate-800 dark:to-purple-900/30 ring-2 ring-purple-200/80 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {currentPrediction?.predicted_target?.toFixed(3) || '--'}
                    </div>
                    <div className="text-sm text-slate-600">{modelTarget}</div>
                    <Badge variant="outline" className={`mt-1 ${
                      currentPrediction?.is_feasible 
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-red-100 text-red-800 border-red-200"
                    }`}>
                      {currentPrediction?.is_feasible ? "Feasible" : "Infeasible"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* DV Parameters */}
            {dvParameters.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-emerald-600">🧪</span>
                  {cascadeBG.parameters.disturbance}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {dvParameters.map((param) => (
                    <VerticalParameterSlider
                      key={param.id}
                      parameter={param}
                      onValueChange={handleDVChange}
                      disabled={!isSimulating}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inactive State */}
      {!isSimulating && (
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="py-12">
            <div className="text-center text-slate-500">
              <Sliders className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold mb-2">Simulation Mode Inactive</h3>
              <p className="text-sm mb-4">
                Enable simulation mode to start interactive parameter manipulation and real-time cascade predictions.
              </p>
              <Button onClick={() => handleSimulationToggle(true)} className="bg-purple-600 hover:bg-purple-700">
                <Zap className="h-4 w-4 mr-2" />
                Start Simulation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
