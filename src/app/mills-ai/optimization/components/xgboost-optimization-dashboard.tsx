"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, Zap, Play, CheckCircle, AlertCircle, Wrench, Cpu } from "lucide-react"
import { ParameterOptimizationCard } from "./parameter-optimization-card"
import { TargetFractionDisplay } from "../../components/target-fraction-display"
import { ModelSelection } from "../../components/model-selection"
import { useXgboostStore } from "@/app/mills-ai/stores/xgboost-store"
import { useOptimizationStore } from "../../stores/optimization-store"
import { useOptimization } from "../../hooks/useOptimization"
import { useOptimizationResults } from "../../hooks/useOptimizationResults"
import { toast } from "sonner"
import { useGetModels } from "@/app/mills-ai/hooks/use-get-models"
import { millsParameters, getTargets } from "../../data/mills-parameters"
import { Switch } from "@/components/ui/switch"

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
    resetSlidersToPVs,
    predictWithCurrentValues
  } = store;

  // Optimization store and hooks
  const {
    targetSetpoint,
    parameterBounds: optimizationBounds,
    iterations,
    maximize,
    proposedSetpoints,
    setTargetSetpoint,
    updateParameterBounds,
    setParameterBounds,
    setMaximize,
    getOptimizationConfig,
    clearProposedSetpoints,
    clearResults
  } = useOptimizationStore()
  
  const { startOptimization, isOptimizing, progress, error } = useOptimization()
  const { 
    currentResults, 
    hasResults, 
    isSuccessful, 
    applyOptimizedParameters,
    improvementScore 
  } = useOptimizationResults()
  
  
  // Get target parameter bounds based on current model's target
  const targetParameter = useMemo(() => {
    const targetId = modelTarget || 'PSI80';
    
    // First try to find in targets
    const targets = getTargets();
    let targetParam = targets.find(t => t.id === targetId);
    
    // If not found in targets, look in all parameters (some models use features as targets)
    if (!targetParam) {
      targetParam = millsParameters.find(p => p.id === targetId);
    }
    
    // Fallback to first target if nothing found
    return targetParam || targets[0];
  }, [modelTarget]);

  // Initialize optimization bounds from parameterBounds when parameters or bounds change
  useEffect(() => {
    const initial: Record<string, [number, number]> = {};
    let hasChanges = false;
    
    parameters.forEach(p => {
      const b = parameterBounds[p.id] || [0, 100];
      // If existing bounds present keep them, else initialize to 10% inside the parameter bounds
      if (optimizationBounds[p.id]) {
        initial[p.id] = optimizationBounds[p.id] as [number, number];
      } else {
        const span = b[1] - b[0];
        const lo = b[0] + 0.1 * span;
        const hi = b[1] - 0.1 * span;
        initial[p.id] = [lo, hi];
        hasChanges = true;
      }
    });
    
    // Only update if there are actual changes
    if (hasChanges) {
      setParameterBounds(initial);
    }
  }, [parameters, parameterBounds]);  // Removed optimizationBounds and setParameterBounds from deps
  
  // Initialize target setpoint to middle of target parameter range when model changes
  useEffect(() => {
    if (targetParameter) {
      // Always update when target parameter changes (model change)
      setTargetSetpoint((targetParameter.min + targetParameter.max) / 2);
    }
  }, [targetParameter, setTargetSetpoint]);

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

  // Force simulation mode OFF for optimization page to enable PV-based predictions
  useEffect(() => {
    try {
      const setSimulationMode = useXgboostStore.getState().setSimulationMode;
      setSimulationMode(false); // Use real-time mode for PV-based predictions
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
    if (isOptimizing || !modelName) return;
    
    const loadingToast = toast.loading('Starting Bayesian optimization...');
    
    try {
      // Get optimization config from store
      const config = getOptimizationConfig(modelName);
      
      console.log('Starting optimization with config:', config);
      
      // Start optimization using the hook
      const result = await startOptimization(config);
      
      if (result && result.status === 'completed') {
        // Automatically apply optimized parameters
        if (result.best_parameters) {
          applyOptimizedParameters();
        }
        
        // Set the target setpoint to the optimized target value
        if (typeof result.best_score === 'number') {
          setTargetSetpoint(result.best_score);
        }
        
        toast.success(
          `Optimization completed! Parameters and target setpoint automatically applied. Best score: ${result.best_score.toFixed(3)}`,
          { id: loadingToast }
        );
      } else {
        toast.error('Optimization failed. Please try again.', { id: loadingToast });
      }
      
    } catch (error) {
      console.error('Optimization failed:', error);
      toast.error('Optimization failed. Please try again.', { id: loadingToast });
    } finally {
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
              <Badge variant="outline" className={`rounded-full px-3 py-1 ${
                isOptimizing ? "bg-amber-100 text-amber-800 border-amber-200" :
                hasResults && isSuccessful ? "bg-green-100 text-green-800 border-green-200" :
                "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {isOptimizing ? `OPTIMIZING ${progress.toFixed(0)}%` :
                 hasResults && isSuccessful ? "READY" :
                 "CONFIGURING"}
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
            <div className="w-full space-y-4">
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
              {/* Target SP slider moved into TargetFractionDisplay as a vertical control */}
            </div>
            <div className="space-y-4">
              
              {/* Optimization Controls */}
              <div className="space-y-3">
                {/* Maximize/Minimize Toggle */}
                <Card className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium">Optimization Goal</div>
                      <div className="text-xs text-slate-500">Choose whether to maximize or minimize the target value</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${!maximize ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>Minimize</span>
                      <Switch
                        checked={maximize}
                        onCheckedChange={setMaximize}
                        disabled={isOptimizing}
                      />
                      <span className={`text-xs ${maximize ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>Maximize</span>
                    </div>
                  </div>
                </Card>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleStartOptimization}
                    disabled={isOptimizing || !modelFeatures || modelFeatures.length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isOptimizing ? `Optimizing... ${progress.toFixed(0)}%` : 'Start Optimization'}
                  </Button>
                  <Button
                    onClick={() => {
                      // Reset feature sliders to middle of bounds
                      resetFeatures();
                      // Force slider reset
                      resetSlidersToPVs();
                      // Clear optimization results and proposed setpoints
                      clearProposedSetpoints();
                      clearResults();
                      // Reset target setpoint to middle of target parameter range
                      if (targetParameter) {
                        setTargetSetpoint((targetParameter.min + targetParameter.max) / 2);
                      }
                      // Show feedback to user
                      toast.success('Reset complete: cleared all optimization results and returned to default values');
                    }}
                    variant="outline"
                    className="px-4"
                    disabled={isOptimizing}
                  >
                    Reset
                  </Button>
                </div>
                
                
                {/* Error Display */}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
                
                {/* Results Summary */}
                {hasResults && isSuccessful && improvementScore !== null && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Optimization completed with {improvementScore > 0 ? '+' : ''}{improvementScore.toFixed(1)}% improvement
                    </div>
                  </div>
                )}
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
        isSimulationMode={false}
        modelName={selectedModel?.name}
        targetVariable={selectedModel?.target_col}
        targetUnit={targetUnit}
        spOptimize={hasResults && isSuccessful ? targetSetpoint : undefined}
        showOptimizationTarget={hasResults && isSuccessful}
      />

      {/* Parameter Optimization Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {parameters
          .filter(parameter => !modelFeatures || modelFeatures.includes(parameter.id))
          .map((parameter) => {
            const bounds = parameterBounds[parameter.id] || [0, 100];
            const rangeValue = optimizationBounds[parameter.id] || [bounds[0], bounds[1]];
            return (
              <ParameterOptimizationCard
                key={`${modelName}-${parameter.id}`}
                parameter={parameter}
                bounds={bounds as [number, number]}
                rangeValue={rangeValue as [number, number]}
                isSimulationMode={true}
                proposedSetpoint={hasResults && isSuccessful ? proposedSetpoints?.[parameter.id] : undefined}
                onRangeChange={(id: string, newRange: [number, number]) => {
                  updateParameterBounds(id, newRange);
                }}
              />
            );
          })}
      </div>
    </div>
  )
}
