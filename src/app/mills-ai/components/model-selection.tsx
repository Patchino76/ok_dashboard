"use client"

import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { useGetModels } from "@/app/mills-ai/hooks/use-get-models"

interface ModelSelectionProps {
  currentMill: number | undefined
  modelName: string
  availableModels: string[]
  modelFeatures: string[] | null
  modelTarget: string | null
  lastTrained: string | null
  onModelChange: (modelName: string) => void
  onMillChange: (millNumber: number) => void
}

export function ModelSelection({
  currentMill,
  modelName,
  availableModels,
  modelFeatures,
  modelTarget,
  lastTrained,
  onModelChange,
  onMillChange
}: ModelSelectionProps) {
  // Use the useGetModels hook to fetch models
  const { models, isLoading: isLoadingModels, error: modelsError } = useGetModels();
  
  // Get the selected model from the models object
  const selectedModel = modelName && models ? models[modelName] : null;
  
  // Filter models for the current mill
  const filteredModels = models ? 
    Object.keys(models).filter(model => model.endsWith(`_mill${currentMill}`)) : 
    [];
  
  // Update available models when models are loaded
  useEffect(() => {
    if (models && Object.keys(models).length > 0) {
      console.log('Models loaded in ModelSelection component:', Object.keys(models));
    }
  }, [models]);
  
  // Use filtered models from the models object rather than passed availableModels
  const displayModels = filteredModels.length > 0 ? filteredModels : availableModels;

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="w-full sm:w-1/2">
            <label htmlFor="mill-select" className="block text-sm font-medium text-gray-700 mb-1">
              Mill Selection
            </label>
            <Select
              value={currentMill?.toString() || '8'}
              onValueChange={(value) => onMillChange(parseInt(value || '8'))}
            >
              <SelectTrigger id="mill-select" className="w-full">
                <SelectValue placeholder="Select Mill" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mill) => (
                  <SelectItem key={mill} value={mill.toString()}>
                    Mill {mill.toString().padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full sm:w-1/2">
            <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Model
            </label>
            <div className="relative">
              <Select
                value={modelName}
                onValueChange={onModelChange}
                disabled={isLoadingModels || !models || Object.keys(models).length === 0}
              >
                <SelectTrigger id="model-select" className="w-full">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {displayModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {isLoadingModels && (
                <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
              
              {modelsError && (
                <div className="mt-1 flex items-center text-red-500 text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Error loading models</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div className="text-sm">
            <span className="text-gray-500">Target:</span> <span className="font-medium text-blue-600">{modelTarget || 'PSI80'}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Features:</span> <span className="font-medium text-green-600">{modelFeatures?.length || 9}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Last trained:</span> <span className="font-medium">{lastTrained ? new Date(lastTrained).toLocaleString() : '8/11/2025, 9:45:32 AM'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
