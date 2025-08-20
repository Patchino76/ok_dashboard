import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { mlApiClient } from '../utils/api-client'
import { useOptimizationStore, OptimizationConfig, OptimizationResult } from '../stores/optimization-store'

export interface UseOptimizationReturn {
  startOptimization: (config: OptimizationConfig) => Promise<OptimizationResult | null>
  stopOptimization: () => Promise<void>
  isOptimizing: boolean
  progress: number
  error: string | null
  currentResults: OptimizationResult | null
}

export function useOptimization(): UseOptimizationReturn {
  const [error, setError] = useState<string | null>(null)
  
  const {
    isOptimizing,
    optimizationProgress,
    currentResults,
    startOptimization: startOptimizationInStore,
    stopOptimization: stopOptimizationInStore,
    updateProgress,
    setResults,
    addToHistory,
    setOptimizationId,
  } = useOptimizationStore()

  const startOptimization = useCallback(async (config: OptimizationConfig): Promise<OptimizationResult | null> => {
    try {
      setError(null)
      startOptimizationInStore(config)
      
      console.log('Starting optimization with config:', config)
      
      // Call the optimization API
      const response = await mlApiClient.post('/api/v1/ml/optimize', config)
      
      if (!response.data) {
        throw new Error('No data received from optimization API')
      }

      // Create optimization result object
      const optimizationResult: OptimizationResult = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        config,
        best_parameters: response.data.best_parameters || {},
        best_score: response.data.best_score || 0,
        optimization_history: response.data.optimization_history || [],
        convergence_data: response.data.convergence_data || [],
        feature_importance: response.data.feature_importance,
        recommendations: response.data.recommendations,
        duration_seconds: response.data.duration_seconds || 0,
        status: 'completed',
      }

      // Update store with results
      setResults(optimizationResult)
      addToHistory(optimizationResult)
      
      console.log('Optimization completed successfully:', optimizationResult)
      return optimizationResult

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown optimization error'
      console.error('Optimization failed:', err)
      
      setError(errorMessage)
      
      // Create failed result
      const failedResult: OptimizationResult = {
        id: `opt_failed_${Date.now()}`,
        timestamp: Date.now(),
        config,
        best_parameters: {},
        best_score: 0,
        optimization_history: [],
        convergence_data: [],
        duration_seconds: 0,
        status: 'failed',
        error_message: errorMessage,
      }
      
      setResults(failedResult)
      addToHistory(failedResult)
      stopOptimizationInStore()
      
      return null
    }
  }, [startOptimizationInStore, stopOptimizationInStore, setResults, addToHistory, setOptimizationId])

  const stopOptimization = useCallback(async (): Promise<void> => {
    try {
      // If there's an active optimization, try to cancel it
      // Note: This would require the API to support cancellation
      // For now, we just update the local state
      
      stopOptimizationInStore()
      setError(null)
      
      console.log('Optimization stopped by user')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop optimization'
      console.error('Error stopping optimization:', err)
      setError(errorMessage)
    }
  }, [stopOptimizationInStore])

  return {
    startOptimization,
    stopOptimization,
    isOptimizing,
    progress: optimizationProgress,
    error,
    currentResults,
  }
}
