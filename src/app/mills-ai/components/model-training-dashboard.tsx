"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FeatureTargetConfiguration } from "./feature-target-configuration"
import { ModelTrainingResults } from "./model-training-results"
import { Brain, Play, Settings, BarChart3, AlertCircle } from "lucide-react"
import { useModelTraining } from "../hooks/useModelTraining"

export interface ModelParameter {
  id: string
  name: string
  type: "feature" | "target" | "disabled"
  enabled: boolean
  min: number
  max: number
  currentMin: number
  currentMax: number
  unit: string
  description: string
}

export interface TrainingResults {
  mae: number
  mse: number
  rmse: number
  r2: number
  mape: number
  trainingTime: number
  featureImportance: Array<{ feature: string; importance: number }>
  validationCurve: Array<{ iteration: number; trainLoss: number; valLoss: number }>
}

export function ModelTrainingDashboard() {
  const [parameters, setParameters] = useState<ModelParameter[]>([
    {
      id: "ore_feed",
      name: "Ore Feed Rate",
      type: "feature",
      enabled: true,
      min: 80,
      max: 250,
      currentMin: 100,
      currentMax: 200,
      unit: "t/h",
      description: "Primary ore input rate to the mill",
    },
    {
      id: "water_mill",
      name: "Water Mill",
      type: "feature",
      enabled: true,
      min: 20,
      max: 80,
      currentMin: 30,
      currentMax: 70,
      unit: "m³/h",
      description: "Water flow rate to the mill",
    },
    {
      id: "water_zumpf",
      name: "Water ZUMPF",
      type: "feature",
      enabled: true,
      min: 15,
      max: 60,
      currentMin: 20,
      currentMax: 50,
      unit: "m³/h",
      description: "ZUMPF water circulation rate",
    },
    {
      id: "mill_power",
      name: "Mill Power",
      type: "feature",
      enabled: true,
      min: 1500,
      max: 4000,
      currentMin: 2000,
      currentMax: 3500,
      unit: "kW",
      description: "Mill motor power consumption",
    },
    {
      id: "pulp_density",
      name: "Pulp Density",
      type: "feature",
      enabled: true,
      min: 1200,
      max: 2000,
      currentMin: 1400,
      currentMax: 1900,
      unit: "g/L",
      description: "Density of the pulp mixture",
    },
    {
      id: "system_pressure",
      name: "System Pressure",
      type: "feature",
      enabled: true,
      min: 1.0,
      max: 5.0,
      currentMin: 1.5,
      currentMax: 4.0,
      unit: "bar",
      description: "Operating pressure of the system",
    },
    {
      id: "ph_level",
      name: "pH Level",
      type: "feature",
      enabled: false,
      min: 6.0,
      max: 12.0,
      currentMin: 7.0,
      currentMax: 10.0,
      unit: "pH",
      description: "Acidity/alkalinity of the process",
    },
    {
      id: "temperature",
      name: "Process Temperature",
      type: "feature",
      enabled: true,
      min: 40,
      max: 90,
      currentMin: 50,
      currentMax: 85,
      unit: "°C",
      description: "Operating temperature of the process",
    },
    {
      id: "particle_size",
      name: "Particle Size",
      type: "disabled",
      enabled: false,
      min: 50,
      max: 500,
      currentMin: 75,
      currentMax: 300,
      unit: "μm",
      description: "Average particle size distribution",
    },
    {
      id: "fraction_recovery",
      name: "Fraction Recovery",
      type: "target",
      enabled: true,
      min: 60,
      max: 95,
      currentMin: 70,
      currentMax: 90,
      unit: "%",
      description: "Primary target - fraction recovery rate",
    },
    {
      id: "energy_efficiency",
      name: "Energy Efficiency",
      type: "disabled",
      enabled: false,
      min: 70,
      max: 95,
      currentMin: 75,
      currentMax: 90,
      unit: "%",
      description: "Secondary target - energy utilization efficiency",
    },
  ])

  const [isTraining, setIsTraining] = useState(false)
  const [trainingResults, setTrainingResults] = useState<TrainingResults | null>(null)
  const { trainModel, isLoading, progress: trainingProgress, error: trainingError } = useModelTraining()

  const handleParameterUpdate = (updatedParameter: ModelParameter) => {
    setParameters((prev) => prev.map((p) => (p.id === updatedParameter.id ? updatedParameter : p)))
  }

  const handleTrainModel = async () => {
    try {
      setIsTraining(true)
      setTrainingResults(null)
      
      // Call the API to train the model
      const results = await trainModel(parameters)
      
      // Update UI with results
      setTrainingResults(results)
    } catch (err) {
      console.error('Error during model training:', err)
    } finally {
      setIsTraining(false)
    }
  }

  const enabledFeatures = parameters.filter((p) => p.type === "feature" && p.enabled).length
  const selectedTargets = parameters.filter((p) => p.type === "target" && p.enabled).length
  const canTrain = enabledFeatures > 0 && selectedTargets > 0

  return (
    <div className="space-y-6">
      {/* Training Control Panel */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600" />
              Model Configuration
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">{enabledFeatures} Features</Badge>
              <Badge variant="outline">{selectedTargets} Targets</Badge>
              {trainingResults && <Badge variant="default">Model Trained</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Configure your features and targets, then train the XGBoost model
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                {canTrain ? "Ready to train" : "Select at least 1 feature and 1 target to train"}
              </p>
            </div>
            <Button
              onClick={handleTrainModel}
              disabled={!canTrain || isTraining || isLoading}
              className="flex items-center gap-2 px-6"
              size="lg"
            >
              {isLoading || isTraining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Training... {trainingProgress.toFixed(0)}%
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Train Model
                </>
              )}
            </Button>
            {trainingError && (
              <div className="mt-2 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                <span>Error: {trainingError}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Feature/Target Configuration */}
        <div className="xl:col-span-2">
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Features & Targets Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FeatureTargetConfiguration parameters={parameters} onParameterUpdate={handleParameterUpdate} />
            </CardContent>
          </Card>
        </div>

        {/* Training Results */}
        <div>
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Training Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trainingResults ? (
                <ModelTrainingResults results={trainingResults} />
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Train your model to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
