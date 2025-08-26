"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Activity, Zap, Settings, Play, CheckCircle, AlertCircle, Wrench, Cpu } from "lucide-react"
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
    predictWithCurrentValues
  } = store;

  // Optimization store and hooks
  const {
    targetSetpoint,
    parameterBounds: optimizationBounds,
    iterations,
    maximize,
    optimizationMode,
    proposedSetpoints,
    setTargetSetpoint,
    updateParameterBounds,
    setParameterBounds,
    setOptimizationMode,
    getOptimizationConfig,
    isTrainingMode,
    isRuntimeMode,
    autoApplyProposals,
    setAutoApplyProposals
  } = useOptimizationStore()
  
  const { startOptimization, isOptimizing, progress, error } = useOptimization()
  const { 
    currentResults, 
    hasResults, 
    isSuccessful, 
    applyOptimizedParameters,
    improvementScore 
  } = useOptimizationResults()
  
  // Add test proposed setpoints for runtime mode visualization
  useEffect(() => {
    if (optimizationMode === 'runtime' && !proposedSetpoints && parameters.length > 0) {
      const testProposedSetpoints: Record<string, number> = {};
      parameters.forEach(param => {
        const bounds = parameterBounds[param.id] || [0, 100];
        // Generate a test value between 30-70% of the parameter range
        const range = bounds[1] - bounds[0];
        const testValue = bounds[0] + (0.3 + Math.random() * 0.4) * range;
        testProposedSetpoints[param.id] = testValue;
      });
      
      // Set test proposed setpoints for visualization
      const { setProposedSetpoints } = useOptimizationStore.getState();
      setProposedSetpoints(testProposedSetpoints);
      console.log('Added test proposed setpoints for runtime mode:', testProposedSetpoints);
    }
  }, [optimizationMode, proposedSetpoints, parameters, parameterBounds]);
  
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
    if (isOptimizing || !modelName) return;
    
    const loadingToast = toast.loading('Starting Bayesian optimization...');
    
    try {
      // Get optimization config from store
      const config = getOptimizationConfig(modelName);
      
      console.log('Starting optimization with config:', config);
      
      // Start optimization using the hook
      const result = await startOptimization(config);
      
      if (result && result.status === 'completed') {
        toast.success(
          `Optimization completed! Best score: ${result.best_score.toFixed(3)}`,
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
  
  const handleApplyResults = () => {
    if (currentResults?.best_parameters) {
      applyOptimizedParameters();
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
              {/* Target SP Slider (moved just below ModelSelection with same width) */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Target Setpoint ({targetParameter?.name || 'PSI80'})
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {targetSetpoint.toFixed(1)} {targetParameter?.unit || '%'}
                    </Badge>
                  </div>
                  <div className="px-2">
                    <Slider
                      value={[targetSetpoint]}
                      onValueChange={(value) => setTargetSetpoint(value[0])}
                      min={targetParameter?.min || 0}
                      max={targetParameter?.max || 100}
                      step={0.1}
                      className="w-full"
                      disabled={isOptimizing || isRuntimeMode()}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{targetParameter?.min || 0}</span>
                      <span>{targetParameter?.max || 100}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              {/* Auto-populate proposed setpoints toggle */}
              <Card className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium">Auto-populate proposed setpoints</div>
                    <div className="text-xs text-slate-500">After optimization completes, use best parameters as proposed setpoints</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Manual</span>
                    <Switch
                      checked={autoApplyProposals}
                      onCheckedChange={setAutoApplyProposals}
                      disabled={isOptimizing}
                    />
                    <span className="text-xs text-slate-500">Auto</span>
                  </div>
                </div>
              </Card>
              
              {/* Mode Toggle */}
              <Card className="p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Optimization Mode</div>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <Button
                      size="sm"
                      variant={optimizationMode === 'training' ? 'default' : 'ghost'}
                      className="px-3 py-1 text-xs"
                      onClick={() => setOptimizationMode('training')}
                      disabled={isOptimizing}
                    >
                      <Wrench className="h-3 w-3 mr-1" />
                      Training
                    </Button>
                    <Button
                      size="sm"
                      variant={optimizationMode === 'runtime' ? 'default' : 'ghost'}
                      className="px-3 py-1 text-xs"
                      onClick={() => setOptimizationMode('runtime')}
                      disabled={isOptimizing}
                    >
                      <Cpu className="h-3 w-3 mr-1" />
                      Runtime
                    </Button>
                  </div>
                </div>
              </Card>
              
              {/* Optimization Controls */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    onClick={handleStartOptimization}
                    disabled={isOptimizing || !modelFeatures || modelFeatures.length === 0 || isRuntimeMode()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isOptimizing ? `Optimizing... ${progress.toFixed(0)}%` : 'Start Optimization'}
                  </Button>
                  <Button
                    onClick={resetFeatures}
                    variant="outline"
                    className="px-4"
                    disabled={isOptimizing || isRuntimeMode()}
                  >
                    Reset
                  </Button>
                </div>
                
                {/* Results Actions */}
                {hasResults && isSuccessful && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApplyResults}
                      variant="outline"
                      className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                      disabled={isOptimizing}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Apply Optimized Parameters
                    </Button>
                  </div>
                )}
                
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
        isSimulationMode={true}
        modelName={selectedModel?.name}
        targetVariable={selectedModel?.target_col}
        targetUnit={targetUnit}
        spOptimize={targetSetpoint}
        showOptimizationTarget={true}
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
                optimizationMode={optimizationMode}
                proposedSetpoint={proposedSetpoints?.[parameter.id]}
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
