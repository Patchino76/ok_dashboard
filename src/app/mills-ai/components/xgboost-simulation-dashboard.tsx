"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ParameterSimulationCard } from "./parameter-simulation-card"
import { TargetFractionDisplay } from "./target-fraction-display"
import { Zap, Activity, Play, Pause, BarChart2 } from "lucide-react"
import { useXgboostStore } from "@/app/mills-ai/stores/xgboost-store"
import { usePredictTarget } from "@/app/mills-ai/hooks/use-predict-target"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

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
    setPredictedTarget, 
    updateParameter, 
    addTargetDataPoint,
    startSimulation,
    stopSimulation,
    updateSimulatedPV
  } = useXgboostStore()
  
  const [autoPredict, setAutoPredict] = useState(false)
  const { predictTarget, isPredicting } = usePredictTarget()

  const handlePrediction = async () => {
    const paramValues = Object.fromEntries(
      parameters.map(param => [param.id, param.value])
    )
    
    try {
      const result = await predictTarget({
        modelName,
        parameters: paramValues
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
      {/* Target Display */}
      <TargetFractionDisplay
        currentTarget={currentTarget}
        currentPV={currentPV}
        targetData={targetData}
        isOptimizing={isPredicting}
      />

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{parameters.length}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Active Parameters</div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {inRangeCount}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">In Range</div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{currentTarget?.toFixed(1)}%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Fraction Target</div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {simulationActive ? "RUNNING" : "PAUSED"}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Simulation Status</div>
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

      {/* Parameter Control Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {parameters.map((parameter) => (
          <ParameterSimulationCard
            key={parameter.id}
            parameter={parameter}
            bounds={parameterBounds[parameter.id] || [0, 100]}
            onParameterUpdate={(id: string, value: number) => updateParameter(id, value)}
          />
        ))}
      </div>
    </div>
  )
}
