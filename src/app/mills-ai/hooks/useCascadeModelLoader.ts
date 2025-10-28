"use client"

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface CascadeModelMetadata {
  mill_number: number
  model_info: {
    path: string
    metadata: any
    model_files: string[]
    has_complete_cascade: boolean
    feature_classification?: {
      mv_features: string[]
      cv_features: string[]
      dv_features: string[]
      target_features: string[]
    }
    performance?: any
    training_config?: any
    data_info?: any
    all_features?: string[]
    target_variable?: string
  }
}

export interface CascadeModelState {
  isLoading: boolean
  modelMetadata: CascadeModelMetadata | null
  error: string | null
  availableModels: Record<number, any>
}

export function useCascadeModelLoader() {
  const [state, setState] = useState<CascadeModelState>({
    isLoading: false,
    modelMetadata: null,
    error: null,
    availableModels: {}
  })

  // Load all available cascade models
  const loadAvailableModels = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/ml/cascade/models`)
      if (!response.ok) {
        throw new Error(`Failed to load available models: ${response.statusText}`)
      }
      
      const data = await response.json()
      setState(prev => ({
        ...prev,
        availableModels: data.mill_models || {}
      }))
      
      return data.mill_models || {}
    } catch (error) {
      console.error('Error loading available models:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load available models'
      }))
      return {}
    }
  }, [])

  // Load model metadata for a specific mill
  const loadModelForMill = useCallback(async (millNumber: number, modelType: "xgb" | "gpr" = "xgb") => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      console.log(`🔍 Loading ${modelType.toUpperCase()} cascade model for Mill ${millNumber}...`)
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      // First, get model info and metadata
      const infoResponse = await fetch(`${apiUrl}/api/v1/ml/cascade/models/${millNumber}?model_type=${modelType}`)
      if (!infoResponse.ok) {
        if (infoResponse.status === 404) {
          throw new Error(`No cascade models found for Mill ${millNumber}`)
        }
        throw new Error(`Failed to get model info: ${infoResponse.statusText}`)
      }
      
      const infoData = await infoResponse.json()
      console.log(`✅ Model info loaded for Mill ${millNumber}:`, infoData)
      console.log(`🔍 Model info structure:`, {
        hasModelInfo: !!infoData.model_info,
        modelInfoKeys: Object.keys(infoData.model_info || {}),
        hasAllFeatures: !!infoData.model_info?.all_features,
        allFeatures: infoData.model_info?.all_features,
        hasFeatureClassification: !!infoData.model_info?.feature_classification,
        featureClassification: infoData.model_info?.feature_classification
      })
      
      // Then, load the model into memory
      const loadResponse = await fetch(`${apiUrl}/api/v1/ml/cascade/models/${millNumber}/load?model_type=${modelType}`, {
        method: 'POST'
      })
      
      if (!loadResponse.ok) {
        throw new Error(`Failed to load model: ${loadResponse.statusText}`)
      }
      
      const loadData = await loadResponse.json()
      console.log(`✅ Model loaded successfully for Mill ${millNumber}:`, loadData)
      
      console.log('🔄 Setting cascade model metadata in state:', infoData);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        modelMetadata: infoData,
        error: null
      }))
      
      console.log('✅ Cascade model metadata set in state');
      
      // Show success toast with model details
      const featureCount = infoData.model_info.all_features?.length || 0
      const targetVar = infoData.model_info.target_variable || 'Unknown'
      toast.success(
        `Cascade model loaded for Mill ${millNumber}`,
        {
          description: `${featureCount} features, Target: ${targetVar}`
        }
      )
      
      return infoData
      
    } catch (error) {
      console.error(`❌ Error loading model for Mill ${millNumber}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load model'
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      
      toast.error(`Failed to load Mill ${millNumber} model`, {
        description: errorMessage
      })
      
      throw error
    }
  }, [])

  // Get feature classification from loaded model
  const getFeatureClassification = useCallback(() => {
    if (!state.modelMetadata?.model_info.feature_classification) {
      return {
        mv_features: [],
        cv_features: [],
        dv_features: [],
        target_features: []
      }
    }
    
    return state.modelMetadata.model_info.feature_classification
  }, [state.modelMetadata])

  // Get all features from loaded model
  const getAllFeatures = useCallback(() => {
    return state.modelMetadata?.model_info.all_features || []
  }, [state.modelMetadata])

  // Get target variable from loaded model
  const getTargetVariable = useCallback(() => {
    return state.modelMetadata?.model_info.target_variable || 'PSI200'
  }, [state.modelMetadata])

  // Check if model has complete cascade
  const hasCompleteCascade = useCallback(() => {
    return state.modelMetadata?.model_info.has_complete_cascade || false
  }, [state.modelMetadata])

  // Get model performance metrics
  const getModelPerformance = useCallback(() => {
    return state.modelMetadata?.model_info.performance || null
  }, [state.modelMetadata])

  // Clear current model
  const clearModel = useCallback(() => {
    setState(prev => ({
      ...prev,
      modelMetadata: null,
      error: null
    }))
  }, [])

  // Load available models on mount
  useEffect(() => {
    loadAvailableModels()
  }, [loadAvailableModels])

  return {
    // State
    isLoading: state.isLoading,
    modelMetadata: state.modelMetadata,
    error: state.error,
    availableModels: state.availableModels,
    
    // Actions
    loadModelForMill,
    loadAvailableModels,
    clearModel,
    
    // Getters
    getFeatureClassification,
    getAllFeatures,
    getTargetVariable,
    hasCompleteCascade,
    getModelPerformance
  }
}
