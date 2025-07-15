"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FeatureTargetConfiguration } from "./feature-target-configuration"
import { ModelTrainingResults } from "./model-training-results"
import { ModelPredictionResults } from "./model-prediction-results"
import { Brain, Play, Settings, BarChart3, AlertCircle, Activity } from "lucide-react"
import { useModelTraining } from "../hooks/useModelTraining"
import { useModelPrediction } from "../hooks/useModelPrediction"

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
  modelId?: string
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
      description: "Разход на входяща руда към мелницата",
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
      description: "Разход на вода в мелницата",
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
      description: "Разход на вода в зумпф",
    },
    {
      id: "MotorAmp",
      name: "Ток на елетродвигателя",
      type: "feature",
      enabled: true,
      min: 150,
      max: 250,
      currentMin: 180,
      currentMax: 220,
      unit: "A",
      description: "Консумация на ток от електродвигателя на мелницата",
    },
    {
      id: "DensityHC",
      name: "Плътност на ХЦ",
      type: "feature",
      enabled: true,
      min: 1200,
      max: 2000,
      currentMin: 1700,
      currentMax: 1900,
      unit: "g/L",
      description: "Плътност на пулп в хидроциклона",
    },
    {
      id: "PressureHC",
      name: "Налягане на ХЦ",
      type: "feature",
      enabled: true,
      min: 0.0,
      max: 0.6,
      currentMin: 0.3,
      currentMax: 0.5,
      unit: "bar",
      description: "Работно налягане в хидроциклона",
    },
    {
      id: "PumpRPM",
      name: "Обороти на помпата",
      type: "feature",
      enabled: true,
      min: 0,
      max: 800,
      currentMin: 650,
      currentMax: 780,
      unit: "rev/min",
      description: "Обороти на работната помпа",
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
      description: "Процентно съдържание на шисти в рудата",
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
      description: "Процентно съдържание на дайки в рудата",
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
      description: "Процентно съдържание на гранодиорити в рудата",
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
      description: "Процент материал в клас +12 милиметра",
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
      description: "Основна целева стойност - финност на смилане -80 микрона",
    },
  ])

  const [isTraining, setIsTraining] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false)
  const [trainingResults, setTrainingResults] = useState<TrainingResults | null>(null)
  const [predictionResult, setPredictionResult] = useState<any>(null)
  const { trainModel, isLoading: isTrainingLoading, progress: trainingProgress, error: trainingError } = useModelTraining()
  const { predictWithModel, isLoading: isPredictionLoading, result, error: predictionError } = useModelPrediction()

  const handleParameterUpdate = (updatedParameter: ModelParameter) => {
    setParameters((prev) => prev.map((p) => (p.id === updatedParameter.id ? updatedParameter : p)))
  }

  const handleTrainModel = async () => {
    try {
      setIsTraining(true)
      const results = await trainModel(parameters)
      setTrainingResults(results)
    } catch (error) {
      console.error('Error training model:', error)
    } finally {
      setIsTraining(false)
    }
  }

  const handlePredictWithModel = async () => {
    try {
      setIsPredicting(true)
      const predictionData = await predictWithModel(parameters, trainingResults?.modelId || 'latest')
      console.log('Prediction result:', predictionData)
      setPredictionResult(predictionData)
    } catch (error) {
      console.error('Error predicting with model:', error)
    } finally {
      setIsPredicting(false)
    }
  }

  const enabledFeatures = parameters.filter((p) => p.type === "feature" && p.enabled).length
  const selectedTargets = parameters.filter((p) => p.type === "target" && p.enabled).length
  const canTrain = enabledFeatures > 0 && selectedTargets > 0

  return (
    <div className="space-y-6">

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
        <div className="mb-6">
          {trainingError && (
            <div className="p-4 mb-4 border border-red-200 bg-red-50 rounded-md flex items-center text-red-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Грешка при обучението: {trainingError}</span>
            </div>
          )}
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  Training Results
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <Badge variant="outline">{enabledFeatures} Features</Badge>
                    <Badge variant="outline">{selectedTargets} Targets</Badge>
                    {trainingResults && <Badge variant="default">Model Trained</Badge>}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center justify-between">
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
                  disabled={isTraining || isTrainingLoading || !parameters.some(p => p.type === 'target' && p.enabled)}
                >
                  {isTraining || isTrainingLoading ? (
                    <>
                      <BarChart3 className="mr-2 h-4 w-4 animate-pulse" />
                      Обучение...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Обучи модел
                    </>
                  )}
                </Button>
              </div>
              {trainingResults ? (
                <>
                  <ModelTrainingResults results={trainingResults} />
                  
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold flex items-center">
                        <Activity className="mr-2 h-5 w-5 text-indigo-600" />
                        Резултати от предсказване
                      </h3>
                      <Button 
                        onClick={handlePredictWithModel} 
                        disabled={isPredicting || isPredictionLoading || !trainingResults || !parameters.some(p => p.type === 'target' && p.enabled)}
                        variant={!trainingResults ? "outline" : "default"}
                        size="sm"
                      >
                        {isPredicting || isPredictionLoading ? (
                          <>
                            <Activity className="mr-2 h-4 w-4 animate-pulse" />
                            Предсказване...
                          </>
                        ) : (
                          <>
                            <Activity className="mr-2 h-4 w-4" />
                            Тествай модела
                          </>
                        )}
                      </Button>
                    </div>
                    {predictionResult ? (
                      <ModelPredictionResults
                        result={predictionResult}
                        targetName={parameters.find(p => p.type === 'target' && p.enabled)?.name || ''}
                        targetUnit={parameters.find(p => p.type === 'target' && p.enabled)?.unit || ''}
                      />
                    ) : (
                      <div className="p-4 border border-gray-200 bg-gray-50 rounded-md text-center">
                        <p className="text-gray-500 text-sm">Натиснете "Тествай модела" за да видите предсказвание</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Обучете модела, за да видите резултати</p>
                </div>
              )}
              
              {predictionError && (
                <div className="p-4 mt-4 border border-red-200 bg-red-50 rounded-md flex items-center text-red-800">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span>Грешка при предсказването: {predictionError}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
