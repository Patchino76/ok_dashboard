"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// import { Checkbox } from "@/components/ui/checkbox" // Component not available, using input type checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown } from "lucide-react"
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

interface EnhancedModelTrainingProps {
  currentMill: number
  onMillChange: (mill: number) => void
  onTrainModel: (config: CascadeTrainingConfig) => void
  isTraining: boolean
  trainingProgress: number
  trainingError: string | null
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
  trainingError
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
  
  // Dropdown open states
  const [mvDropdownOpen, setMvDropdownOpen] = useState(false)
  const [cvDropdownOpen, setCvDropdownOpen] = useState(false)
  const [dvDropdownOpen, setDvDropdownOpen] = useState(false)
  
  // Refs for click outside detection
  const mvDropdownRef = useRef<HTMLDivElement>(null)
  const cvDropdownRef = useRef<HTMLDivElement>(null)
  const dvDropdownRef = useRef<HTMLDivElement>(null)

  // Initialize dates to last 30 days
  useEffect(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(now.toISOString().split('T')[0])
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])
  }, [])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mvDropdownRef.current && !mvDropdownRef.current.contains(event.target as Node)) {
        setMvDropdownOpen(false)
      }
      if (cvDropdownRef.current && !cvDropdownRef.current.contains(event.target as Node)) {
        setCvDropdownOpen(false)
      }
      if (dvDropdownRef.current && !dvDropdownRef.current.contains(event.target as Node)) {
        setDvDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Available parameters for each category from VariableClassifier
  const mvParameters = getMVs()
  const cvParameters = getCVs()
  const dvParameters = getDVs()
  const targetParameters = getTargets()

  const handleFeatureToggle = (
    featureId: string, 
    category: 'MV' | 'CV' | 'DV',
    isChecked: boolean
  ) => {
    switch (category) {
      case 'MV':
        setSelectedMVs(prev => 
          isChecked ? [...prev, featureId] : prev.filter(id => id !== featureId)
        )
        break
      case 'CV':
        setSelectedCVs(prev => 
          isChecked ? [...prev, featureId] : prev.filter(id => id !== featureId)
        )
        break
      case 'DV':
        setSelectedDVs(prev => 
          isChecked ? [...prev, featureId] : prev.filter(id => id !== featureId)
        )
        break
    }
  }

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
                {[7, 8, 9, 10].map(mill => (
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-600" />
              <Label className="text-base font-medium">Manipulated Variables (MVs)</Label>
              <Badge variant="secondary" className="text-xs">
                {selectedMVs.length} selected
              </Badge>
            </div>
            <div className="relative" ref={mvDropdownRef}>
              <button
                type="button"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setMvDropdownOpen(!mvDropdownOpen)}
                disabled={isTraining}
              >
                <span className="text-muted-foreground">Select manipulated variables</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {mvDropdownOpen && (
                <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 mt-1 w-full">
                  {mvParameters.map((param: VariableInfo) => (
                    <div
                      key={param.id}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        if (selectedMVs.includes(param.id)) {
                          setSelectedMVs(selectedMVs.filter(id => id !== param.id))
                        } else {
                          setSelectedMVs([...selectedMVs, param.id])
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {selectedMVs.includes(param.id) ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4" />
                        )}
                        <Wrench className="h-4 w-4 text-blue-600" />
                        {param.name} ({param.unit})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedMVs.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Selected Manipulated Variables:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedMVs.map(id => {
                    const param = mvParameters.find(p => p.id === id)
                    return param ? (
                      <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-100">
                        <Wrench className="h-3 w-3 mr-1" />
                        {param.name}
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Controlled Variables (CVs) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              <Label className="text-base font-medium">Controlled Variables (CVs)</Label>
              <Badge variant="secondary" className="text-xs">
                {selectedCVs.length} selected
              </Badge>
            </div>
            <div className="relative" ref={cvDropdownRef}>
              <button
                type="button"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCvDropdownOpen(!cvDropdownOpen)}
                disabled={isTraining}
              >
                <span className="text-muted-foreground">Select controlled variables</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {cvDropdownOpen && (
                <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 mt-1 w-full">
                  {cvParameters.map((param: VariableInfo) => (
                    <div
                      key={param.id}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        if (selectedCVs.includes(param.id)) {
                          setSelectedCVs(selectedCVs.filter(id => id !== param.id))
                        } else {
                          setSelectedCVs([...selectedCVs, param.id])
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {selectedCVs.includes(param.id) ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4" />
                        )}
                        <Activity className="h-4 w-4 text-purple-600" />
                        {param.name} ({param.unit})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCVs.length > 0 && (
              <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Selected Controlled Variables:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedCVs.map(id => {
                    const param = cvParameters.find(p => p.id === id)
                    return param ? (
                      <Badge key={id} variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-100">
                        <Activity className="h-3 w-3 mr-1" />
                        {param.name}
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Disturbance Variables (DVs) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-600" />
              <Label className="text-base font-medium">Disturbance Variables (DVs)</Label>
              <Badge variant="secondary" className="text-xs">
                {selectedDVs.length} selected
              </Badge>
            </div>
            <div className="relative" ref={dvDropdownRef}>
              <button
                type="button"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setDvDropdownOpen(!dvDropdownOpen)}
                disabled={isTraining}
              >
                <span className="text-muted-foreground">Select disturbance variables</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {dvDropdownOpen && (
                <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 mt-1 w-full">
                  {dvParameters.map((param: VariableInfo) => (
                    <div
                      key={param.id}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        if (selectedDVs.includes(param.id)) {
                          setSelectedDVs(selectedDVs.filter(id => id !== param.id))
                        } else {
                          setSelectedDVs([...selectedDVs, param.id])
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {selectedDVs.includes(param.id) ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4" />
                        )}
                        <Zap className="h-4 w-4 text-orange-600" />
                        {param.name} ({param.unit})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedDVs.length > 0 && (
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">Selected Disturbance Variables:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedDVs.map(id => {
                    const param = dvParameters.find(p => p.id === id)
                    return param ? (
                      <Badge key={id} variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-100">
                        <Zap className="h-3 w-3 mr-1" />
                        {param.name}
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Advanced Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Test Size</Label>
            <Select
              value={testSize.toString()}
              onValueChange={(value) => setTestSize(parseFloat(value))}
              disabled={isTraining}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.1">10%</SelectItem>
                <SelectItem value="0.2">20%</SelectItem>
                <SelectItem value="0.3">30%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Resample Frequency</Label>
            <Select
              value={resampleFreq}
              onValueChange={setResampleFreq}
              disabled={isTraining}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30s">30 seconds</SelectItem>
                <SelectItem value="1min">1 minute</SelectItem>
                <SelectItem value="5min">5 minutes</SelectItem>
                <SelectItem value="10min">10 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Model Name Suffix (Optional)</Label>
            <Input
              value={modelNameSuffix}
              onChange={(e) => setModelNameSuffix(e.target.value)}
              placeholder="e.g., v2, test"
              disabled={isTraining}
            />
          </div>
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
                Training Cascade Model... {trainingProgress.toFixed(0)}%
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4 mr-2" />
                Train Cascade Model (Mill {currentMill}, {targetVariable})
              </>
            )}
          </Button>
          
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
