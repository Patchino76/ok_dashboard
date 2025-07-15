import { useState, useCallback, useEffect } from 'react'
import { mlApiClient } from '../utils/api-client'

export interface ModelMetadata {
  name: string
  features: string[]
  target_col: string
  last_trained: string
  files_complete: boolean
}

export interface ModelsResponse {
  [key: string]: ModelMetadata
}

export function useGetModels() {
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Use the models endpoint without duplicating the prefix
      const response = await mlApiClient.get<ModelsResponse>('/models')
      
      // If the response is empty or doesn't contain our expected model, add a fallback
      const data = response.data || {}
      
      if (Object.keys(data).length === 0) {
        console.warn('Backend returned empty models list, using fallback default model')
        
        // Add fallback default models for both mill6 and mill8
        const fallbackModels: ModelsResponse = {
          "xgboost_PSI80_mill8": {
            name: "xgboost_PSI80_mill8",
            features: ["Ore", "WaterMill", "WaterZumpf", "PressureHC", "DensityHC", "MotorAmp", "Shisti", "Daiki"],
            target_col: "PSI80",
            last_trained: new Date().toISOString(),
            files_complete: true
          },
          "xgboost_PSI80_mill6": {
            name: "xgboost_PSI80_mill6",
            features: ["Ore", "WaterMill", "WaterZumpf", "PressureHC", "DensityHC", "MotorAmp", "Shisti", "Daiki"],
            target_col: "PSI80",
            last_trained: new Date().toISOString(),
            files_complete: true
          }
        }
        
        setModels(fallbackModels)
      } else {
        setModels(data)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch models')
      console.error('Error fetching models:', err)
      
      // Provide fallback models on error
      const fallbackModels: ModelsResponse = {
        "xgboost_PSI80_mill8": {
          name: "xgboost_PSI80_mill8",
          features: ["Ore", "WaterMill", "WaterZumpf", "PressureHC", "DensityHC", "MotorAmp", "Shisti", "Daiki"],
          target_col: "PSI80",
          last_trained: new Date().toISOString(),
          files_complete: true
        },
        "xgboost_PSI80_mill6": {
          name: "xgboost_PSI80_mill6",
          features: ["Ore", "WaterMill", "WaterZumpf", "PressureHC", "DensityHC", "MotorAmp", "Shisti", "Daiki"],
          target_col: "PSI80",
          last_trained: new Date().toISOString(),
          files_complete: true
        }
      }
      
      setModels(fallbackModels)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels
  }
}
