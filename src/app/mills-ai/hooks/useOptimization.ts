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
    autoApplyProposals,
    setProposedSetpoints,
  } = useOptimizationStore()

  const startOptimization = useCallback(async (config: OptimizationConfig): Promise<OptimizationResult | null> => {
    try {
      setError(null)
      startOptimizationInStore(config)
      
      console.log('Starting optimization with config:', config)
      
      // Call the optimization API
      const response = await mlApiClient.post('/optimize', config)
      
      if (!response.data) {
        throw new Error('No data received from optimization API')
      }

      // Create optimization result object based on actual API response
      const optimizationResult: OptimizationResult = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        config,
        best_parameters: response.data.best_params || {},
        best_score: response.data.best_target || 0,
        optimization_history: response.data.recommendations?.map((rec: any, index: number) => ({
          iteration: index + 1,
          parameters: rec.params,
          score: rec.predicted_value
        })) || [],
        convergence_data: response.data.recommendations?.map((rec: any, index: number) => ({
          iteration: index + 1,
          best_score: rec.predicted_value
        })) || [],
        feature_importance: undefined, // Not provided in current API response
        recommendations: response.data.recommendations?.map((rec: any) => 
          `Predicted value: ${rec.predicted_value.toFixed(3)} with optimized parameters`
        ) || [],
        duration_seconds: 0, // Not provided in current API response
        status: 'completed',
      }

      // Update store with results
      setResults(optimizationResult)
      addToHistory(optimizationResult)
      
      // Optionally auto-populate proposed setpoints from best parameters
      if (autoApplyProposals && optimizationResult.best_parameters && Object.keys(optimizationResult.best_parameters).length > 0) {
        try {
          setProposedSetpoints(optimizationResult.best_parameters)
          toast.success('Proposed setpoints auto-populated from best parameters')
        } catch (e) {
          console.warn('Failed to auto-populate proposed setpoints:', e)
        }
      }

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
  }, [startOptimizationInStore, stopOptimizationInStore, setResults, addToHistory, setOptimizationId, autoApplyProposals, setProposedSetpoints])

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
