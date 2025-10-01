import { useState, useCallback } from 'react'
import axios from 'axios'

// Create a dedicated client for Cascade API endpoints
const cascadeApiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/ml/cascade`,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add response interceptor for error handling
cascadeApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Cascade API request failed:', error)
    console.error('Request URL:', error.config?.url)
    console.error('Base URL:', error.config?.baseURL)
    return Promise.reject(error)
  }
)

// Cascade training interfaces
export interface CascadeTrainingRequest {
  mill_number: number
  start_date: string
  end_date: string
  test_size?: number
  resample_freq?: string
  model_name_suffix?: string
  mv_features?: string[]
  cv_features?: string[]
  dv_features?: string[]
  target_variable?: string
  mv_bounds?: Record<string, [number, number]>
  target_bounds?: Record<string, [number, number]>
}

export interface CascadeTrainingResponse {
  status: string
  message: string
  data_shape?: [number, number]
  mill_number: number
  date_range: string
}

export interface CascadeTrainingStatus {
  status: 'not_started' | 'training_started' | 'in_progress' | 'completed' | 'failed'
  message?: string
}

export interface UseCascadeTrainingReturn {
  trainCascadeModel: (request: CascadeTrainingRequest) => Promise<CascadeTrainingResponse>
  getTrainingStatus: () => Promise<CascadeTrainingStatus>
  isTraining: boolean
  progress: number
  error: string | null
  lastTrainingResult: CascadeTrainingResponse | null
}

export function useCascadeTraining(): UseCascadeTrainingReturn {
  const [isTraining, setIsTraining] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastTrainingResult, setLastTrainingResult] = useState<CascadeTrainingResponse | null>(null)

  const trainCascadeModel = useCallback(async (request: CascadeTrainingRequest): Promise<CascadeTrainingResponse> => {
    let progressInterval: NodeJS.Timeout | undefined

    try {
      setIsTraining(true)
      setProgress(0)
      setError(null)
      setLastTrainingResult(null)

      // Validate request
      if (!request.mill_number || !request.start_date || !request.end_date) {
        throw new Error('Mill number, start date, and end date are required')
      }

      // Set up progress simulation (since cascade training runs in background)
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev // Cap at 90% until we get actual completion
          return prev + Math.random() * 10
        })
      }, 500)

      // Call cascade training endpoint
      const response = await cascadeApiClient.post<CascadeTrainingResponse>('/train', request)

      // Clear the progress interval and set to 100%
      if (progressInterval) clearInterval(progressInterval)
      setProgress(100)

      // Set the training result
      setLastTrainingResult(response.data)
      return response.data

    } catch (err: any) {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      
      const errorMessage = err.response?.data?.detail || err.message || 'Cascade training failed'
      setError(errorMessage)
      console.error('Cascade training error:', err)
      throw new Error(errorMessage)
    } finally {
      setIsTraining(false)
    }
  }, [])

  const getTrainingStatus = useCallback(async (): Promise<CascadeTrainingStatus> => {
    try {
      const response = await cascadeApiClient.get<CascadeTrainingStatus>('/training/status')
      return response.data
    } catch (error) {
      console.error('Error getting training status:', error)
      return { status: 'failed', message: 'Failed to get training status' }
    }
  }, [])

  return {
    trainCascadeModel,
    getTrainingStatus,
    isTraining,
    progress,
    error,
    lastTrainingResult,
  }
}
