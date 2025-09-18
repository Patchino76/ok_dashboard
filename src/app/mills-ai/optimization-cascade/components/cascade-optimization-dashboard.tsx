"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Activity, Zap, Play, CheckCircle, AlertCircle, Wrench, Cpu, GraduationCap, Loader2, BarChart3, Settings, Sliders } from "lucide-react"
import { ParameterCascadeOptimizationCard, CascadeParameter } from "."
import { CascadeTargetTrend } from "./target-cascade-trend"
import { CascadeFlowDiagram } from "./cascade-flow-diagram"
import { CascadeSimulationInterface } from "./cascade-simulation-interface"
import { ModelSelection } from "../../components/model-selection"
import { useXgboostStore } from "../../stores/xgboost-store"
import { useOptimizationStore } from "../../stores/optimization-store"
import { useCascadeOptimization } from "../../hooks/useCascadeOptimization"
import { useAdvancedCascadeOptimization } from "../../hooks/useAdvancedCascadeOptimization"
import { useOptimizationResults } from "../../hooks/useOptimizationResults"
import { useCascadeTraining } from "../../hooks/useCascadeTraining"
import { useCascadeModelLoader } from "../../hooks/useCascadeModelLoader"
import { toast } from "sonner"
import { useGetModels } from "../../hooks/use-get-models"
import { millsParameters, getTargets } from "../../data/mills-parameters"
import { classifyParameters } from "../../data/cascade-parameter-classification"
import { EnhancedModelTraining } from "./enhanced-model-training"
import { OptimizationJob } from "../../hooks/useAdvancedCascadeOptimization"

export default function CascadeOptimizationDashboard() {
  // Get the store instance
  const store = useXgboostStore();
  
  // Cascade model loader hook
  const {
    isLoading: isLoadingModel,
    modelMetadata,
    error: modelError,
    availableModels: cascadeAvailableModels,
    loadModelForMill,
    getFeatureClassification,
    getAllFeatures,
    getTargetVariable,
    hasCompleteCascade,
    getModelPerformance
  } = useCascadeModelLoader();

  // Set default mill to 7 and load cascade models on page load
  useEffect(() => {
    const initializeCascade = async () => {
      if (store.currentMill !== 7) {
        store.setCurrentMill(7);
      }
      // Auto-load cascade models for the current mill on page load
      await loadModelForMill(store.currentMill);
    };
    
    initializeCascade();
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
  
  
  // Add missing state variables
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [targetVariable, setTargetVariable] = useState('PSI80');
  const [activeTab, setActiveTab] = useState('overview');

  // Get target parameter bounds based on cascade model's target
  const targetParameter = useMemo(() => {
    const targetId = getTargetVariable();
    
    // First try to find in targets
    const targets = getTargets();
    let targetParam = targets.find(t => t.id === targetId);
    
    // If not found in targets, look in all parameters (some models use features as targets)
    if (!targetParam) {
      targetParam = millsParameters.find(p => p.id === targetId);
    }
    
    // Fallback to first target if nothing found
    return targetParam || targets[0];
  }, [getTargetVariable]);

  // Initialize optimization bounds from parameterBounds when cascade model is loaded
  useEffect(() => {
    if (!modelMetadata) return;
    
    const allModelFeatures = getAllFeatures();
    const filteredParameters = parameters.filter(p => allModelFeatures.includes(p.id));
    
    const initial: Record<string, [number, number]> = {};
    let hasChanges = false;
    
    filteredParameters.forEach(p => {
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
  }, [modelMetadata, parameters, parameterBounds, getAllFeatures])  // Added modelMetadata and getAllFeatures
  
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
  
  const handleResetOptimization = () => {
    // Clear optimization results
    clearResults();
    
    // Reset target setpoint to middle of target parameter range
    if (targetParameter) {
      setTargetSetpoint((targetParameter.min + targetParameter.max) / 2);
    }
    
    // Show feedback to user
    toast.success('Optimization reset: cleared all optimization results and returned to default values');
  };
  
  const targetUnit = useMemo(() => {
    const targetVariable = getTargetVariable();
    if (!targetVariable) return '%';
    const targetParam = millsParameters.find(param => param.id === targetVariable);
    return targetParam?.unit || '%';
  }, [getTargetVariable]);

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

  // Update store metadata when cascade model is loaded
  useEffect(() => {
    if (modelMetadata) {
      const features = getAllFeatures();
      const target = getTargetVariable();
      const lastTrained = modelMetadata.model_info.metadata?.created_at || 'Unknown';
      
      // Update the store with cascade model metadata
      setModelMetadata(features, target, lastTrained);
      setModelName(`cascade_mill_${modelMetadata.mill_number}`);
    }
  }, [modelMetadata, getAllFeatures, getTargetVariable, setModelMetadata, setModelName]);

  // Start real-time data updates when cascade model is loaded
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const setupRealTimeUpdates = () => {
      const features = getAllFeatures();
      if (modelMetadata && features.length > 0) {
        try {
          const cleanupFn = startRealTimeUpdates();
          if (typeof cleanupFn === 'function') cleanup = cleanupFn;
        } catch (error) {
          console.error('Error starting real-time updates:', error);
        }
      }
    };
    setupRealTimeUpdates();
    return () => {
      if (cleanup) cleanup();
    };
  }, [modelMetadata, getAllFeatures, startRealTimeUpdates]);

  const handleModelChange = async (newModelName: string) => {
    // For cascade optimization, model changes are handled through mill changes
    // This function is kept for compatibility but redirects to mill change
    const millMatch = newModelName.match(/cascade_mill_(\d+)/);
    if (millMatch) {
      const millNumber = parseInt(millMatch[1]);
      await handleMillChange(millNumber);
    }
  };

  const handleMillChange = async (newMill: number) => {
    if (newMill === currentMill) return;
    
    try {
      await stopRealTimeUpdates();
      setCurrentMill(newMill);
      
      // Reset state for new mill
      setPredictedTarget(0);
      resetFeatures(); // Reset parameters to default values
      
      // Auto-load cascade models for the new mill
      await loadModelForMill(newMill);
      
      toast.success(`Switched to Mill ${newMill}`);
    } catch (error) {
      console.error('Error switching mills:', error);
      toast.error('Failed to switch mills');
    }
  };

  
  const handleStartOptimization = async () => {
    if (isOptimizing || !modelMetadata) return;
    
    const loadingToast = toast.loading('Starting Cascade optimization...');
    
    try {
      // Get feature classification from loaded cascade model
      const featureClassification = getFeatureClassification();
      
      // Prepare cascade-specific config with MV and DV values
      const cascadeConfig = {
        mv_values: {} as Record<string, number>,
        dv_values: {} as Record<string, number>,
        target_setpoint: targetSetpoint,
        maximize: maximize
      };
      
      // Map MV parameters (controllable) with optimization bounds
      featureClassification.mv_features.forEach(paramId => {
        const param = parameters.find(p => p.id === paramId);
        if (param) {
          const optBounds = optimizationBounds[paramId] || parameterBounds[paramId] || [0, 100];
          const currentValue = sliderValues[paramId] || param.value || ((optBounds[0] + optBounds[1]) / 2);
          cascadeConfig.mv_values[paramId] = currentValue;
        }
      });
      
      // Map DV parameters (disturbances) with current values
      featureClassification.dv_features.forEach(paramId => {
        const param = parameters.find(p => p.id === paramId);
        if (param) {
          const currentValue = sliderValues[paramId] || param.value || 0;
          cascadeConfig.dv_values[paramId] = currentValue;
        }
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
            if (featureClassification.mv_features.includes(paramId)) {
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

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Training
            </TabsTrigger>
            <TabsTrigger value="optimization" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Optimization
            </TabsTrigger>
            <TabsTrigger value="simulation" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              Simulation
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Enhanced System Status & Cascade Flow Card */}
            <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    System Overview & Cascade Flow
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
              <CardContent className="space-y-6">
                {/* Model Selection and Status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Mill Selection */}
                  <div className="lg:col-span-1">
                    <Card className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm">Mill Selection</span>
                        </div>
                        <select
                          value={currentMill}
                          onChange={(e) => handleMillChange(parseInt(e.target.value))}
                          className="w-full p-2 border border-slate-300 rounded-md text-sm"
                          disabled={isLoadingModel}
                        >
                          {Object.keys(cascadeAvailableModels).map(mill => (
                            <option key={mill} value={parseInt(mill)}>
                              Mill {mill}
                            </option>
                          ))}
                        </select>
                        {Object.keys(cascadeAvailableModels).length === 0 && (
                          <div className="text-xs text-slate-500">
                            No cascade models available
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                  
                  {/* Model Information */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{currentMill}</div>
                        <div className="text-sm text-slate-600">Selected Mill</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{getAllFeatures().length}</div>
                        <div className="text-sm text-slate-600">Model Features</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">{getTargetVariable()}</div>
                        <div className="text-sm text-slate-600">Target Variable</div>
                      </div>
                    </div>
                    
                    {/* Model Status */}
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Cascade Model Status</div>
                          <div className="text-xs text-slate-600">
                            {modelMetadata ? `Loaded: cascade_mill_${modelMetadata.mill_number}` : 'No cascade model loaded'}
                          </div>
                          {isLoadingModel && (
                            <div className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading model...
                            </div>
                          )}
                          {modelError && (
                            <div className="text-xs text-red-600 mt-1">
                              Error: {modelError}
                            </div>
                          )}
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          modelMetadata && hasCompleteCascade() ? 'bg-green-500' : 
                          isLoadingModel ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cascade Flow Diagram */}
                {modelMetadata && getAllFeatures().length > 0 && (
                  <div className="border-t pt-6">
                    <CascadeFlowDiagram 
                      modelFeatures={getAllFeatures()}
                      modelTarget={getTargetVariable()}
                    />
                  </div>
                )}
                
                {/* No Model Loaded State */}
                {!modelMetadata && !isLoadingModel && (
                  <div className="border-t pt-6">
                    <div className="text-center py-8 text-slate-500">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-lg font-medium mb-2">No Cascade Model Loaded</h3>
                      <p className="text-sm">
                        Select a mill to load its cascade model and view the system flow diagram.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Loading State */}
                {isLoadingModel && (
                  <div className="border-t pt-6">
                    <div className="text-center py-8 text-slate-500">
                      <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
                      <h3 className="text-lg font-medium mb-2">Loading Cascade Model</h3>
                      <p className="text-sm">
                        Loading model for Mill {currentMill}...
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Target Display */}
            <CascadeTargetTrend
              currentTarget={currentTarget}
              currentPV={currentPV}
              targetData={targetData}
              isOptimizing={isOptimizing}
              isSimulationMode={isSimulationMode}
              modelName={modelName}
              targetVariable={targetVariable}
              targetUnit={targetUnit}
              spOptimize={hasResults && isSuccessful ? targetSetpoint : undefined}
              showOptimizationTarget={hasResults && isSuccessful}
            />
          </TabsContent>

          {/* Training Tab */}
          <TabsContent value="training" className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                  Model Training
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EnhancedModelTraining 
                  currentMill={currentMill}
                  onMillChange={setCurrentMill}
                  onTrainModel={handleTrainModel}
                  isTraining={isTraining}
                  trainingProgress={trainingProgress}
                  trainingError={trainingError}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Optimization Tab */}
          <TabsContent value="optimization" className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-600" />
                  Optimization Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Optimization Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleStartOptimization}
                    disabled={isOptimizing || !modelName}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      'Start Optimization'
                    )}
                  </Button>
                  <Button
                    onClick={handleResetOptimization}
                    variant="outline"
                    className="text-slate-700 border-slate-300 hover:bg-slate-50"
                    disabled={isOptimizing}
                  >
                    Reset
                  </Button>
                </div>

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
                      Cascade optimization completed with {(improvementScore || 0) > 0 ? '+' : ''}{(improvementScore || 0).toFixed(1)}% improvement
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parameter Optimization Cards - Organized by Variable Type */}
            <div className="space-y-8">
              {(() => {
                // Only show parameters if we have a loaded cascade model
                if (!modelMetadata) {
                  return (
                    <Card className="p-8 text-center">
                      <div className="text-slate-500">
                        <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-lg font-medium mb-2">Load Cascade Model</h3>
                        <p className="text-sm">
                          Select a mill to load its cascade model and configure optimization parameters.
                        </p>
                      </div>
                    </Card>
                  );
                }

                // Get feature classification from loaded model metadata
                const featureClassification = getFeatureClassification();
                const allModelFeatures = getAllFeatures();

                // Filter parameters to only include those in the loaded model
                const filteredParameters = parameters.filter(parameter => 
                  allModelFeatures.includes(parameter.id)
                );

                // Group parameters by type using model metadata
                const mvParams = filteredParameters.filter(p => featureClassification.mv_features.includes(p.id));
                const cvParams = filteredParameters.filter(p => featureClassification.cv_features.includes(p.id));
                const dvParams = filteredParameters.filter(p => featureClassification.dv_features.includes(p.id));

                const renderParameterSection = (
                  title: string,
                  description: string,
                  parameters: typeof filteredParameters,
                  varType: "MV" | "CV" | "DV",
                  iconColor: string,
                  icon: string
                ) => {
                  if (parameters.length === 0) return null;

                  return (
                    <div key={varType} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl ${iconColor}`}>{icon}</span>
                        <div>
                          <h3 className="text-lg font-semibold">{title}</h3>
                          <p className="text-sm text-slate-600">{description}</p>
                        </div>
                        <div className="ml-auto">
                          <Badge variant="outline" className={`px-3 py-1 ${
                            varType === 'MV' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            varType === 'CV' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            {parameters.length} {varType} Parameter{parameters.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {parameters.map((parameter) => {
                          const bounds = parameterBounds[parameter.id] || [0, 100];
                          const rangeValue = optimizationBounds[parameter.id] || [bounds[0], bounds[1]];
                          
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
                              isSimulationMode={false}
                              proposedSetpoint={hasResults && isSuccessful ? proposedSetpoints?.[parameter.id] : undefined}
                              onRangeChange={(id: string, newRange: [number, number]) => {
                                updateParameterBounds(id, newRange);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {renderParameterSection(
                      "Manipulated Variables (MV)",
                      "Variables that can be controlled and optimized",
                      mvParams,
                      "MV",
                      "text-amber-600",
                      "🎛️"
                    )}
                    {renderParameterSection(
                      "Controlled Variables (CV)",
                      "Variables that are measured and predicted by the cascade model",
                      cvParams,
                      "CV",
                      "text-blue-600",
                      "📊"
                    )}
                    {renderParameterSection(
                      "Disturbance Variables (DV)",
                      "External factors and lab-analyzed parameters",
                      dvParams,
                      "DV",
                      "text-emerald-600",
                      "🧪"
                    )}
                  </>
                );
              })()}
            </div>
          </TabsContent>

          {/* Simulation Tab */}
          <TabsContent value="simulation" className="space-y-6">
            {modelMetadata ? (
              <CascadeSimulationInterface
                modelFeatures={getAllFeatures()}
                modelTarget={getTargetVariable()}
              />
            ) : (
              <Card className="p-8 text-center">
                <div className="text-slate-500">
                  <Sliders className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium mb-2">Load Cascade Model</h3>
                  <p className="text-sm">
                    Select a mill to load its cascade model and start simulation.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
