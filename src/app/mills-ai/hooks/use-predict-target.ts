import { useState } from 'react'
import { mlApiClient } from '../../../lib/api-client'

interface PredictParams {
  modelName: string
  parameters: Record<string, number>
}

interface PredictionResponse {
  prediction: number
  model_name: string
  input_parameters: Record<string, number>
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
          model_name: params.modelName,
          parameters: params.parameters
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
