import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useOptimizationStore, OptimizationResult } from '../stores/optimization-store'
import { useXgboostStore } from '../stores/xgboost-store'

export interface UseOptimizationResultsReturn {
  currentResults: OptimizationResult | null
  optimizationHistory: OptimizationResult[]
  bestParameters: Record<string, number> | null
  
  // Actions
  applyOptimizedParameters: (parameters?: Record<string, number>) => void
  clearResults: () => void
  clearHistory: () => void
  
  // Computed values
  hasResults: boolean
  isSuccessful: boolean
  improvementScore: number | null
  convergenceData: Array<{ iteration: number; best_score: number }> | null
  featureImportance: Record<string, number> | null
  recommendations: string[] | null
  
  // History analysis
  bestHistoricalResult: OptimizationResult | null
  averageImprovement: number | null
  totalOptimizations: number
}

export function useOptimizationResults(): UseOptimizationResultsReturn {
  const {
    currentResults,
    optimizationHistory,
    bestParameters,
    setProposedSetpoints,
    clearResults,
    clearHistory,
  } = useOptimizationStore()

  const { updateSliderValue, predictWithCurrentValues } = useXgboostStore()

  // Apply optimized parameters to the XGBoost store
  const applyOptimizedParameters = useCallback((parameters?: Record<string, number>) => {
    const paramsToApply = parameters || bestParameters
    
    if (!paramsToApply) {
      toast.error('No optimized parameters to apply')
      return
    }

    try {
      // Apply each parameter to the XGBoost store
      Object.entries(paramsToApply).forEach(([paramId, value]) => {
        updateSliderValue(paramId, value)
      })

      // Set as proposed setpoints for runtime mode
      setProposedSetpoints(paramsToApply)

      // Trigger a prediction with the new values
      setTimeout(() => {
        predictWithCurrentValues()
      }, 100)

      toast.success(`Applied ${Object.keys(paramsToApply).length} optimized parameters`)
      console.log('Applied optimized parameters:', paramsToApply)
      
    } catch (error) {
      console.error('Error applying optimized parameters:', error)
      toast.error('Failed to apply optimized parameters')
    }
  }, [bestParameters, updateSliderValue, predictWithCurrentValues])

  // Computed values
  const hasResults = useMemo(() => currentResults !== null, [currentResults])
  
  const isSuccessful = useMemo(() => 
    currentResults?.status === 'completed' && 
    currentResults.best_parameters && 
    Object.keys(currentResults.best_parameters).length > 0
  , [currentResults])

  const improvementScore = useMemo(() => {
    if (!currentResults?.convergence_data || currentResults.convergence_data.length === 0) {
      return null
    }
    
    const convergence = currentResults.convergence_data
    const initialScore = convergence[0]?.best_score || 0
    const finalScore = convergence[convergence.length - 1]?.best_score || 0
    
    if (initialScore === 0) return null
    
    return ((finalScore - initialScore) / Math.abs(initialScore)) * 100
  }, [currentResults])

  const convergenceData = useMemo(() => 
    currentResults?.convergence_data || null
  , [currentResults])

  const featureImportance = useMemo(() => 
    currentResults?.feature_importance || null
  , [currentResults])

  const recommendations = useMemo(() => 
    currentResults?.recommendations || null
  , [currentResults])

  // History analysis
  const bestHistoricalResult = useMemo(() => {
    if (optimizationHistory.length === 0) return null
    
    return optimizationHistory
      .filter(result => result.status === 'completed')
      .reduce((best, current) => {
        if (!best) return current
        return current.best_score > best.best_score ? current : best
      }, null as OptimizationResult | null)
  }, [optimizationHistory])

  const averageImprovement = useMemo(() => {
    const successfulResults = optimizationHistory.filter(
      result => result.status === 'completed' && result.convergence_data.length > 0
    )
    
    if (successfulResults.length === 0) return null
    
    const improvements = successfulResults.map(result => {
      const convergence = result.convergence_data
      const initialScore = convergence[0]?.best_score || 0
      const finalScore = convergence[convergence.length - 1]?.best_score || 0
      
      if (initialScore === 0) return 0
      return ((finalScore - initialScore) / Math.abs(initialScore)) * 100
    })
    
    return improvements.reduce((sum, improvement) => sum + improvement, 0) / improvements.length
  }, [optimizationHistory])

  const totalOptimizations = useMemo(() => optimizationHistory.length, [optimizationHistory])

  return {
    currentResults,
    optimizationHistory,
    bestParameters,
    
    // Actions
    applyOptimizedParameters,
    clearResults,
    clearHistory,
    
    // Computed values
    hasResults,
    isSuccessful,
    improvementScore,
    convergenceData,
    featureImportance,
    recommendations,
    
    // History analysis
    bestHistoricalResult,
    averageImprovement,
    totalOptimizations,
  }
}
