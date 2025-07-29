import { useState } from 'react';
import apiClient from '../api/ml-client';
import type { ModelParameter } from '../components/model-training-dashboard';

export interface PredictionRequest {
  model_id: string;
  features: Record<string, number>;
}

export interface PredictionResponse {
  prediction: number;
  confidence?: number;
}

export interface PredictionResult {
  predictedValue: number;
  processValue: number; 
  difference: number;
  percentDifference: number;
  confidence: number;
}

export function useModelPrediction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);

  /**
   * Generates feature values for prediction based on active parameters
   * Uses currentValue if available, otherwise calculates average of min/max
   */
  const generateFeatureValues = (parameters: ModelParameter[]): Record<string, number> => {
    const activeFeatures = parameters.filter(p => p.type === 'feature' && p.enabled);
    
    return activeFeatures.reduce((acc, feature) => {
      // Use current value if available, otherwise use average of min/max
      const value = 'currentValue' in feature && feature.currentValue !== undefined
        ? feature.currentValue
        : (feature.currentMin + feature.currentMax) / 2;
      
      acc[feature.id] = value;
      return acc;
    }, {} as Record<string, number>);
  };

  /**
   * Makes a prediction using the trained model
   * @param parameters - Array of model parameters
   * @param modelId - ID of the model to use for prediction (defaults to 'latest')
   */
  /**
   * Generates the model ID based on the mill number and target parameter
   * @param millNumber - The mill number (1-12)
   * @param parameters - Array of model parameters to find the target parameter
   * @returns Formatted model ID string (e.g., 'xgboost_PSI80_mill8')
   */
  const getModelId = (millNumber: number, parameters: ModelParameter[] = []): string => {
    // Find the target parameter (type: 'target')
    const targetParam = parameters.find(p => p.type === 'target' && p.enabled);
    const targetId = targetParam?.id || 'PSI80'; // Default to 'PSI80' if no target found
    return `xgboost_${targetId}_mill${millNumber}`;
  };

  const predictWithModel = async (
    parameters: ModelParameter[],
    millNumber: number = 8 // Default to mill 8 for backward compatibility
  ): Promise<PredictionResult> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Generate feature values for prediction
      const featureValues = generateFeatureValues(parameters);
      
      // Generate model ID based on mill number and target parameter
      const modelId = getModelId(millNumber, parameters);
      
      // Prepare the prediction request
      const predictionRequest = {
        model_id: modelId,
        data: featureValues  // Changed from 'features' to 'data' to match the expected format
      };
      
      console.log('Making prediction request:', predictionRequest);
      
      // Make the API call to the prediction endpoint
      const response = await apiClient.post<PredictionResponse>('/predict', predictionRequest);
      
      console.log('Prediction response:', response.data);
      
      // Get the current target value for comparison
      const targetParam = parameters.find(p => p.type === 'target' && p.enabled);
      const currentValue = targetParam 
        ? ('currentValue' in targetParam && targetParam.currentValue !== undefined
            ? targetParam.currentValue
            : (targetParam.currentMin + targetParam.currentMax) / 2)
        : 0;
      
      // Calculate difference metrics
      const predictedValue = response.data.prediction;
      const difference = predictedValue - currentValue;
      const percentDifference = currentValue !== 0 ? (difference / currentValue) * 100 : 0;
      
      const predictionResult: PredictionResult = {
        predictedValue,
        processValue: currentValue,
        difference,
        percentDifference,
        confidence: response.data.confidence || 0.9 
      };
      
      setResult(predictionResult);
      return predictionResult;
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to get prediction';
      setError(errorMessage);
      console.error('Prediction error:', errorMessage, err);
      
      // Re-throw the error for the caller to handle
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    predictWithModel,
    isLoading,
    result,
    error,
    reset: () => {
      setResult(null);
      setError(null);
    }
  };
}
