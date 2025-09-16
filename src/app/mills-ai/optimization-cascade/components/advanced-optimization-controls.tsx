"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Settings, 
  Zap, 
  Target, 
  Shield, 
  TrendingUp, 
  Brain, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play
} from "lucide-react"
import { AdvancedOptimizationRequest, OptimizationJob, OptimizationResults } from "../../hooks/useAdvancedCascadeOptimization"

interface AdvancedOptimizationControlsProps {
  onStartOptimization: (request: AdvancedOptimizationRequest) => void
  onCancelOptimization: () => void
  currentJob: OptimizationJob | null
  currentResults: OptimizationResults | null
  isOptimizing: boolean
  error: string | null
  dvValues: Record<string, number>
}

export function AdvancedOptimizationControls({
  onStartOptimization,
  onCancelOptimization,
  currentJob,
  currentResults,
  isOptimizing,
  error,
  dvValues
}: AdvancedOptimizationControlsProps) {
  // Optimization configuration state
  const [config, setConfig] = useState<AdvancedOptimizationRequest>({
    dv_values: dvValues,
    optimization_mode: 'multi_objective',
    n_trials: 200,
    timeout: 300, // 5 minutes
    
    // Objective weights
    target_weight: 1.0,
    constraint_weight: 0.5,
    efficiency_weight: 0.3,
    
    // Constraint handling
    soft_constraints: true,
    constraint_tolerance: 0.05,
    penalty_factor: 1000.0,
    
    // Advanced features
    robust_optimization: false,
    uncertainty_samples: 50,
    confidence_level: 0.95,
    adaptive_bounds: true,
    
    // Target bounds
    target_min: 10.0,
    target_max: 40.0
  })

  const handleConfigChange = (key: keyof AdvancedOptimizationRequest, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
      dv_values: dvValues // Always use current DV values
    }))
  }

  const handleStartOptimization = () => {
    onStartOptimization({
      ...config,
      dv_values: dvValues // Ensure current DV values
    })
  }

  const getStatusIcon = () => {
    if (!currentJob) return <Settings className="h-4 w-4" />
    
    switch (currentJob.status) {
      case 'running':
        return <Play className="h-4 w-4 text-blue-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'cancelled':
        return <Pause className="h-4 w-4 text-orange-600" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    if (!currentJob) return "bg-slate-100 text-slate-600 border-slate-200"
    
    switch (currentJob.status) {
      case 'running':
        return "bg-blue-100 text-blue-800 border-blue-200"
      case 'completed':
        return "bg-green-100 text-green-800 border-green-200"
      case 'failed':
        return "bg-red-100 text-red-800 border-red-200"
      case 'cancelled':
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  return (
    <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Advanced Cascade Optimization
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className={`rounded-full px-3 py-1 flex items-center gap-1 ${getStatusColor()}`}>
              {getStatusIcon()}
              {currentJob?.status.toUpperCase() || 'READY'}
            </Badge>
            {currentJob && (
              <Badge variant="outline" className="rounded-full px-3 py-1 bg-purple-100 text-purple-800 border-purple-200">
                {currentJob.optimization_mode}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="objectives">Objectives</TabsTrigger>
            <TabsTrigger value="constraints">Constraints</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          {/* Basic Configuration */}
          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Optimization Mode</Label>
                <Select
                  value={config.optimization_mode}
                  onValueChange={(value: any) => handleConfigChange('optimization_mode', value)}
                  disabled={isOptimizing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_objective">Single Objective</SelectItem>
                    <SelectItem value="multi_objective">Multi-Objective</SelectItem>
                    <SelectItem value="robust">Robust Optimization</SelectItem>
                    <SelectItem value="pareto">Pareto Frontier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Number of Trials</Label>
                <Input
                  type="number"
                  value={config.n_trials}
                  onChange={(e) => handleConfigChange('n_trials', parseInt(e.target.value))}
                  disabled={isOptimizing}
                  min={50}
                  max={1000}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timeout (seconds)</Label>
                <Input
                  type="number"
                  value={config.timeout || 300}
                  onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value))}
                  disabled={isOptimizing}
                  min={60}
                  max={3600}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Target Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={config.target_min || 10}
                    onChange={(e) => handleConfigChange('target_min', parseFloat(e.target.value))}
                    disabled={isOptimizing}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={config.target_max || 40}
                    onChange={(e) => handleConfigChange('target_max', parseFloat(e.target.value))}
                    disabled={isOptimizing}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Objective Weights */}
          <TabsContent value="objectives" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <Label>Target Weight: {config.target_weight.toFixed(1)}</Label>
                </div>
                <Slider
                  value={[config.target_weight]}
                  onValueChange={(value) => handleConfigChange('target_weight', value[0])}
                  disabled={isOptimizing}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <Label>Constraint Weight: {config.constraint_weight.toFixed(1)}</Label>
                </div>
                <Slider
                  value={[config.constraint_weight]}
                  onValueChange={(value) => handleConfigChange('constraint_weight', value[0])}
                  disabled={isOptimizing}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <Label>Efficiency Weight: {config.efficiency_weight.toFixed(1)}</Label>
                </div>
                <Slider
                  value={[config.efficiency_weight]}
                  onValueChange={(value) => handleConfigChange('efficiency_weight', value[0])}
                  disabled={isOptimizing}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>
          </TabsContent>
          
          {/* Constraint Handling */}
          <TabsContent value="constraints" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Soft Constraints</Label>
                  <p className="text-sm text-slate-500">Allow constraint violations with penalties</p>
                </div>
                <Switch
                  checked={config.soft_constraints}
                  onCheckedChange={(checked) => handleConfigChange('soft_constraints', checked)}
                  disabled={isOptimizing}
                />
              </div>
              
              {config.soft_constraints && (
                <>
                  <div className="space-y-2">
                    <Label>Constraint Tolerance: {(config.constraint_tolerance * 100).toFixed(1)}%</Label>
                    <Slider
                      value={[config.constraint_tolerance]}
                      onValueChange={(value) => handleConfigChange('constraint_tolerance', value[0])}
                      disabled={isOptimizing}
                      min={0.01}
                      max={0.2}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Penalty Factor</Label>
                    <Input
                      type="number"
                      value={config.penalty_factor}
                      onChange={(e) => handleConfigChange('penalty_factor', parseFloat(e.target.value))}
                      disabled={isOptimizing}
                      min={100}
                      max={10000}
                    />
                  </div>
                </>
              )}
            </div>
          </TabsContent>
          
          {/* Advanced Features */}
          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Robust Optimization
                  </Label>
                  <p className="text-sm text-slate-500">Account for uncertainty in predictions</p>
                </div>
                <Switch
                  checked={config.robust_optimization}
                  onCheckedChange={(checked) => handleConfigChange('robust_optimization', checked)}
                  disabled={isOptimizing}
                />
              </div>
              
              {config.robust_optimization && (
                <>
                  <div className="space-y-2">
                    <Label>Uncertainty Samples</Label>
                    <Input
                      type="number"
                      value={config.uncertainty_samples}
                      onChange={(e) => handleConfigChange('uncertainty_samples', parseInt(e.target.value))}
                      disabled={isOptimizing}
                      min={10}
                      max={200}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Confidence Level: {(config.confidence_level * 100).toFixed(0)}%</Label>
                    <Slider
                      value={[config.confidence_level]}
                      onValueChange={(value) => handleConfigChange('confidence_level', value[0])}
                      disabled={isOptimizing}
                      min={0.8}
                      max={0.99}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                </>
              )}
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Adaptive Bounds</Label>
                  <p className="text-sm text-slate-500">Dynamically adjust search space</p>
                </div>
                <Switch
                  checked={config.adaptive_bounds}
                  onCheckedChange={(checked) => handleConfigChange('adaptive_bounds', checked)}
                  disabled={isOptimizing}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Progress and Status */}
        {currentJob && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Job ID: {currentJob.job_id}</span>
              {currentJob.start_time && (
                <span>Started: {new Date(currentJob.start_time).toLocaleTimeString()}</span>
              )}
            </div>
            
            {currentJob.status === 'running' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>Running...</span>
                </div>
                <Progress value={undefined} className="w-full" />
              </div>
            )}
            
            {currentJob.duration_seconds && (
              <div className="text-sm text-slate-500">
                Duration: {currentJob.duration_seconds.toFixed(1)}s
              </div>
            )}
          </div>
        )}
        
        {/* Results Summary */}
        {currentResults && currentResults.status === 'completed' && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Optimization Results</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600 dark:text-slate-400">Best Value:</span>
                <span className="ml-2 font-medium">{currentResults.best_value?.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">Trials:</span>
                <span className="ml-2 font-medium">{currentResults.n_trials}</span>
              </div>
              {currentResults.optimization_summary && (
                <>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Feasibility:</span>
                    <span className="ml-2 font-medium">
                      {(currentResults.optimization_summary.feasibility_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Evaluations:</span>
                    <span className="ml-2 font-medium">{currentResults.optimization_summary.total_evaluations}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleStartOptimization}
            disabled={isOptimizing}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
          >
            {isOptimizing ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                Optimizing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Advanced Optimization
              </>
            )}
          </Button>
          
          {isOptimizing && (
            <Button
              onClick={onCancelOptimization}
              variant="outline"
              className="px-4"
            >
              <Pause className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
