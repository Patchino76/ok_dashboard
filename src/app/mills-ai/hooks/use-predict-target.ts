import { useState } from 'react'
import { mlApiClient } from '../../../lib/api-client'

interface PredictParams {
  modelName: string
  data: Record<string, number>
}

interface PredictionResponse {
  prediction: number
  model_id: string
  target_col: string
  timestamp: string
}

export const usePredictTarget = () => {
  const [isPredicting, setIsPredicting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const predictTarget = async (params: PredictParams): Promise<PredictionResponse | null> => {
    setIsPredicting(true)
    setError(null)

    try {
      const response = await mlApiClient.post<PredictionResponse>(
        '/api/v1/ml/predict',
        {
          model_id: params.modelName,
          data: params.data
        }
      )
      
      return response.data
    } catch (err) {
      console.error("Error predicting target:", err)
      setError(err instanceof Error ? err : new Error('Unknown error occurred'))
      return null
    } finally {
      setIsPredicting(false)
    }
  }

  return { predictTarget, isPredicting, error }
}
