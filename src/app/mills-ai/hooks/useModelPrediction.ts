import { useState } from 'react';
import apiClient from '../api/ml-client';
import type { ModelParameter } from '../components/model-training-dashboard';

export interface PredictionRequest {
  model_id: string;
  features: Record<string, number>;
}

export interface PredictionResponse {
  prediction: number;
  confidence: number;
}

export interface PredictionResult {
  predictedValue: number;
  processValue: number; // Dummy PV value for comparison
  difference: number;
  percentDifference: number;
  confidence: number;
}

export function useModelPrediction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);

  // Generate feature values for prediction based on active parameters
  const generateDummyFeatureValues = (parameters: ModelParameter[]) => {
    const activeFeatures = parameters.filter(p => p.type === 'feature' && p.enabled);
    
    return activeFeatures.reduce((acc, feature) => {
      // Use average of currentMin and currentMax as the feature value
      const averageValue = (feature.currentMin + feature.currentMax) / 2;
      acc[feature.id] = averageValue;
      return acc;
    }, {} as Record<string, number>);
  };

  // Generate a dummy process value (PV) for comparison
  const generateDummyProcessValue = (parameters: ModelParameter[]) => {
    const targetParam = parameters.find(p => p.type === 'target' && p.enabled);
    if (!targetParam) return 50; // Default if no target found
    
    // Use a value slightly different from the average to show comparison
    const averageValue = (targetParam.currentMin + targetParam.currentMax) / 2;
    // Add +/- 5-15% random variation
    const variation = averageValue * (0.05 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1);
    
    return averageValue + variation;
  };

  const predictWithModel = async (
    parameters: ModelParameter[],
    modelId: string = "latest" // Use "latest" as default or specific model ID
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Generate feature values for prediction (average of min/max)
      const featureValues = generateDummyFeatureValues(parameters);
      
      // Prepare the prediction request
      const predictionRequest: PredictionRequest = {
        model_id: modelId,
        features: featureValues
      };
      
      // For demonstration/testing, simulate API call with mock data
      // In real implementation, uncomment the API call below
      // const response = await apiClient.post<PredictionResponse>('/predict', predictionRequest);
      
      // Mock response for now
      const mockPrediction = await mockPredictAPI(parameters);
      
      // Generate dummy process value for comparison
      const processValue = generateDummyProcessValue(parameters);
      
      // Calculate difference metrics
      const difference = mockPrediction.prediction - processValue;
      const percentDifference = (difference / processValue) * 100;
      
      const predictionResult: PredictionResult = {
        predictedValue: mockPrediction.prediction,
        processValue,
        difference,
        percentDifference,
        confidence: mockPrediction.confidence
      };
      
      setResult(predictionResult);
      return predictionResult;
      
    } catch (err: any) {
      setError(err.message || 'Failed to get prediction');
      console.error('Prediction error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mock API function for demonstration
  const mockPredictAPI = async (parameters: ModelParameter[]): Promise<PredictionResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Find the target parameter
    const targetParam = parameters.find(p => p.type === 'target' && p.enabled);
    if (!targetParam) {
      throw new Error('No target parameter found for prediction');
    }
    
    // Generate a prediction close to the target parameter's average value
    const avgTargetValue = (targetParam.currentMin + targetParam.currentMax) / 2;
    // Add small random variation to make it realistic
    const prediction = avgTargetValue * (0.95 + Math.random() * 0.1);
    
    return {
      prediction,
      confidence: 0.85 + Math.random() * 0.1 // Random confidence between 85-95%
    };
  };

  return {
    predictWithModel,
    isLoading,
    result,
    error
  };
}
