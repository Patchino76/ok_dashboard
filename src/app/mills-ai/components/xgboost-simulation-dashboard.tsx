"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ParameterSimulationCard } from "@/app/mills-ai/components/parameter-simulation-card"
import { TargetFractionDisplay } from "@/app/mills-ai/components/target-fraction-display"
import { Zap, Activity } from "lucide-react"
import { useXgboostStore } from "@/app/mills-ai/stores/xgboost-store"
import { usePredictTarget } from "@/app/mills-ai/hooks/use-predict-target"
import { Button } from "@/components/ui/button"

interface ParameterData {
  timestamp: number
  value: number
  target: number
}

export function XgboostSimulationDashboard() {
  const { 
    parameters, 
    parameterBounds, 
    currentTarget, 
    targetData, 
    modelName,
    setPredictedTarget, 
    updateParameter, 
    addTargetDataPoint
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
              <div className="text-2xl font-bold text-orange-600">TUNING</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Status</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <input 
                  type="checkbox"
                  checked={autoPredict}
                  onChange={(e) => setAutoPredict(e.target.checked)}
                  className="rounded"
                />
                Auto-predict on parameter change
              </label>
            </div>
            <Button 
              onClick={handlePrediction}
              disabled={isPredicting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPredicting ? "Predicting..." : "Predict Target"}
            </Button>
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
            onParameterUpdate={(id, value) => {
              updateParameter(id, value)
            }}
          />
        ))}
      </div>
    </div>
  )
}
