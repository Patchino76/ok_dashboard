"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// import { Checkbox } from "@/components/ui/checkbox" // Component not available, using input type checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { 
  GraduationCap, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Target,
  Wrench,
  Activity
} from "lucide-react"
import { getMVs, getCVs, getDVs, getTargets, VariableInfo } from "../../data/variable-classifier-helper"
import { ColorfulFeatureSelect } from "./colorful-feature-select"

interface EnhancedModelTrainingProps {
  currentMill: number
  onMillChange: (mill: number) => void
  onTrainModel: (config: CascadeTrainingConfig) => void
  isTraining: boolean
  trainingProgress: number
  trainingError: string | null
  trainingSuccess?: boolean
}

export interface CascadeTrainingConfig {
  mill_number: number
  start_date: string
  end_date: string
  mv_features: string[]
  cv_features: string[]
  dv_features: string[]
  target_variable: string
  test_size: number
  resample_freq: string
  model_name_suffix?: string
}

export function EnhancedModelTraining({
  currentMill,
  onMillChange,
  onTrainModel,
  isTraining,
  trainingProgress,
  trainingError,
  trainingSuccess = false
}: EnhancedModelTrainingProps) {
  // Training configuration state
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedMVs, setSelectedMVs] = useState<string[]>(['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'])
  const [selectedCVs, setSelectedCVs] = useState<string[]>(['PulpHC', 'DensityHC', 'PressureHC'])
  const [selectedDVs, setSelectedDVs] = useState<string[]>(['Shisti', 'Daiki', 'Grano'])
  const [targetVariable, setTargetVariable] = useState<string>('PSI200')
  const [testSize, setTestSize] = useState<number>(0.2)
  const [resampleFreq, setResampleFreq] = useState<string>('1min')
  const [modelNameSuffix, setModelNameSuffix] = useState<string>('')
  
  // Initialize dates to last 30 days
  useEffect(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(now.toISOString().split('T')[0])
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])
  }, [])

  // Available parameters for each category from VariableClassifier
  const mvParameters = getMVs()
  const cvParameters = getCVs()
  const dvParameters = getDVs()
  const targetParameters = getTargets()

  const handleTrainModel = () => {
    const config: CascadeTrainingConfig = {
      mill_number: currentMill,
      start_date: startDate,
      end_date: endDate,
      mv_features: selectedMVs,
      cv_features: selectedCVs,
      dv_features: selectedDVs,
      target_variable: targetVariable,
      test_size: testSize,
      resample_freq: resampleFreq,
      model_name_suffix: modelNameSuffix || undefined
    }
    onTrainModel(config)
  }

  const isConfigValid = () => {
    return (
      currentMill > 0 &&
      startDate &&
      endDate &&
      selectedMVs.length > 0 &&
      selectedCVs.length > 0 &&
      targetVariable &&
      new Date(startDate) < new Date(endDate)
    )
  }

  const getFeatureCount = () => {
    return selectedMVs.length + selectedCVs.length + selectedDVs.length
  }

  return (
    <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-green-600" />
          Enhanced Cascade Model Training
        </CardTitle>
        <div className="flex gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1 bg-green-100 text-green-800 border-green-200">
            Mill {currentMill}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 bg-blue-100 text-blue-800 border-blue-200">
            {getFeatureCount()} Features Selected
          </Badge>
          {isConfigValid() && (
            <Badge variant="outline" className="rounded-full px-3 py-1 bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Ready
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Mill Selection and Basic Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mill Selection</Label>
            <Select
              value={currentMill.toString()}
              onValueChange={(value) => onMillChange(parseInt(value))}
              disabled={isTraining}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[6, 7, 8].map(mill => (
                  <SelectItem key={mill} value={mill.toString()}>
                    Mill {mill}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Target Variable</Label>
            <Select
              value={targetVariable}
              onValueChange={setTargetVariable}
              disabled={isTraining}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targetParameters.map((target: VariableInfo) => (
                  <SelectItem key={target.id} value={target.id}>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-600" />
                      {target.name} ({target.unit})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isTraining}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isTraining}
            />
          </div>
        </div>

        <Separator />

        {/* Feature Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Feature Selection for Cascade Model
          </h3>
          
          {/* Manipulated Variables (MVs) */}
          <ColorfulFeatureSelect
            label="Manipulated Variables (MVs)"
            placeholder="Select manipulated variables"
            selectedLabel="Selected Manipulated Variables:"
            options={mvParameters}
            selectedValues={selectedMVs}
            onChange={setSelectedMVs}
            icon={Wrench}
            colorTheme={{
              icon: "text-blue-600",
              triggerBg: "bg-blue-50/70 dark:bg-blue-950/30",
              triggerBorder: "border border-blue-200 dark:border-blue-800",
              triggerText: "text-blue-900 dark:text-blue-100",
              dropdownBg: "bg-blue-50 dark:bg-blue-950/20",
              dropdownBorder: "border-blue-200 dark:border-blue-800",
              badge: "bg-blue-100 dark:bg-blue-900",
              badgeText: "text-blue-800 dark:text-blue-100"
            }}
            disabled={isTraining}
          />

          {/* Controlled Variables (CVs) */}
          <ColorfulFeatureSelect
            label="Controlled Variables (CVs)"
            placeholder="Select controlled variables"
            selectedLabel="Selected Controlled Variables:"
            options={cvParameters}
            selectedValues={selectedCVs}
            onChange={setSelectedCVs}
            icon={Activity}
            colorTheme={{
              icon: "text-purple-600",
              triggerBg: "bg-purple-50/70 dark:bg-purple-950/30",
              triggerBorder: "border border-purple-200 dark:border-purple-800",
              triggerText: "text-purple-900 dark:text-purple-100",
              dropdownBg: "bg-purple-50 dark:bg-purple-950/20",
              dropdownBorder: "border-purple-200 dark:border-purple-800",
              badge: "bg-purple-100 dark:bg-purple-900",
              badgeText: "text-purple-800 dark:text-purple-100"
            }}
            disabled={isTraining}
          />

          {/* Disturbance Variables (DVs) */}
          <ColorfulFeatureSelect
            label="Disturbance Variables (DVs)"
            placeholder="Select disturbance variables"
            selectedLabel="Selected Disturbance Variables:"
            options={dvParameters}
            selectedValues={selectedDVs}
            onChange={setSelectedDVs}
            icon={Zap}
            colorTheme={{
              icon: "text-orange-600",
              triggerBg: "bg-orange-50/70 dark:bg-orange-950/30",
              triggerBorder: "border border-orange-200 dark:border-orange-800",
              triggerText: "text-orange-900 dark:text-orange-100",
              dropdownBg: "bg-orange-50 dark:bg-orange-950/20",
              dropdownBorder: "border-orange-200 dark:border-orange-800",
              badge: "bg-orange-100 dark:bg-orange-900",
              badgeText: "text-orange-800 dark:text-orange-100"
            }}
            disabled={isTraining}
          />
        </div>


        {/* Training Button and Status */}
        <div className="space-y-3">
          <Button
            onClick={handleTrainModel}
            disabled={!isConfigValid() || isTraining}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            size="lg"
          >
            {isTraining ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                Training Model... {trainingProgress.toFixed(0)}%
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4 mr-2" />
                Train Model
              </>
            )}
          </Button>
          
          {trainingSuccess && !isTraining && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              Model trained successfully! Ready for predictions and optimization.
            </div>
          )}
          
          {trainingError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {trainingError}
            </div>
          )}
          
          {!isConfigValid() && !isTraining && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Configuration Required</span>
              </div>
              <ul className="text-xs space-y-1 ml-6">
                {selectedMVs.length === 0 && <li>• Select at least one Manipulated Variable (MV)</li>}
                {selectedCVs.length === 0 && <li>• Select at least one Controlled Variable (CV)</li>}
                {!startDate && <li>• Set start date</li>}
                {!endDate && <li>• Set end date</li>}
                {startDate && endDate && new Date(startDate) >= new Date(endDate) && <li>• Start date must be before end date</li>}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
