"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Activity, Zap, Settings, Play } from "lucide-react"
import { ParameterOptimizationCard } from "./parameter-optimization-card"
import { TargetFractionDisplay } from "../../components/target-fraction-display"
import { ModelSelection } from "../../components/model-selection"
import { useXgboostStore } from "@/app/mills-ai/stores/xgboost-store"
import { toast } from "sonner"
import { useGetModels } from "@/app/mills-ai/hooks/use-get-models"
import { millsParameters, getTargets } from "../../data/mills-parameters"

export default function XgboostOptimizationDashboard() {
  // Get the store instance
  const store = useXgboostStore();
  
  // Set default mill to 8
  useEffect(() => {
    if (store.currentMill !== 8) {
      store.setCurrentMill(8);
    }
  }, []);
  
  // One-time guard to apply optimization-specific default model
  const appliedOptimizationDefaultModel = useRef(false);
  
  // Destructure store values with proper types
  const {
    parameters,
    parameterBounds,
    currentTarget,
    currentPV,
    targetData,
    modelName,
    availableModels,
    modelFeatures,
    modelTarget,
    lastTrained,
    currentMill,
    sliderValues,
    updateSliderValue,
    setPredictedTarget,
    addTargetDataPoint,
    setModelName,
    setAvailableModels,
    setModelMetadata,
    stopRealTimeUpdates,
    setCurrentMill,
    startRealTimeUpdates,
    resetFeatures,
    resetSliders,
    predictWithCurrentValues
  } = store;

  // Local optimization ranges per parameter id
  const [ranges, setRanges] = useState<Record<string, [number, number]>>({});
  
  // Target SP slider state
  const [targetSP, setTargetSP] = useState<number>(50.0);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Get target parameter bounds (PSI80)
  const targetParameter = useMemo(() => {
    const targets = getTargets();
    return targets.find(t => t.id === 'PSI80') || targets[0];
  }, []);

  // Initialize ranges from parameterBounds when parameters or bounds change
  useEffect(() => {
    const initial: Record<string, [number, number]> = {};
    parameters.forEach(p => {
      const b = parameterBounds[p.id] || [0, 100];
      // If existing range present keep it, else initialize to 10% inside the bounds
      if (ranges[p.id]) {
        initial[p.id] = ranges[p.id] as [number, number];
      } else {
        const span = b[1] - b[0];
        const lo = b[0] + 0.1 * span;
        const hi = b[1] - 0.1 * span;
        initial[p.id] = [lo, hi];
      }
    });
    setRanges(initial);
  }, [parameters, parameterBounds]);
  
  // Initialize target SP to middle of target parameter range
  useEffect(() => {
    if (targetParameter) {
      setTargetSP((targetParameter.min + targetParameter.max) / 2);
    }
  }, [targetParameter]);

  const [isPredicting, setIsPredicting] = useState(false);
  const { models } = useGetModels();
  
  const selectedModel = modelName && models ? models[modelName] : null;
  
  const targetUnit = useMemo(() => {
    if (!selectedModel?.target_col) return '%';
    const targetParam = millsParameters.find(param => param.id === selectedModel.target_col);
    return targetParam?.unit || '%';
  }, [selectedModel?.target_col]);

  // Debounced prediction effect for slider changes (reuse existing store behavior)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Object.keys(sliderValues).length > 0) {
        predictWithCurrentValues();
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [sliderValues, predictWithCurrentValues]);

  // Force simulation mode ON for optimization page only
  useEffect(() => {
    try {
      const setSimulationMode = useXgboostStore.getState().setSimulationMode;
      setSimulationMode(true);
    } catch (e) {
      console.warn('Failed to set simulation mode on mount:', e);
    }
  }, []);

  // Handle model selection and metadata updates
  useEffect(() => {
    if (!models || Object.keys(models).length === 0) return;

    const modelIds = Object.keys(models);
    const preferredDefault = "xgboost_psi200_mill8";

    // On first load of optimization, prefer the specific default model if present
    if (!appliedOptimizationDefaultModel.current) {
      appliedOptimizationDefaultModel.current = true;
      if (modelIds.includes(preferredDefault)) {
        setModelName(preferredDefault);
        const m = models[preferredDefault];
        if (m) setModelMetadata(m.features, m.target_col, m.last_trained);
        return; // done
      }
    }

    const findSuitableModel = () => {
      const modelsForCurrentMill = modelIds.filter(m => m.endsWith(`_mill${currentMill}`));
      if (modelsForCurrentMill.length > 0) return modelsForCurrentMill[0];
      const defaultModelId = preferredDefault;
      if (modelIds.includes(defaultModelId)) return defaultModelId;
      return modelIds.length > 0 ? modelIds[0] : null;
    };

    if (!modelName || !models[modelName]) {
      const modelToUse = findSuitableModel();
      if (modelToUse) {
        setModelName(modelToUse);
        const m = models[modelToUse];
        if (m) setModelMetadata(m.features, m.target_col, m.last_trained);
      }
    } else if (models[modelName]) {
      const m = models[modelName];
      setModelMetadata(m.features, m.target_col, m.last_trained);
    }
  }, [models, modelName, currentMill, setModelName, setModelMetadata]);

  // Start real-time data updates when model features are available
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const setupRealTimeUpdates = () => {
      if (modelFeatures && modelFeatures.length > 0) {
        try {
          const cleanupFn = startRealTimeUpdates();
          if (typeof cleanupFn === 'function') cleanup = cleanupFn;
        } catch (error) {
          console.error('Error starting real-time updates:', error);
        }
      } else if (modelName && models && models[modelName] && !modelFeatures) {
        const model = models[modelName];
        setModelMetadata(model.features, model.target_col, model.last_trained);
      }
    };
    setupRealTimeUpdates();
    return () => {
      if (cleanup) cleanup();
      useXgboostStore.getState().stopRealTimeUpdates();
    };
  }, [modelFeatures, startRealTimeUpdates, modelName, models, setModelMetadata]);

  const handlePrediction = async () => {
    if (isPredicting) return;
    setIsPredicting(true);
    try {
      await predictWithCurrentValues();
      toast.success('Prediction completed successfully');
    } catch (error) {
      console.error('Error during prediction:', error);
      toast.error('Failed to make prediction');
    } finally {
      setIsPredicting(false);
    }
  }

  const handleModelChange = async (newModelName: string) => {
    if (newModelName === modelName) return;
    const loadingToast = toast.loading('Switching models...');
    try {
      await stopRealTimeUpdates();
      setPredictedTarget(0);
      setModelName(newModelName);
      if (!models || !models[newModelName]) throw new Error(`Model not found: ${newModelName}`);
      const m = models[newModelName];
      setModelMetadata(m.features, m.target_col, m.last_trained);
      toast.success(`Successfully switched to model: ${newModelName}`, { id: loadingToast });
    } catch (error) {
      console.error('Error during model switch:', error);
      toast.error(`Failed to switch to model: ${newModelName}`, { id: loadingToast });
      if (modelName && models?.[modelName]) {
        setModelName(modelName);
        setModelMetadata(models[modelName].features, models[modelName].target_col, models[modelName].last_trained);
      }
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleMillChange = (millNumber: number) => {
    setCurrentMill(millNumber);
    if (models) {
      const modelForMill = availableModels.find(m => m.endsWith(`_mill${millNumber}`));
      if (modelForMill) handleModelChange(modelForMill);
    }
  };
  
  const handleStartOptimization = async () => {
    if (isOptimizing) return;
    
    setIsOptimizing(true);
    const loadingToast = toast.loading('Starting Bayesian optimization...');
    
    try {
      // Prepare optimization request data
      const optimizationData = {
        model_id: modelName,
        target_setpoint: targetSP,
        parameter_bounds: ranges,
        iterations: 50, // Default iterations
        maximize: true // Assuming we want to maximize the target
      };
      
      console.log('Starting optimization with data:', optimizationData);
      
      // TODO: Call the optimization API endpoint
      // const response = await mlApiClient.post('/api/v1/ml/optimize', optimizationData);
      
      // For now, simulate optimization delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast.success('Optimization completed successfully!', { id: loadingToast });
      
      // TODO: Update parameters with optimized values
      // if (response.data.best_parameters) {
      //   Object.entries(response.data.best_parameters).forEach(([paramId, value]) => {
      //     updateSliderValue(paramId, value as number);
      //   });
      // }
      
    } catch (error) {
      console.error('Optimization failed:', error);
      toast.error('Optimization failed. Please try again.', { id: loadingToast });
    } finally {
      setIsOptimizing(false);
      toast.dismiss(loadingToast);
    }
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Настройки на модел (Optimization)
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 ${isPredicting ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}>
                {isPredicting ? "PREDICTING" : "READY"}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                XGBoost Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div className="w-full">
              <ModelSelection
                currentMill={currentMill}
                modelName={modelName}
                availableModels={availableModels}
                modelFeatures={modelFeatures}
                modelTarget={modelTarget}
                lastTrained={lastTrained}
                onModelChange={handleModelChange}
                onMillChange={handleMillChange}
              />
            </div>
            <div className="space-y-4">
              {/* Target SP Slider */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Target Setpoint ({targetParameter?.name || 'PSI80'})
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {targetSP.toFixed(1)} {targetParameter?.unit || '%'}
                    </Badge>
                  </div>
                  <div className="px-2">
                    <Slider
                      value={[targetSP]}
                      onValueChange={(value) => setTargetSP(value[0])}
                      min={targetParameter?.min || 0}
                      max={targetParameter?.max || 100}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{targetParameter?.min || 0}</span>
                      <span>{targetParameter?.max || 100}</span>
                    </div>
                  </div>
                </div>
              </Card>
              
              {/* Optimization Controls */}
              <div className="flex gap-2">
                <Button
                  onClick={handleStartOptimization}
                  disabled={isOptimizing || !modelFeatures || modelFeatures.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isOptimizing ? 'Optimizing...' : 'Start Optimization'}
                </Button>
                <Button
                  onClick={resetFeatures}
                  variant="outline"
                  className="px-4"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Display */}
      <TargetFractionDisplay
        currentTarget={currentTarget}
        currentPV={currentPV}
        targetData={targetData}
        isOptimizing={isPredicting}
        isSimulationMode={true}
        modelName={selectedModel?.name}
        targetVariable={selectedModel?.target_col}
        targetUnit={targetUnit}
      />

      {/* Parameter Optimization Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {parameters
          .filter(parameter => !modelFeatures || modelFeatures.includes(parameter.id))
          .map((parameter) => {
            const bounds = parameterBounds[parameter.id] || [0, 100];
            const rangeValue = ranges[parameter.id] || [bounds[0], bounds[1]];
            return (
              <ParameterOptimizationCard
                key={`${modelName}-${parameter.id}`}
                parameter={parameter}
                bounds={bounds as [number, number]}
                rangeValue={rangeValue as [number, number]}
                isSimulationMode={true}
                onRangeChange={(id: string, newRange: [number, number]) => {
                  setRanges(prev => ({ ...prev, [id]: newRange }));
                }}
              />
            );
          })}
      </div>
    </div>
  )
}
