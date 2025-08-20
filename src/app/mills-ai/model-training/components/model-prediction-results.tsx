import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PredictionResult } from '../../hooks/useModelPrediction';

interface ModelPredictionResultsProps {
  result: PredictionResult | null;
  targetName: string;
  targetUnit: string;
}

export function ModelPredictionResults({ result, targetName, targetUnit }: ModelPredictionResultsProps) {
  if (!result) {
    return null;
  }

  // Format numbers for display
  const formatNumber = (value: number) => {
    return value.toFixed(2);
  };

  // Determine the color of the difference badge based on the percentage
  const getDifferenceColor = (percentDifference: number) => {
    const absPercentDiff = Math.abs(percentDifference);
    if (absPercentDiff < 5) return 'bg-green-500';
    if (absPercentDiff < 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Calculate maximum value for scaling the bars
  const maxValue = Math.max(result.predictedValue, result.processValue) * 1.1; // Add 10% margin

  // Convert values to percentages for the progress bars
  const predictedPercent = (result.predictedValue / maxValue) * 100;
  const processPercent = (result.processValue / maxValue) * 100;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Прогноза на модела: {targetName}</span>
          <Badge variant="outline" className="ml-2">
            {formatNumber(result.confidence * 100)}% увереност
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bar Graph Visualization */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Прогнозна стойност:</span>
            <span className="font-bold">{formatNumber(result.predictedValue)} {targetUnit}</span>
          </div>
          <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500" 
              style={{ width: `${predictedPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="font-medium">Текуща стойност (PV):</span>
            <span className="font-bold">{formatNumber(result.processValue)} {targetUnit}</span>
          </div>
          <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500" 
              style={{ width: `${processPercent}%` }}
            />
          </div>
        </div>

        {/* Difference Metrics */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-semibold mb-2">Разлика в стойностите</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Абсолютна разлика</div>
              <div className="font-bold text-lg">
                {result.difference > 0 ? '+' : ''}{formatNumber(result.difference)} {targetUnit}
              </div>
            </div>
            
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Процентна разлика</div>
              <div className="flex items-center">
                <Badge className={`${getDifferenceColor(result.percentDifference)} text-white font-bold mr-2`}>
                  {result.percentDifference > 0 ? '+' : ''}{formatNumber(result.percentDifference)}%
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
