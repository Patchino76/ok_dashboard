"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { ScrollArea } from "@/components/ui/scroll-area" // Component not available
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Pause, 
  Play,
  TrendingUp,
  Target,
  BarChart3,
  Activity,
  Zap,
  AlertTriangle,
  Info
} from "lucide-react"
import { OptimizationJob, OptimizationResults, ParameterRecommendation } from "../../hooks/useAdvancedCascadeOptimization"

interface OptimizationJobTrackerProps {
  currentJob: OptimizationJob | null
  currentResults: OptimizationResults | null
  jobHistory: OptimizationJob[]
  onApplyRecommendations: (recommendations: ParameterRecommendation[]) => void
  onCancelJob: () => void
  isOptimizing: boolean
}

export function OptimizationJobTracker({
  currentJob,
  currentResults,
  jobHistory,
  onApplyRecommendations,
  onCancelJob,
  isOptimizing
}: OptimizationJobTrackerProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [autoApply, setAutoApply] = useState(false)

  // Auto-select current job
  useEffect(() => {
    if (currentJob && !selectedJobId) {
      setSelectedJobId(currentJob.job_id)
    }
  }, [currentJob, selectedJobId])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-blue-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'cancelled':
        return <Pause className="h-4 w-4 text-orange-600" />
      default:
        return <Clock className="h-4 w-4 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
  }

  const selectedJob = jobHistory.find(job => job.job_id === selectedJobId) || currentJob
  const selectedResults = selectedJobId === currentJob?.job_id ? currentResults : null

  return (
    <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          Optimization Job Tracker
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="current">Current Job</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          {/* Current Job Status */}
          <TabsContent value="current" className="space-y-4">
            {currentJob ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(currentJob.status)}
                    <div>
                      <h3 className="font-medium">Job {currentJob.job_id}</h3>
                      <p className="text-sm text-slate-500">{currentJob.optimization_mode}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-full px-3 py-1 ${getStatusColor(currentJob.status)}`}>
                    {currentJob.status.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Started:</span>
                    <div className="font-medium">
                      {currentJob.start_time ? new Date(currentJob.start_time).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Duration:</span>
                    <div className="font-medium">
                      {currentJob.duration_seconds ? formatDuration(currentJob.duration_seconds) : 'Running...'}
                    </div>
                  </div>
                </div>
                
                {currentJob.status === 'running' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span className="flex items-center gap-1">
                        <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
                        Optimizing...
                      </span>
                    </div>
                    <Progress value={undefined} className="w-full" />
                    
                    <div className="flex justify-center">
                      <Button
                        onClick={onCancelJob}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Cancel Job
                      </Button>
                    </div>
                  </div>
                )}
                
                {currentJob.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Error</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-300">{currentJob.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active optimization job</p>
                <p className="text-sm">Start an optimization to see progress here</p>
              </div>
            )}
          </TabsContent>
          
          {/* Optimization Results */}
          <TabsContent value="results" className="space-y-4">
            {currentResults && currentResults.status === 'completed' ? (
              <div className="space-y-4">
                {/* Results Summary */}
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Optimization Results
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Best Value:</span>
                      <div className="font-medium text-lg">{currentResults.best_value?.toFixed(3)}</div>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Trials Completed:</span>
                      <div className="font-medium text-lg">{currentResults.n_trials}</div>
                    </div>
                  </div>
                  
                  {currentResults.optimization_summary && (
                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Feasibility Rate:</span>
                        <div className="font-medium">
                          {(currentResults.optimization_summary.feasibility_rate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Total Evaluations:</span>
                        <div className="font-medium">{currentResults.optimization_summary.total_evaluations}</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Parameter Recommendations - Use separate recommendations call */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Parameter Recommendations
                    </h4>
                    <Button
                      onClick={() => {
                        // Mock recommendations for now - would come from separate API call
                        const mockRecommendations = [
                          {
                            parameter_id: 'Ore',
                            recommended_value: 85.0,
                            current_value: 80.0,
                            improvement_potential: 0.05,
                            confidence: 0.85,
                            bounds: [70, 90] as [number, number]
                          }
                        ];
                        onApplyRecommendations(mockRecommendations);
                      }}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Get Recommendations
                    </Button>
                  </div>
                  
                  <div className="text-sm text-slate-500 text-center py-4">
                    Click "Get Recommendations" to fetch parameter suggestions
                  </div>
                </div>
                
                {/* Performance Metrics */}
                {currentResults.optimization_summary && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Performance Metrics
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Best Objective:</span>
                        <div className="font-medium">
                          {currentResults.optimization_summary.best_objective.toFixed(3)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Mean Objective:</span>
                        <div className="font-medium">{currentResults.optimization_summary.mean_objective.toFixed(3)}</div>
                      </div>
                    </div>
                    
                    {currentResults.parameter_importance && (
                      <div className="mt-3">
                        <span className="text-slate-600 dark:text-slate-400 text-sm">Most Important Parameters:</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(currentResults.parameter_importance)
                            .sort(([,a], [,b]) => (b as number) - (a as number))
                            .slice(0, 3)
                            .map(([param, importance]) => (
                              <div key={param} className="flex justify-between text-sm">
                                <span>{param}</span>
                                <span className="font-medium">{((importance as number) * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No results available</p>
                <p className="text-sm">Complete an optimization to see results here</p>
              </div>
            )}
          </TabsContent>
          
          {/* Job History */}
          <TabsContent value="history" className="space-y-4">
            {jobHistory.length > 0 ? (
              <div className="h-64 overflow-y-auto">
                <div className="space-y-2">
                  {jobHistory.slice().reverse().map((job) => (
                    <div
                      key={job.job_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedJobId === job.job_id
                          ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                      onClick={() => setSelectedJobId(job.job_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <div>
                            <div className="font-medium text-sm">Job {job.job_id}</div>
                            <div className="text-xs text-slate-500">{job.optimization_mode}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`text-xs ${getStatusColor(job.status)}`}>
                            {job.status}
                          </Badge>
                          <div className="text-xs text-slate-500 mt-1">
                            {job.start_time ? new Date(job.start_time).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      {job.duration_seconds && (
                        <div className="text-xs text-slate-500 mt-2">
                          Duration: {formatDuration(job.duration_seconds)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No job history</p>
                <p className="text-sm">Previous optimization jobs will appear here</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
