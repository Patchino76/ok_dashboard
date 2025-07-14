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
  type: "feature" | "target"
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
  trainingTime: number
  featureImportance: Array<{ feature: string; importance: number }>
  validationCurve: Array<{ iteration: number; trainLoss: number; valLoss: number }>
}

export function ModelTrainingDashboard() {
  const [parameters, setParameters] = useState<ModelParameter[]>([
    {
      id: "Ore",
      name: "Разход на руда",
      type: "feature",
      enabled: true,
      min: 140,
      max: 240,
      currentMin: 170,
      currentMax: 200,
      unit: "t/h",
      description: "Primary ore input rate to the mill",
    },
    {
      id: "WaterMill",
      name: "Вода в мелницата",
      type: "feature",
      enabled: true,
      min: 5,
      max: 25,
      currentMin: 7,
      currentMax: 20,
      unit: "m³/h",
      description: "Water flow rate to the mill",
    },
    {
      id: "WaterZumpf",
      name: "Вода в зумпфа",
      type: "feature",
      enabled: true,
      min: 140,
      max: 250,
      currentMin: 180,
      currentMax: 230,
      unit: "m³/h",
      description: "ZUMPF water circulation rate",
    },
    {
      id: "MotorAmp",
      name: "Мощност на елетродвигателя",
      type: "feature",
      enabled: true,
      min: 150,
      max: 250,
      currentMin: 180,
      currentMax: 220,
      unit: "A",
      description: "Mill motor power consumption",
    },
    {
      id: "DensityHC",
      name: "Плътност на пулп в ХЦ",
      type: "feature",
      enabled: true,
      min: 1200,
      max: 2000,
      currentMin: 1700,
      currentMax: 1900,
      unit: "g/L",
      description: "Density of the pulp mixture",
    },
    {
      id: "PressureHC",
      name: "Налягане в пулп в ХЦ",
      type: "feature",
      enabled: true,
      min: 0.0,
      max: 0.6,
      currentMin: 0.3,
      currentMax: 0.5,
      unit: "bar",
      description: "Operating pressure of the system",
    },
    {
      id: "Shisti",
      name: "Шисти",
      type: "feature",
      enabled: false,
      min: 0.0,
      max: 100.0,
      currentMin: 5.0,
      currentMax: 50.0,
      unit: "%",
      description: "Acidity/alkalinity of the process",
    },
    {
      id: "Daiki",
      name: "Дайки",
      type: "feature",
      enabled: true,
      min: 0.0,
      max: 100.0,
      currentMin: 5.0,
      currentMax: 50.0,
      unit: "%",
      description: "Operating temperature of the process",
    },
    {
      id: "Grano",
      name: "Гранодиорити",
      type: "feature",
      enabled: false,
      min: 0.0,
      max: 100.0,
      currentMin: 5.0,
      currentMax: 80.0,
      unit: "%",
      description: "Average particle size distribution",
    },
    {
      id: "Class_12",
      name: "Клас 12",
      type: "feature",
      enabled: false,
      min: 0.0,
      max: 100.0,
      currentMin: 2.0,
      currentMax: 20.0,
      unit: "%",
      description: "Secondary target - energy utilization efficiency",
    },
    {
      id: "PSI80",
      name: "Фракция -80 μk",
      type: "target",
      enabled: true,
      min: 40,
      max: 65,
      currentMin: 45,
      currentMax: 56,
      unit: "μk",
      description: "Primary target - fraction recovery rate",
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
