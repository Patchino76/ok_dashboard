import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { mlApiClient } from '../utils/api-client'

// Cascade-specific interfaces
export interface CascadeOptimizationConfig {
  mv_values: Record<string, number>  // Manipulated variables
  dv_values: Record<string, number>  // Disturbance variables
}

export interface CascadeOptimizationResult {
  id: string
  timestamp: number
  config: CascadeOptimizationConfig
  predicted_target: number
  predicted_cvs: Record<string, number>  // Controlled variables
  is_feasible: boolean
  status: 'completed' | 'failed'
  error_message?: string
}

export interface UseCascadeOptimizationReturn {
  startCascadeOptimization: (config: CascadeOptimizationConfig) => Promise<CascadeOptimizationResult | null>
  getCascadeInfo: () => Promise<any>
  trainCascadeModels: (request: CascadeTrainingRequest) => Promise<any>
  getTrainingStatus: () => Promise<any>
  isOptimizing: boolean
  error: string | null
  currentResults: CascadeOptimizationResult | null
}

export interface CascadeTrainingRequest {
  mill_number: number
  start_date: string
  end_date: string
  test_size?: number
  resample_freq?: string
}

export function useCascadeOptimization(): UseCascadeOptimizationReturn {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentResults, setCurrentResults] = useState<CascadeOptimizationResult | null>(null)

  const startCascadeOptimization = useCallback(async (config: CascadeOptimizationConfig): Promise<CascadeOptimizationResult | null> => {
    try {
      setError(null)
      setIsOptimizing(true)
      
      console.log('Starting cascade optimization with config:', config)
      
      // Call the cascade prediction API
      const response = await mlApiClient.post('/api/v1/cascade/predict', config)
      
      if (!response.data) {
        throw new Error('No data received from cascade optimization API')
      }

      // Create cascade optimization result object
      const cascadeResult: CascadeOptimizationResult = {
        id: `cascade_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        config,
        predicted_target: response.data.predicted_target || 0,
        predicted_cvs: response.data.predicted_cvs || {},
        is_feasible: response.data.is_feasible || false,
        status: 'completed',
      }

      setCurrentResults(cascadeResult)
      console.log('Cascade optimization completed successfully:', cascadeResult)
      return cascadeResult

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown cascade optimization error'
      console.error('Cascade optimization failed:', err)
      
      setError(errorMessage)
      
      // Create failed result
      const failedResult: CascadeOptimizationResult = {
        id: `cascade_opt_failed_${Date.now()}`,
        timestamp: Date.now(),
        config,
        predicted_target: 0,
        predicted_cvs: {},
        is_feasible: false,
        status: 'failed',
        error_message: errorMessage,
      }
      
      setCurrentResults(failedResult)
      return null
    } finally {
      setIsOptimizing(false)
    }
  }, [])

  const getCascadeInfo = useCallback(async () => {
    try {
      const response = await mlApiClient.get('/api/v1/cascade/info')
      return response.data
    } catch (err) {
      console.error('Failed to get cascade info:', err)
      throw err
    }
  }, [])

  const trainCascadeModels = useCallback(async (request: CascadeTrainingRequest) => {
    try {
      const response = await mlApiClient.post('/api/v1/cascade/train', request)
      return response.data
    } catch (err) {
      console.error('Failed to start cascade training:', err)
      throw err
    }
  }, [])

  const getTrainingStatus = useCallback(async () => {
    try {
      const response = await mlApiClient.get('/api/v1/cascade/training/status')
      return response.data
    } catch (err) {
      console.error('Failed to get training status:', err)
      throw err
    }
  }, [])

  return {
    startCascadeOptimization,
    getCascadeInfo,
    trainCascadeModels,
    getTrainingStatus,
    isOptimizing,
    error,
    currentResults,
  }
}
