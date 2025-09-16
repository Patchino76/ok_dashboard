"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Activity, Zap, Play, CheckCircle, AlertCircle, Wrench, Cpu, GraduationCap } from "lucide-react"
import { ParameterCascadeOptimizationCard, CascadeParameter } from "."
import { TargetFractionDisplay } from "../../components/target-fraction-display"
import { ModelSelection } from "../../components/model-selection"
import { useXgboostStore } from "../../stores/xgboost-store"
import { useOptimizationStore } from "../../stores/optimization-store"
import { useCascadeOptimization } from "../../hooks/useCascadeOptimization"
import { useAdvancedCascadeOptimization } from "../../hooks/useAdvancedCascadeOptimization"
import { useOptimizationResults } from "../../hooks/useOptimizationResults"
import { useCascadeTraining } from "../../hooks/useCascadeTraining"
import { toast } from "sonner"
import { useGetModels } from "../../hooks/use-get-models"
import { millsParameters, getTargets } from "../../data/mills-parameters"
import { Switch } from "@/components/ui/switch"
import { classifyParameters } from "../../data/cascade-parameter-classification"
import { AdvancedOptimizationControls } from "./advanced-optimization-controls"
import { OptimizationJobTracker } from "./optimization-job-tracker"
import { EnhancedModelTraining } from "./enhanced-model-training"
import { OptimizationJob } from "../../hooks/useAdvancedCascadeOptimization"

export default function CascadeOptimizationDashboard() {
  // Get the store instance
  const store = useXgboostStore();
  
  // Set default mill to 7
  useEffect(() => {
    if (store.currentMill !== 7) {
      store.setCurrentMill(7);
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
    clearResults,
    autoApplyProposals,
    setAutoApplyProposals
  } = useOptimizationStore()
  
  const { startCascadeOptimization, isOptimizing, error } = useCascadeOptimization()
  
  // Advanced optimization hook
  const {
    startOptimization: startAdvancedOptimization,
    cancelOptimization,
    getOptimizationStatus,
    getOptimizationResults,
    getRecommendations,
    listOptimizationJobs,
    currentJob,
    currentResults: advancedResults,
    isOptimizing: isAdvancedOptimizing,
    error: advancedError
  } = useAdvancedCascadeOptimization()
  const { 
    currentResults, 
    hasResults, 
    isSuccessful, 
    applyOptimizedParameters,
    improvementScore 
  } = useOptimizationResults()
  
  // Job history state for advanced optimization
  const [jobHistory, setJobHistory] = useState<OptimizationJob[]>([])
  
  // Training functionality
  const { trainCascadeModel, isTraining, progress: trainingProgress, error: trainingError } = useCascadeTraining()
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  // Initialize dates to last 30 days
  useEffect(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(now.toISOString().split('T')[0])
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])
  }, [])
  
  
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
  }, [parameters, parameterBounds])  // Removed optimizationBounds and setParameterBounds from deps
  
  // Initialize target setpoint to middle of target parameter range when model changes
  useEffect(() => {
    if (targetParameter) {
      // Always update when target parameter changes (model change)
      setTargetSetpoint((targetParameter.min + targetParameter.max) / 2);
    }
  }, [targetParameter, setTargetSetpoint]);

  const [isPredicting, setIsPredicting] = useState(false);
  const [useAdvancedOptimization, setUseAdvancedOptimization] = useState(false);
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
    const preferredDefault = "xgboost_PSI200_mill7";

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
    
    const loadingToast = toast.loading('Starting Cascade optimization...');
    
    try {
      // Prepare cascade-specific config with MV and DV values
      const cascadeConfig = {
        mv_values: {} as Record<string, number>,
        dv_values: {} as Record<string, number>,
        target_setpoint: targetSetpoint,
        maximize: maximize
      };
      
      // Classify parameters into MV and DV
      const parameterIds = parameters.map(p => p.id);
      const { mv_parameters, dv_parameters } = classifyParameters(parameterIds);
      
      // Map MV parameters (controllable) with optimization bounds
      mv_parameters.forEach(paramId => {
        const optBounds = optimizationBounds[paramId] || parameterBounds[paramId] || [0, 100];
        const currentValue = sliderValues[paramId] || parameters.find(p => p.id === paramId)?.value || ((optBounds[0] + optBounds[1]) / 2);
        cascadeConfig.mv_values[paramId] = currentValue;
      });
      
      // Map DV parameters (disturbances) with current values
      dv_parameters.forEach(paramId => {
        const currentValue = sliderValues[paramId] || parameters.find(p => p.id === paramId)?.value || 0;
        cascadeConfig.dv_values[paramId] = currentValue;
      });
      
      console.log('Cascade optimization config:', cascadeConfig);
      
      // Start cascade optimization using the new hook
      const result = await startCascadeOptimization(cascadeConfig);
      
      if (result && result.status === 'completed') {
        // Update proposed setpoints with optimized MV values
        const newProposedSetpoints: Record<string, number> = {};
        
        // Set proposed setpoints for MV parameters based on optimization result
        if (result.predicted_cvs) {
          Object.entries(result.predicted_cvs).forEach(([paramId, value]) => {
            if (mv_parameters.includes(paramId)) {
              newProposedSetpoints[paramId] = value;
            }
          });
        }
        
        // Apply proposed setpoints to the optimization store
        if (Object.keys(newProposedSetpoints).length > 0) {
          useOptimizationStore.getState().setProposedSetpoints(newProposedSetpoints);
        }
        
        // Auto-apply if enabled
        if (autoApplyProposals) {
          applyOptimizedParameters();
        }
        
        toast.success(
          `Cascade optimization completed! Target: ${result.predicted_target?.toFixed(3) || 'N/A'} ${result.is_feasible ? '✓' : '⚠️'}`,
          { id: loadingToast }
        );
      } else {
        toast.error('Cascade optimization failed. Please check the logs.', { id: loadingToast });
      }
      
    } catch (error) {
      console.error('Cascade optimization failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Cascade optimization failed: ${errorMsg}`, { id: loadingToast });
    } finally {
      toast.dismiss(loadingToast);
    }
  };
  
  const handleTrainModel = async (config?: {
    mill_number: number;
    start_date: string;
    end_date: string;
    mv_features: string[];
    cv_features: string[];
    dv_features: string[];
    target_variable: string;
    test_size: number;
    resample_freq: string;
    model_name_suffix?: string;
  }) => {
    // Use enhanced config if provided, otherwise fall back to basic config
    const trainingConfig = config || {
      mill_number: currentMill,
      start_date: startDate,
      end_date: endDate,
      mv_features: ["Ore", "WaterMill", "WaterZumpf", "MotorAmp"],
      cv_features: ["PulpHC", "DensityHC", "PressureHC"],
      dv_features: ["Shisti", "Daiki", "Grano"],
      target_variable: "PSI200",
      test_size: 0.2,
      resample_freq: "1min"
    };
    
    if (isTraining || !trainingConfig.mill_number || !trainingConfig.start_date || !trainingConfig.end_date) return;
    
    const loadingToast = toast.loading('Training cascade model...');
    
    try {
      const result = await trainCascadeModel(trainingConfig);
      
      const modelName = trainingConfig.model_name_suffix 
        ? `cascade_mill_${trainingConfig.mill_number}_${trainingConfig.model_name_suffix}`
        : `cascade_mill_${trainingConfig.mill_number}`;
      
      toast.success(
        `Cascade training started! Model: ${modelName}, Mill ${result.mill_number}, Data: ${result.data_shape?.[0] || 'N/A'} rows, Date range: ${result.date_range}`,
        { id: loadingToast }
      );
      
    } catch (error) {
      console.error('Cascade training failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Cascade training failed: ${errorMsg}`, { id: loadingToast });
    } finally {
      toast.dismiss(loadingToast);
    }
  };
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-100 dark:from-purple-900/20 dark:via-indigo-800/20 dark:to-blue-700/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-lg">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Cascade Optimization
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Advanced Cascade optimization for maximum efficiency
          </p>
        </div>

        {/* System Overview */}
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Настройки на модел (Cascade)
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 ${
                isOptimizing ? "bg-amber-100 text-amber-800 border-amber-200" :
                hasResults && isSuccessful ? "bg-green-100 text-green-800 border-green-200" :
                "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {isOptimizing ? 'OPTIMIZING...' :
                 hasResults && isSuccessful ? "READY" :
                 "CONFIGURING"}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Cascade Active
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
                modelType="cascade"
              />
              {/* Target SP slider moved into TargetFractionDisplay as a vertical control */}
            </div>
            <div className="space-y-4">
                            {/* Optimization Mode Toggle */}
                <Card className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium">Optimization Mode</div>
                      <div className="text-xs text-slate-500">Choose between basic cascade or advanced multi-objective optimization</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${!useAdvancedOptimization ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>Basic</span>
                      <Switch
                        checked={useAdvancedOptimization}
                        onCheckedChange={setUseAdvancedOptimization}
                        disabled={isOptimizing || isAdvancedOptimizing}
                      />
                      <span className={`text-xs ${useAdvancedOptimization ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>Advanced</span>
                    </div>
                  </div>
                </Card>
                
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
                
                {/* Auto-Apply Proposed Setpoints Toggle */}
                <Card className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium">Auto-Apply Proposed Setpoints</div>
                      <div className="text-xs text-slate-500">Automatically apply optimized parameters when optimization completes</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${!autoApplyProposals ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>Manual</span>
                      <Switch
                        checked={autoApplyProposals}
                        onCheckedChange={setAutoApplyProposals}
                        disabled={isOptimizing}
                      />
                      <span className={`text-xs ${autoApplyProposals ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>Auto</span>
                    </div>
                  </div>
                </Card>
                
                {/* Enhanced Model Training Section */}
                <EnhancedModelTraining 
                  currentMill={currentMill}
                  onMillChange={setCurrentMill}
                  onTrainModel={handleTrainModel}
                  isTraining={isTraining}
                  trainingProgress={trainingProgress}
                  trainingError={trainingError}
                />
                
                {!useAdvancedOptimization && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleStartOptimization}
                      disabled={isOptimizing || !modelName || !parameters || parameters.length === 0}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isOptimizing ? (
                        <>
                          <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                          Optimizing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start Basic Optimization
                        </>
                      )}
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
                )}
                {/* Error Display */}
                {(error || advancedError) && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    {error || advancedError}
                  </div>
                )}
                
                {/* Results Summary */}
                {hasResults && isSuccessful && improvementScore !== null && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Cascade optimization completed with {improvementScore > 0 ? '+' : ''}{improvementScore.toFixed(1)}% improvement
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Optimization Controls */}
      {useAdvancedOptimization && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AdvancedOptimizationControls
            onStartOptimization={async (request) => {
              try {
                const loadingToast = toast.loading('Starting advanced optimization...');
                await startAdvancedOptimization(request);
                toast.success('Advanced optimization started successfully!', { id: loadingToast });
              } catch (error) {
                console.error('Advanced optimization failed:', error);
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                toast.error(`Advanced optimization failed: ${errorMsg}`);
              }
            }}
            onCancelOptimization={async () => {
              try {
                if (currentJob?.job_id) {
                  await cancelOptimization(currentJob.job_id);
                  toast.success('Optimization cancelled successfully');
                }
              } catch (error) {
                console.error('Failed to cancel optimization:', error);
                toast.error('Failed to cancel optimization');
              }
            }}
            currentJob={currentJob}
            currentResults={advancedResults}
            isOptimizing={isAdvancedOptimizing}
            error={advancedError}
            dvValues={(() => {
              const dvValues: Record<string, number> = {};
              const parameterIds = parameters.map(p => p.id);
              const { dv_parameters } = classifyParameters(parameterIds);
              
              dv_parameters.forEach(paramId => {
                const currentValue = sliderValues[paramId] || parameters.find(p => p.id === paramId)?.value || 0;
                dvValues[paramId] = currentValue;
              });
              
              return dvValues;
            })()}
          />
          
          <OptimizationJobTracker
            currentJob={currentJob}
            currentResults={advancedResults}
            jobHistory={jobHistory}
            onApplyRecommendations={(recommendations) => {
              try {
                const newProposedSetpoints: Record<string, number> = {};
                
                recommendations.forEach(rec => {
                  newProposedSetpoints[rec.parameter_id] = rec.recommended_value;
                });
                
                if (Object.keys(newProposedSetpoints).length > 0) {
                  useOptimizationStore.getState().setProposedSetpoints(newProposedSetpoints);
                  
                  if (autoApplyProposals) {
                    applyOptimizedParameters();
                  }
                  
                  toast.success(`Applied ${recommendations.length} parameter recommendations`);
                }
              } catch (error) {
                console.error('Failed to apply recommendations:', error);
                toast.error('Failed to apply recommendations');
              }
            }}
            onCancelJob={async () => {
              try {
                if (currentJob?.job_id) {
                  await cancelOptimization(currentJob.job_id);
                  toast.success('Job cancelled successfully');
                }
              } catch (error) {
                console.error('Failed to cancel job:', error);
                toast.error('Failed to cancel job');
              }
            }}
            isOptimizing={isAdvancedOptimizing}
          />
        </div>
      )}

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
            
            // Classify parameter type for cascade
            const parameterIds = [parameter.id];
            const { mv_parameters, dv_parameters } = classifyParameters(parameterIds);
            
            let varType: "MV" | "CV" | "DV" = "CV"; // Default
            if (mv_parameters.includes(parameter.id)) {
              varType = "MV";
            } else if (dv_parameters.includes(parameter.id)) {
              varType = "DV";
            }
            
            // Create cascade parameter with proper typing
            const cascadeParameter: CascadeParameter = {
              id: parameter.id,
              name: parameter.name,
              unit: parameter.unit,
              value: parameter.value,
              trend: parameter.trend,
              color: parameter.color,
              icon: parameter.icon,
              varType: varType
            };
            
            return (
              <ParameterCascadeOptimizationCard
                key={`${modelName}-${parameter.id}`}
                parameter={cascadeParameter}
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
    </div>
  )
}
