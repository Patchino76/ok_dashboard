import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { mlApiClient } from '../utils/api-client'

// Enhanced optimization interfaces for the new endpoints
export interface AdvancedOptimizationRequest {
  dv_values: Record<string, number>
  optimization_mode: 'single_objective' | 'multi_objective' | 'robust' | 'pareto'
  n_trials: number
  timeout?: number
  
  // Objective weights
  target_weight: number
  constraint_weight: number
  efficiency_weight: number
  
  // Constraint handling
  soft_constraints: boolean
  constraint_tolerance: number
  penalty_factor: number
  
  // Advanced features
  robust_optimization: boolean
  uncertainty_samples: number
  confidence_level: number
  adaptive_bounds: boolean
  
  // Target bounds
  target_min?: number
  target_max?: number
}

export interface OptimizationJob {
  job_id: string
  status: 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
  optimization_mode: string
  n_trials: number
  start_time?: string
  end_time?: string
  duration_seconds?: number
  message?: string
  error?: string
}

export interface OptimizationResults {
  job_id: string
  status: string
  optimization_mode: string
  n_trials: number
  
  // Single objective results
  best_value?: number
  best_parameters?: Record<string, number>
  best_prediction?: {
    predicted_target: number
    predicted_cvs: Record<string, number>
    is_feasible: boolean
  }
  
  // Multi-objective results
  pareto_solutions?: Array<{
    trial_number: number
    parameters: Record<string, number>
    objectives: number[]
    predicted_results: any
  }>
  
  // Analysis
  convergence_analysis?: {
    converged: boolean
    improvement_rate: number
    recent_mean: number
    earlier_mean: number
    best_value: number
  }
  parameter_importance?: Record<string, number>
  optimization_summary?: {
    total_evaluations: number
    feasible_evaluations: number
    feasibility_rate: number
    best_objective: number
    mean_objective: number
    objective_std: number
  }
  evaluation_history?: Array<{
    trial_number: number
    mv_values: Record<string, number>
    predicted_target: number
    predicted_cvs: Record<string, number>
    is_feasible: boolean
    objectives: Record<string, number>
    objective: number
  }>
}

export interface ParameterRecommendation {
  parameter_id: string
  recommended_value: number
  current_value?: number
  improvement_potential: number
  confidence: number
  bounds: [number, number]
}

export interface UseAdvancedCascadeOptimizationReturn {
  // Optimization management
  startOptimization: (request: AdvancedOptimizationRequest) => Promise<OptimizationJob | null>
  getOptimizationStatus: (jobId: string) => Promise<OptimizationJob | null>
  getOptimizationResults: (jobId: string) => Promise<OptimizationResults | null>
  cancelOptimization: (jobId: string) => Promise<boolean>
  
  // Recommendations
  getRecommendations: (currentValues: Record<string, number>, dvValues: Record<string, number>) => Promise<ParameterRecommendation[]>
  
  // Job management
  listOptimizationJobs: () => Promise<OptimizationJob[]>
  
  // System info
  getOptimizationInfo: () => Promise<any>
  
  // State
  isOptimizing: boolean
  currentJob: OptimizationJob | null
  currentResults: OptimizationResults | null
  error: string | null
}

export function useAdvancedCascadeOptimization(): UseAdvancedCascadeOptimizationReturn {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [currentJob, setCurrentJob] = useState<OptimizationJob | null>(null)
  const [currentResults, setCurrentResults] = useState<OptimizationResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startOptimization = useCallback(async (request: AdvancedOptimizationRequest): Promise<OptimizationJob | null> => {
    try {
      setError(null)
      setIsOptimizing(true)
      
      console.log('Starting advanced cascade optimization:', request)
      
      const response = await mlApiClient.post('/cascade/optimize', request)
      
      if (!response.data) {
        throw new Error('No response from optimization API')
      }

      const job: OptimizationJob = response.data
      setCurrentJob(job)
      
      // Start polling for status updates
      pollOptimizationStatus(job.job_id)
      
      return job

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown optimization error'
      console.error('Failed to start optimization:', err)
      setError(errorMessage)
      setIsOptimizing(false)
      return null
    }
  }, [])

  const getOptimizationStatus = useCallback(async (jobId: string): Promise<OptimizationJob | null> => {
    try {
      const response = await mlApiClient.get(`/cascade/optimization/status/${jobId}`)
      return response.data
    } catch (err) {
      console.error('Failed to get optimization status:', err)
      return null
    }
  }, [])

  const getOptimizationResults = useCallback(async (jobId: string): Promise<OptimizationResults | null> => {
    try {
      const response = await mlApiClient.get(`/cascade/optimization/results/${jobId}`)
      const results: OptimizationResults = response.data
      setCurrentResults(results)
      return results
    } catch (err) {
      console.error('Failed to get optimization results:', err)
      return null
    }
  }, [])

  const cancelOptimization = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      await mlApiClient.delete(`/cascade/optimization/${jobId}`)
      setIsOptimizing(false)
      if (currentJob?.job_id === jobId) {
        setCurrentJob({ ...currentJob, status: 'cancelled' })
      }
      return true
    } catch (err) {
      console.error('Failed to cancel optimization:', err)
      return false
    }
  }, [currentJob])

  const getRecommendations = useCallback(async (
    currentValues: Record<string, number>, 
    dvValues: Record<string, number>
  ): Promise<ParameterRecommendation[]> => {
    try {
      const params = new URLSearchParams()
      Object.entries(currentValues).forEach(([key, value]) => {
        params.append(`current_mv_values[${key}]`, value.toString())
      })
      Object.entries(dvValues).forEach(([key, value]) => {
        params.append(`dv_values[${key}]`, value.toString())
      })

      const response = await mlApiClient.get(`/cascade/recommendations?${params}`)
      return response.data
    } catch (err) {
      console.error('Failed to get recommendations:', err)
      return []
    }
  }, [])

  const listOptimizationJobs = useCallback(async (): Promise<OptimizationJob[]> => {
    try {
      const response = await mlApiClient.get('/cascade/optimization/jobs')
      return response.data.jobs || []
    } catch (err) {
      console.error('Failed to list optimization jobs:', err)
      return []
    }
  }, [])

  const getOptimizationInfo = useCallback(async () => {
    try {
      const response = await mlApiClient.get('/cascade/optimization/info')
      return response.data
    } catch (err) {
      console.error('Failed to get optimization info:', err)
      throw err
    }
  }, [])

  // Poll optimization status until completion
  const pollOptimizationStatus = useCallback(async (jobId: string) => {
    const pollInterval = 2000 // 2 seconds
    const maxPolls = 300 // 10 minutes max
    let pollCount = 0

    const poll = async () => {
      try {
        const status = await getOptimizationStatus(jobId)
        if (!status) return

        setCurrentJob(status)

        if (status.status === 'completed') {
          setIsOptimizing(false)
          // Get results
          const results = await getOptimizationResults(jobId)
          if (results) {
            toast.success(`Optimization completed! Best value: ${results.best_value?.toFixed(3) || 'N/A'}`)
          }
        } else if (status.status === 'failed') {
          setIsOptimizing(false)
          setError(status.error || 'Optimization failed')
          toast.error(`Optimization failed: ${status.error || 'Unknown error'}`)
        } else if (status.status === 'cancelled') {
          setIsOptimizing(false)
          toast.info('Optimization cancelled')
        } else if (status.status === 'running' && pollCount < maxPolls) {
          pollCount++
          setTimeout(poll, pollInterval)
        } else if (pollCount >= maxPolls) {
          setIsOptimizing(false)
          setError('Optimization timeout - taking too long')
          toast.error('Optimization timeout')
        }
      } catch (err) {
        console.error('Error polling optimization status:', err)
        setIsOptimizing(false)
        setError('Failed to monitor optimization progress')
      }
    }

    // Start polling
    setTimeout(poll, pollInterval)
  }, [getOptimizationStatus, getOptimizationResults])

  return {
    startOptimization,
    getOptimizationStatus,
    getOptimizationResults,
    cancelOptimization,
    getRecommendations,
    listOptimizationJobs,
    getOptimizationInfo,
    isOptimizing,
    currentJob,
    currentResults,
    error,
  }
}
