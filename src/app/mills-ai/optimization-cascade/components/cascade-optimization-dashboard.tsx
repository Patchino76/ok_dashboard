"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Activity,
  Zap,
  Play,
  CheckCircle,
  AlertCircle,
  Wrench,
  Cpu,
  GraduationCap,
  Loader2,
  BarChart3,
  Settings,
  Sliders,
} from "lucide-react";
import ParameterCascadeOptimizationCard from "./parameter-cascade-optimization-card";
import type { CascadeParameter } from "../stores/cascade-optimization-store";
import { CascadeTargetTrend } from "./target-cascade-trend";
import { CascadeFlowDiagram } from "./cascade-flow-diagram";
import { CascadeSimulationInterface } from "./cascade-simulation-interface";
import { useCascadeOptimization } from "../../hooks/useCascadeOptimization";
import { useCascadePrediction } from "../hooks/useCascadePrediction";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";
import { useXgboostStore } from "../../stores/xgboost-store";
import { useAdvancedCascadeOptimization } from "../../hooks/useAdvancedCascadeOptimization";
import { useOptimizationResults } from "../../hooks/useOptimizationResults";
import { useCascadeTraining } from "../../hooks/useCascadeTraining";
import { useCascadeModelLoader } from "../../hooks/useCascadeModelLoader";
import { toast } from "sonner";
import { millsParameters, getTargets } from "../../data/mills-parameters";
import { classifyParameters } from "../../data/cascade-parameter-classification";
import { EnhancedModelTraining } from "./enhanced-model-training";
import { OptimizationJob } from "../../hooks/useAdvancedCascadeOptimization";
import { cascadeBG } from "../translations/bg";
import { CascadeModelInsights } from "./cascade-model-insights";

export default function CascadeOptimizationDashboard() {
  // Cascade optimization store
  const cascadeStore = useCascadeOptimizationStore();

  // XGBoost store for real-time data and trends
  const xgboostStore = useXgboostStore();
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
  } = useCascadeModelLoader();

  // Initialize cascade on component mount (only once)
  useEffect(() => {
    const initializeCascade = async () => {
      console.log("Initializing cascade optimization dashboard...");

      // Load cascade model for the current mill (from store's initial state)
      const currentMill = cascadeStore.millNumber;
      console.log(`📥 Loading cascade model for mill ${currentMill}...`);
      try {
        await loadModelForMill(currentMill);
        console.log(
          `✅ Cascade model loaded successfully for mill ${currentMill}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to load cascade model for mill ${currentMill}:`,
          error
        );
      }
    };

    initializeCascade();
  }, []); // Only run once on mount

  // Track processed model metadata to prevent infinite loops
  const processedModelRef = useRef<string | null>(null);

  // COMPLETELY REMOVED THE PROBLEMATIC useEffect
  // Model metadata updates are now handled through useMemo to avoid infinite loops

  // Compute model information without triggering store updates
  const modelInfo = useMemo(() => {
    if (!modelMetadata) return null;

    const features = getAllFeatures();
    const target = getTargetVariable();
    const lastTrained =
      modelMetadata.model_info.metadata?.created_at || "Unknown";
    const modelName = `cascade_mill_${modelMetadata.mill_number}`;

    return {
      features,
      target,
      lastTrained,
      modelName,
      featureClassification: getFeatureClassification(),
    };
  }, [
    modelMetadata,
    getAllFeatures,
    getTargetVariable,
    getFeatureClassification,
  ]);

  // Initialize DV values when model loads
  useEffect(() => {
    if (!modelInfo?.featureClassification) return;

    const featureClassification = modelInfo.featureClassification;
    const dvFeatures = featureClassification.dv_features || [];

    if (dvFeatures.length > 0) {
      const dvValues: Record<string, number> = {};

      dvFeatures.forEach((dvId) => {
        const param = cascadeStore.parameters.find((p) => p.id === dvId);
        if (param) {
          // Use sliderSP if available, otherwise use value
          dvValues[dvId] = param.sliderSP || param.value || 0;
        }
      });

      console.log("🔧 Initializing DV values from model features:", dvValues);
      useCascadeOptimizationStore.getState().setDVValues(dvValues);
    }
  }, [modelInfo?.featureClassification, cascadeStore.parameters]);

  // Update parameter types only when model info changes (without store updates)
  const parametersWithTypes = useMemo(() => {
    if (!modelInfo?.featureClassification) return cascadeStore.parameters;

    return cascadeStore.parameters.map((param) => {
      let varType: "MV" | "CV" | "DV" | undefined;

      if (modelInfo.featureClassification.mv_features?.includes(param.id)) {
        varType = "MV";
      } else if (
        modelInfo.featureClassification.cv_features?.includes(param.id)
      ) {
        varType = "CV";
      } else if (
        modelInfo.featureClassification.dv_features?.includes(param.id)
      ) {
        varType = "DV";
      }

      return { ...param, varType };
    });
  }, [modelInfo?.featureClassification, cascadeStore.parameters]);

  // Function to update parameter types based on cascade model classification
  const updateParameterTypes = useCallback(
    (featureClassification: any) => {
      console.log(
        "🏷️ Updating parameter types with classification:",
        featureClassification
      );

      const updatedParameters = cascadeStore.parameters.map((param) => {
        let varType: "MV" | "CV" | "DV" | undefined;

        if (featureClassification.mv_features?.includes(param.id)) {
          varType = "MV";
        } else if (featureClassification.cv_features?.includes(param.id)) {
          varType = "CV";
        } else if (featureClassification.dv_features?.includes(param.id)) {
          varType = "DV";
        }

        return { ...param, varType };
      });

      useCascadeOptimizationStore.setState((state) => ({
        ...state,
        parameters: updatedParameters,
      }));
    },
    [cascadeStore.parameters]
  );

  // Destructure cascade store values (optimization-only)
  const {
    parameterBounds,
    availableModels,
    millNumber: currentMill,
    sliderValues,
    updateSliderValue: updateCascadeSliderValue,
    resetFeatures,
    resetSliders,
    initializeMVSlidersWithPVs,
    // Optimization-specific properties
    targetSetpoint,
    setTargetSetpoint,
    proposedSetpoints,
    setProposedSetpoints,
    clearProposedSetpoints,
    clearResults,
    mvBounds: optimizationBounds,
    updateMVBounds: updateParameterBounds,
    setMVBounds: setParameterBounds,
    setMillNumber,
    currentResults: cascadeCurrentResults,
  } = cascadeStore;
  const {
    parameters: xgboostParameters,
    // currentTarget, // REMOVED - using hardcoded constant instead
    currentPV,
    targetData,
    displayHours,
    isFetching,
    stopRealTimeUpdates,
    fetchRealTimeData,
    setDisplayHours,
    // predictWithCurrentValues, // REMOVED - cascade UI should not call basic XGBoost models
    setCurrentMill: setXgboostMill,
    setModelMetadata: setXgboostModelMetadata,
    setModelName: setXgboostModelName,
    modelFeatures: xgboostModelFeatures,
    modelTarget: xgboostModelTarget,
    setSimulationMode: setXgboostSimulationMode,
    startRealTimeUpdates,
    resetFeatures: resetXgboostFeatures,
    updateSliderValue: updateXgboostSliderValue,
  } = xgboostStore;
  
  // Model type from cascade store
  const { modelType, setModelType } = cascadeStore;
  // Keep XGBoost store in real-time mode to allow PV value updates
  // We prevent predictions by not calling predictWithCurrentValues, not by simulation mode
  useEffect(() => {
    console.log(
      "✅ Cascade UI: Keeping XGBoost store in real-time mode for PV updates (predictions disabled separately)"
    );
    setXgboostSimulationMode(false); // Real-time mode for PV updates
  }, [setXgboostSimulationMode]);

  const hasCascadeResults = useMemo(
    () => cascadeCurrentResults?.status === "completed",
    [cascadeCurrentResults]
  );

  const cascadePredictedTarget =
    hasCascadeResults &&
    typeof cascadeCurrentResults?.predicted_target === "number" &&
    Number.isFinite(cascadeCurrentResults?.predicted_target)
      ? cascadeCurrentResults?.predicted_target || null
      : null;

  const isOptimizationReady = hasCascadeResults;

  // Use hardcoded constant instead of prediction-based currentTarget
  const currentTarget =
    cascadePredictedTarget !== null ? cascadePredictedTarget : 50.0;

  // Map XGBoost parameters to cascade parameters with varTypes
  const parameters = useMemo(() => {
    if (!modelInfo?.featureClassification) return xgboostParameters;

    return xgboostParameters.map((param) => {
      let varType: "MV" | "CV" | "DV" | undefined;

      if (modelInfo.featureClassification.mv_features?.includes(param.id)) {
        varType = "MV";
      } else if (
        modelInfo.featureClassification.cv_features?.includes(param.id)
      ) {
        varType = "CV";
      } else if (
        modelInfo.featureClassification.dv_features?.includes(param.id)
      ) {
        varType = "DV";
      }

      return { ...param, varType };
    });
  }, [modelInfo?.featureClassification, xgboostParameters]);

  // Cascade prediction function
  const { predictCascade, isLoading: isCascadePredicting } =
    useCascadePrediction();

  const predictWithMVSliderValues = useCallback(async () => {
    if (
      !modelInfo?.featureClassification ||
      !parameters ||
      parameters.length === 0
    ) {
      console.warn(
        "⚠️ Cannot make cascade prediction - missing model info or parameters"
      );
      return;
    }

    try {
      console.log("🎯 Making cascade prediction with MV slider values...");

      // Get MV slider values from cascade store
      const mvSliderValues = cascadeStore.getMVSliderValues();

      // Get DV values from cascade store (uses slider values if available)
      const dvFeatures = modelInfo.featureClassification.dv_features || [];
      const dvValues = cascadeStore.getDVSliderValues(dvFeatures);

      console.log("📊 Cascade prediction data:", {
        mvValues: mvSliderValues,
        dvValues,
      });

      const prediction = await predictCascade(mvSliderValues, dvValues, modelType, modelType === "gpr");

      if (
        prediction &&
        typeof prediction.predicted_target === "number" &&
        Number.isFinite(prediction.predicted_target)
      ) {
        setTestPredictionTarget(prediction.predicted_target);
        toast.success(
          `Cascade Prediction: ${prediction.predicted_target.toFixed(2)}`
        );
      } else {
        toast.warning("Cascade prediction returned no target");
      }
    } catch (error) {
      console.error("❌ Cascade prediction failed:", error);
      toast.error("Cascade prediction failed");
    }
  }, [modelInfo, parameters, predictCascade, cascadeStore]);

  const modelName = modelInfo?.modelName || null;
  const modelFeatures = modelInfo?.features || [];
  const modelTarget = modelInfo?.target || null;
  const lastTrained = modelInfo?.lastTrained || null;

  // Additional cascade optimization store reference for specific operations
  const cascadeOptStore = cascadeStore;

  const {
    startCascadeOptimization,
    startTargetDrivenOptimization,
    isOptimizing,
    error,
    currentTargetResults,
  } = useCascadeOptimization();

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
    error: advancedError,
  } = useAdvancedCascadeOptimization();
  const {
    currentResults,
    hasResults,
    isSuccessful,
    applyOptimizedParameters,
    improvementScore,
  } = useOptimizationResults();

  const lastPredictionTimestampRef = useRef<number | null>(null);
  const isPredictingFromRealTimeRef = useRef(false);
  // Job history state for advanced optimization
  const [jobHistory, setJobHistory] = useState<OptimizationJob[]>([]);

  // Training functionality
  const {
    trainCascadeModel,
    getTrainingStatus,
    isTraining,
    progress: trainingProgress,
    error: trainingError,
  } = useCascadeTraining();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Initialize dates to last 30 days
  useEffect(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(now.toISOString().split("T")[0]);
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

  // Add missing state variables
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [targetVariable, setTargetVariable] = useState("PSI80");
  const [activeTab, setActiveTab] = useState("overview");
  const [testPredictionTarget, setTestPredictionTarget] = useState<
    number | null
  >(null);
  const [predictionUncertainty, setPredictionUncertainty] = useState<
    number | null
  >(null);

  // TIME-BASED CASCADE PREDICTION (Orange SP) - Only triggered by new time points in targetData
  // This should NOT be triggered by parameter changes, only by new timestamps
  // This prediction uses PV values and updates testPredictionTarget (Orange SP)
  useEffect(() => {
    if (
      !modelInfo?.featureClassification ||
      !parameters ||
      parameters.length === 0 ||
      !targetData ||
      targetData.length === 0
    ) {
      return;
    }

    const latestPoint = targetData[targetData.length - 1];
    if (!latestPoint || typeof latestPoint.timestamp !== "number") {
      return;
    }

    // Only proceed if we have a NEW timestamp (time-based trigger)
    if (
      lastPredictionTimestampRef.current &&
      latestPoint.timestamp <= lastPredictionTimestampRef.current
    ) {
      console.log("⏭️ Skipping TIME-BASED prediction - same timestamp");
      return;
    }

    if (isPredictingFromRealTimeRef.current) {
      console.log("⏭️ Skipping TIME-BASED prediction - already predicting");
      return;
    }

    console.log(
      "🕐 TIME-BASED prediction triggered (Orange SP) - New timestamp:",
      new Date(latestPoint.timestamp).toLocaleTimeString()
    );
    console.log(
      "   This will update testPredictionTarget (Orange SP), NOT simulationTarget (Purple SP)"
    );

    const mvValues: Record<string, number> = {};

    // Use current PV values for MVs from parameters at this time point
    parameters.forEach((param) => {
      if (param.varType === "MV") {
        mvValues[param.id] = param.value;
        console.log(`   MV ${param.id} PV value:`, param.value.toFixed(2));
      }
    });

    // Get DV values from cascade store (uses slider values if available)
    const dvFeatures = modelInfo.featureClassification.dv_features || [];
    const dvValues = useCascadeOptimizationStore
      .getState()
      .getDVSliderValues(dvFeatures);
    console.log(`   DV values from sliders:`, dvValues);

    if (Object.keys(mvValues).length === 0) {
      return;
    }

    isPredictingFromRealTimeRef.current = true;

    (async () => {
      try {
        const prediction = await predictCascade(mvValues, dvValues, modelType, modelType === "gpr");
        if (
          prediction &&
          typeof prediction.predicted_target === "number" &&
          Number.isFinite(prediction.predicted_target)
        ) {
          setTestPredictionTarget(prediction.predicted_target);
          setPredictionUncertainty(prediction.target_uncertainty ?? null);
          lastPredictionTimestampRef.current = latestPoint.timestamp;
          console.log(
            "✅ TIME-BASED prediction completed (Orange SP):",
            prediction.predicted_target.toFixed(2),
            prediction.target_uncertainty ? `± ${prediction.target_uncertainty.toFixed(2)}` : ''
          );
          console.log(
            "   Updated testPredictionTarget, simulationTarget remains unchanged"
          );
        }
      } catch (error) {
        console.error(
          "❌ Failed to update cascade prediction from real-time PV data:",
          error
        );
      } finally {
        isPredictingFromRealTimeRef.current = false;
      }
    })();
  }, [
    modelInfo?.featureClassification,
    // REMOVED 'parameters' from dependencies to prevent triggering on parameter value changes
    // Only targetData changes (new time points) should trigger this effect
    predictCascade,
    targetData,
  ]);

  // Trigger trend data update when optimization tab is activated
  useEffect(() => {
    if (
      activeTab === "optimization" &&
      xgboostModelFeatures &&
      xgboostModelFeatures.length > 0
    ) {
      console.log(
        "🎯 Optimization tab activated, triggering trend data refresh..."
      );

      // Small delay to ensure tab content is rendered before fetching data
      const timeoutId = setTimeout(async () => {
        try {
          // Trigger immediate data fetch to populate trends
          await fetchRealTimeData();
          console.log("✅ Trend data refreshed for optimization tab");

          // Initialize MV slider values with current PV values
          console.log("🎯 Initializing MV sliders with current PV values...");
          const currentXgboostParams = xgboostStore.parameters;
          initializeMVSlidersWithPVs(currentXgboostParams);

          toast.success("Trend data refreshed and MV sliders initialized");
        } catch (error) {
          console.error(
            "❌ Error fetching trend data for optimization tab:",
            error
          );
          toast.error("Failed to refresh trend data");
        }

        // Also ensure real-time updates are running
        if (!xgboostStore.dataUpdateInterval) {
          console.log("🔄 Real-time updates not active, starting them...");
          try {
            startRealTimeUpdates();
          } catch (error) {
            console.error("❌ Error starting real-time updates:", error);
          }
        }
      }, 100); // 100ms delay to ensure UI is ready

      return () => clearTimeout(timeoutId);
    }
  }, [
    activeTab,
    xgboostModelFeatures,
    fetchRealTimeData,
    startRealTimeUpdates,
    xgboostStore.dataUpdateInterval,
    initializeMVSlidersWithPVs,
  ]);

  // Get target parameter bounds based on cascade model's target
  const targetParameter = useMemo(() => {
    const targetId = getTargetVariable();

    // First try to find in targets
    const targets = getTargets();
    let targetParam = targets.find((t) => t.id === targetId);

    // If not found in targets, look in all parameters (some models use features as targets)
    if (!targetParam) {
      targetParam = millsParameters.find((p) => p.id === targetId);
    }

    // Fallback to first target if nothing found
    return targetParam || targets[0];
  }, [getTargetVariable]);

  // Initialize optimization bounds from parameterBounds when cascade model is loaded
  useEffect(() => {
    if (!modelMetadata) return;

    const allModelFeatures = getAllFeatures();
    const filteredParameters = parameters.filter((p: any) =>
      allModelFeatures.includes(p.id)
    );

    const initial: Record<string, [number, number]> = {};
    let hasChanges = false;

    filteredParameters.forEach((p) => {
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
  }, [modelMetadata]); // Removed parameters and parameterBounds to prevent infinite loops

  // Initialize target setpoint to middle of target parameter range when model changes
  useEffect(() => {
    if (targetParameter) {
      // Always update when target parameter changes (model change)
      setTargetSetpoint((targetParameter.min + targetParameter.max) / 2);
    }
  }, [targetParameter]); // Removed setTargetSetpoint to prevent infinite loops

  const [isPredicting, setIsPredicting] = useState(false);
  // Removed useGetModels - cascade UI only works with cascade models, not general models

  const handleResetOptimization = () => {
    // Clear optimization results
    clearResults();

    // Reset target setpoint to middle of target parameter range
    if (targetParameter) {
      setTargetSetpoint((targetParameter.min + targetParameter.max) / 2);
    }

    // Initialize MV slider values with current PV values
    console.log(
      "🔄 Reset button: Initializing MV sliders with current PV values..."
    );
    const currentXgboostParams = xgboostStore.parameters;
    initializeMVSlidersWithPVs(currentXgboostParams);

    // After initialization, trigger cascade prediction with the new MV slider values
    console.log(
      "🎯 Reset button: Triggering cascade prediction with initialized MV values..."
    );
    setTimeout(() => {
      predictWithMVSliderValues();
    }, 100); // Small delay to ensure slider values are updated in store

    // Show feedback to user
    toast.success(
      "Optimization reset: cleared results, initialized MV sliders, and triggered prediction"
    );
  };

  const targetUnit = useMemo(() => {
    const targetVariable = getTargetVariable();
    if (!targetVariable) return "%";
    const targetParam = millsParameters.find(
      (param: any) => param.id === targetVariable
    );
    return targetParam?.unit || "%";
  }, [getTargetVariable]);

  // Check if cascade model is ready for predictions
  const isCascadeModelReady = useMemo(() => {
    const features = getAllFeatures();
    return !!(modelMetadata && features && features.length > 0);
  }, [modelMetadata, getAllFeatures]);

  // Removed debounced prediction - using hardcoded defaults instead

  // No need for simulation mode in cascade optimization - removed

  // Update XGBoost store metadata when cascade model is loaded
  useEffect(() => {
    if (!modelMetadata) return;

    const features = getAllFeatures();
    const target = getTargetVariable();
    const lastTrained =
      modelMetadata.model_info?.metadata?.created_at || "Unknown";

    console.log("🔧 Configuring XGBoost store with cascade model metadata:", {
      features,
      target,
      lastTrained,
      featuresLength: features?.length,
    });

    // Configure XGBoost store with cascade model metadata
    if (features && features.length > 0 && target) {
      const cascadeModelName = `cascade_mill_${modelMetadata.mill_number}`;
      console.log("🔧 Setting XGBoost store model name to:", cascadeModelName);

      // Set both model metadata and model name
      setXgboostModelMetadata(features, target, lastTrained);
      setXgboostModelName(cascadeModelName);

      console.log(
        "✅ XGBoost store configured with cascade model metadata and name"
      );
    } else {
      console.warn(
        "⚠️ Cannot configure XGBoost store - missing features or target"
      );
    }
  }, [modelMetadata]); // Removed function dependencies to prevent infinite loops

  // DISABLED OLD LOGIC - Model metadata now handled above
  useEffect(() => {
    return; // Disabled to prevent infinite loops
    if (!modelMetadata) return; // TypeScript null check for unreachable code
    if (modelMetadata) {
      console.log("🔍 Raw cascade model metadata:", modelMetadata);

      const features = getAllFeatures();
      const target = getTargetVariable();
      const lastTrained =
        // @ts-ignore - Unreachable code, modelMetadata is checked above
        modelMetadata.model_info.metadata?.created_at || "Unknown";
      const featureClassification = getFeatureClassification();

      console.log("🔧 Updating XGBoost store with cascade model metadata:", {
        features,
        target,
        featureClassification,
        featuresLength: features?.length,
        featuresArray: features,
        // @ts-ignore - Unreachable code, modelMetadata is checked above
        modelInfoStructure: Object.keys(modelMetadata.model_info || {}),
        // @ts-ignore - Unreachable code, modelMetadata is checked above
        hasAllFeatures: !!modelMetadata.model_info?.all_features,
        hasFeatureClassification:
          // @ts-ignore - Unreachable code, modelMetadata is checked above
          !!modelMetadata.model_info?.feature_classification,
      });

      // Only proceed if we have features
      if (features && features.length > 0) {
        // Model metadata is now computed via useMemo - no store updates needed
        console.log("✅ Model metadata computed via useMemo:", {
          features,
          target,
          lastTrained,
        });

        // Update parameter varTypes based on cascade model classification
        if (
          featureClassification &&
          (featureClassification.mv_features?.length > 0 ||
            featureClassification.cv_features?.length > 0)
        ) {
          updateParameterTypes(featureClassification);
        } else {
          console.warn(
            "⚠️ No feature classification available, using default parameter types"
          );
        }

        console.log(
          "✅ Successfully updated cascade store with cascade model metadata"
        );

        // Wait a moment for the store to be fully updated, then verify
        setTimeout(() => {
          console.log("🔍 Verifying cascade store state after update:", {
            modelFeatures: cascadeStore.modelFeatures,
            modelFeaturesLength: cascadeStore.modelFeatures?.length,
            modelName: cascadeStore.modelName,
            modelTarget: cascadeStore.modelTarget,
            parametersCount: cascadeStore.parameters?.length,
          });
        }, 100);
      } else {
        console.error("❌ No features found in cascade model metadata");
        console.error(
          "Available model info keys:",
          // @ts-ignore - Unreachable code, modelMetadata is checked above
          Object.keys(modelMetadata.model_info || {})
        );

        // Fallback: try to extract features from feature classification
        if (featureClassification) {
          const fallbackFeatures = [
            ...(featureClassification.mv_features || []),
            ...(featureClassification.cv_features || []),
            ...(featureClassification.dv_features || []),
          ];

          if (fallbackFeatures.length > 0) {
            console.log(
              "🔄 Using fallback features from classification:",
              fallbackFeatures
            );
            // Fallback features are now handled via useMemo - no store updates needed
            console.log(
              "✅ Fallback features computed via useMemo:",
              fallbackFeatures
            );
            updateParameterTypes(featureClassification);
          }
        }
      }
    }
  }, [
    modelMetadata,
    getAllFeatures,
    getTargetVariable,
    getFeatureClassification,
    updateParameterTypes,
    cascadeStore,
  ]);

  // Start XGBoost real-time data updates when cascade model is loaded (simplified approach)
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupRealTimeUpdates = () => {
      const features = getAllFeatures();
      console.log(
        "🔄 Cascade optimization: Setting up XGBoost real-time updates",
        {
          hasModelMetadata: !!modelMetadata,
          featuresLength: features.length,
          features,
          currentMill: currentMill,
          xgboostModelFeatures: xgboostModelFeatures,
          xgboostModelTarget: xgboostModelTarget,
        }
      );

      // Simple condition like working XGBoost optimization dashboard
      if (xgboostModelFeatures && xgboostModelFeatures.length > 0) {
        try {
          console.log(
            "✅ Starting XGBoost real-time updates for cascade optimization"
          );
          const cleanupFn = startRealTimeUpdates();
          if (typeof cleanupFn === "function") {
            cleanup = cleanupFn;
            console.log("✅ XGBoost real-time updates started successfully");

            // Trigger immediate data fetch like in the working dashboard
            console.log(
              "📊 Triggering immediate data fetch for trend population"
            );
            fetchRealTimeData().catch((error) => {
              console.error("❌ Error in immediate fetchRealTimeData:", error);
            });
          }
        } catch (error) {
          console.error("Error starting XGBoost real-time updates:", error);
        }
      } else if (
        modelMetadata &&
        features.length > 0 &&
        !xgboostModelFeatures
      ) {
        // Configure XGBoost store with cascade model metadata if not already done
        console.log("🔧 Configuring XGBoost store with cascade model metadata");
        const target = getTargetVariable();
        const lastTrained =
          modelMetadata.model_info?.metadata?.created_at || "Unknown";
        setXgboostModelMetadata(features, target, lastTrained);
        setXgboostModelName(`cascade_mill_${modelMetadata.mill_number}`);
      }
    };

    setupRealTimeUpdates();

    return () => {
      if (cleanup) {
        console.log(
          "🧹 Cleaning up XGBoost real-time updates for cascade optimization"
        );
        cleanup();
      }
      stopRealTimeUpdates();
    };
  }, [
    xgboostModelFeatures,
    modelMetadata,
    currentMill,
    startRealTimeUpdates,
    fetchRealTimeData,
    setXgboostModelMetadata,
    setXgboostModelName,
    getAllFeatures,
    getTargetVariable,
    stopRealTimeUpdates,
  ]);

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
    console.log(`🔄 Mill change requested: ${currentMill} → ${newMill}`);

    if (newMill === currentMill) {
      console.log(`⏭️ Mill change skipped - already on mill ${newMill}`);
      return;
    }

    try {
      console.log(`🛑 Stopping real-time updates for mill ${currentMill}`);
      stopRealTimeUpdates();

      console.log(`📝 Setting mill number to ${newMill}`);
      setMillNumber(newMill); // Cascade store
      setXgboostMill(newMill); // XGBoost store

      // Reset state for new mill
      console.log(`🔄 Resetting state for mill ${newMill}`);
      resetFeatures(); // Reset cascade store parameters to default values
      resetXgboostFeatures(); // Reset XGBoost store parameters to default values

      // Auto-load cascade models for the new mill
      console.log(`📥 Loading cascade model for mill ${newMill}`);
      await loadModelForMill(newMill);

      // Wait a moment for model to load, then restart real-time updates
      setTimeout(async () => {
        console.log(`🔄 Restarting real-time updates for mill ${newMill}`);
        try {
          const cleanupFn = startRealTimeUpdates();
          // Trigger immediate data fetch for the new mill
          await fetchRealTimeData();
          console.log(`✅ Real-time updates restarted for mill ${newMill}`);
        } catch (error) {
          console.error(
            `❌ Failed to restart real-time updates for mill ${newMill}:`,
            error
          );
        }
      }, 2000); // 2 second delay to ensure model is loaded

      console.log(`✅ Successfully switched to Mill ${newMill}`);
      toast.success(`Switched to Mill ${newMill}`);
    } catch (error) {
      console.error("Error switching mills:", error);
      toast.error("Failed to switch mills");
    }
  };

  const handleModelTypeChange = async (newModelType: "xgb" | "gpr") => {
    console.log(`🔄 Model type change requested: ${modelType} → ${newModelType}`);

    if (newModelType === modelType) {
      console.log(`⏭️ Model type change skipped - already using ${newModelType}`);
      return;
    }

    try {
      console.log(`📝 Setting model type to ${newModelType}`);
      setModelType(newModelType);

      // Reload model for current mill with new model type
      console.log(`📥 Reloading ${newModelType.toUpperCase()} model for mill ${currentMill}`);
      await loadModelForMill(currentMill, newModelType);

      console.log(`✅ Successfully switched to ${newModelType.toUpperCase()} model`);
      toast.success(`Switched to ${newModelType.toUpperCase()} model`);
    } catch (error) {
      console.error("Error switching model type:", error);
      toast.error(`Failed to switch to ${newModelType.toUpperCase()} model`);
    }
  };

  const handleStartOptimization = async () => {
    if (isOptimizing || !modelMetadata) return;

    const loadingToast = toast.loading(
      "Starting target-driven optimization..."
    );

    try {
      // Get feature classification from loaded cascade model
      const featureClassification = getFeatureClassification();
      const targetVariable = getTargetVariable();

      // Configure the cascade optimization store for target-driven mode
      cascadeOptStore.setMillNumber(currentMill);
      cascadeOptStore.setTargetVariable(targetVariable);

      // CRITICAL: Ensure we use the current slider value as the target
      console.log("🎯 Current targetSetpoint from slider:", targetSetpoint);
      console.log(
        "🎯 Current store targetValue before update:",
        useCascadeOptimizationStore.getState().targetValue
      );
      cascadeOptStore.setTargetValue(targetSetpoint); // Use slider SP as target value
      console.log(
        "🎯 Store targetValue after update:",
        useCascadeOptimizationStore.getState().targetValue
      );
      cascadeOptStore.setTolerance(0.01); // ±1% tolerance
      cascadeOptStore.setTargetDrivenMode(true);

      // Set MV bounds from user-adjustable optimization bounds (or fallback to parameter bounds)
      const mvBounds: Record<string, [number, number]> = {};
      const { mvOptimizationBounds } = useCascadeOptimizationStore.getState();
      
      featureClassification.mv_features.forEach((paramId) => {
        // Use user-adjusted optimization bounds if available, otherwise use parameter bounds
        const optBounds = mvOptimizationBounds[paramId] ||
          optimizationBounds[paramId] ||
          parameterBounds[paramId] || [0, 100];
        mvBounds[paramId] = optBounds;
      });
      cascadeOptStore.setMVBounds(mvBounds);

      // Set CV bounds (for constraint checking)
      const cvBounds: Record<string, [number, number]> = {};
      featureClassification.cv_features.forEach((paramId) => {
        const bounds = parameterBounds[paramId];
        if (bounds) {
          cvBounds[paramId] = bounds;
        }
      });
      cascadeOptStore.setCVBounds(cvBounds);

      // Set DV values (current disturbance values)
      const dvValues: Record<string, number> = {};
      featureClassification.dv_features.forEach((paramId) => {
        const param = parameters.find((p) => p.id === paramId);
        if (param) {
          const currentValue = sliderValues[paramId] || param.value || 0;
          dvValues[paramId] = currentValue;
        }
      });
      cascadeOptStore.setDVValues(dvValues);

      console.log("🎯 Target-driven optimization configured:", {
        mill: currentMill,
        target: targetVariable,
        targetValue: targetSetpoint,
        tolerance: 0.01,
        mvBounds,
        cvBounds,
        dvValues,
        nTrials: cascadeOptStore.nTrials,
        confidenceLevel: cascadeOptStore.confidenceLevel,
      });

      // Start target-driven cascade optimization
      const result = await startTargetDrivenOptimization();

      console.log("🔍 Optimization result received:", result);
      console.log("🔍 Result status:", result?.status);
      console.log("🔍 Feature classification:", featureClassification);

      if (result && result.status === "completed") {
        const newProposedSetpoints: Record<string, number> = {};

        // Capture optimized MV values, update UI state immediately
        if (result.best_mv_values) {
          Object.entries(result.best_mv_values).forEach(([paramId, value]) => {
            if (featureClassification.mv_features.includes(paramId)) {
              newProposedSetpoints[paramId] = value;
              updateCascadeSliderValue(paramId, value);
              updateXgboostSliderValue(paramId, value);
            }
          });
        }

        // Include predicted CV values for display in parameter cards
        if (result.best_cv_values) {
          Object.entries(result.best_cv_values).forEach(([paramId, value]) => {
            if (featureClassification.cv_features.includes(paramId)) {
              newProposedSetpoints[paramId] = value as number;
            }
          });
        }

        // Store predicted target as part of proposed values for downstream components
        const cascadeTargetId = getTargetVariable();
        if (
          cascadeTargetId &&
          typeof result.best_target_value === "number" &&
          Number.isFinite(result.best_target_value)
        ) {
          newProposedSetpoints[cascadeTargetId] = result.best_target_value;
          cascadeOptStore.setPredictedTarget(result.best_target_value);
          // Update the test prediction target for the target trend component
          setTestPredictionTarget(result.best_target_value);
          console.log(
            "✅ Updated target setpoint to:",
            result.best_target_value
          );
        }

        console.log("🔍 New proposed setpoints:", newProposedSetpoints);
        console.log(
          "🔍 Proposed setpoints count:",
          Object.keys(newProposedSetpoints).length
        );

        if (Object.keys(newProposedSetpoints).length > 0) {
          cascadeOptStore.setProposedSetpoints(newProposedSetpoints);
          console.log("✅ Proposed setpoints set in store");
        } else {
          cascadeOptStore.clearProposedSetpoints();
          console.log("⚠️ No proposed setpoints to set - clearing store");
        }

        toast.success(
          `Target-driven optimization completed! Success rate: ${(
            result.success_rate * 100
          ).toFixed(1)}% (${result.successful_trials}/${
            result.total_trials
          } trials) - Target: ${result.best_target_value?.toFixed(3)} ${
            result.target_achieved ? "✓" : "⚠️"
          } (${result.optimization_time?.toFixed(1)}s)`,
          { id: loadingToast }
        );
      } else {
        toast.error("Cascade optimization failed. Please check the logs.", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Cascade optimization failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Cascade optimization failed: ${errorMsg}`, {
        id: loadingToast,
      });
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleTrainModel = async (config: {
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
    // Config is now required - must be provided by EnhancedModelTraining component
    // This ensures features are always dynamically selected, never hardcoded
    if (
      isTraining ||
      !config.mill_number ||
      !config.start_date ||
      !config.end_date
    )
      return;

    const trainingConfig = config;

    const loadingToast = toast.loading("Training cascade model...");

    try {
      const result = await trainCascadeModel(trainingConfig);

      const modelName = trainingConfig.model_name_suffix
        ? `cascade_mill_${trainingConfig.mill_number}_${trainingConfig.model_name_suffix}`
        : `cascade_mill_${trainingConfig.mill_number}`;

      toast.success(
        `Cascade training started! Model: ${modelName}, Mill ${
          result.mill_number
        }, Data: ${result.data_shape?.[0] || "N/A"} rows, Date range: ${
          result.date_range
        }`,
        { id: loadingToast }
      );

      // Attempt to refresh metadata so insights stay in sync
      try {
        await loadModelForMill(trainingConfig.mill_number);
      } catch (refreshError) {
        console.error("Failed to refresh cascade model metadata", refreshError);
      }
      return;
    } catch (error) {
      console.error("Cascade training failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
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
              {cascadeBG.title}
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            {cascadeBG.subtitle}
          </p>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {cascadeBG.tabs.overview}
            </TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              {cascadeBG.tabs.training}
            </TabsTrigger>
            <TabsTrigger
              value="optimization"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              {cascadeBG.tabs.optimization}
            </TabsTrigger>
            <TabsTrigger value="simulation" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              {cascadeBG.tabs.simulation}
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
                    {cascadeBG.overview.title}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge
                      variant="outline"
                      className={`rounded-full px-3 py-1 ${
                        isOptimizing
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : isOptimizationReady
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {isOptimizing
                        ? cascadeBG.status.optimizing
                        : isOptimizationReady
                        ? cascadeBG.status.ready
                        : cascadeBG.status.configuring}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1 bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1"
                    >
                      <Zap className="h-3 w-3" />
                      {cascadeBG.status.cascadeActive}
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
                          <span className="font-medium text-sm">
                            {cascadeBG.mill.selection}
                          </span>
                        </div>
                        <select
                          value={currentMill}
                          onChange={(e) =>
                            handleMillChange(parseInt(e.target.value))
                          }
                          className="w-full p-2 border border-slate-300 rounded-md text-sm"
                          disabled={isLoadingModel}
                        >
                          {Object.keys(cascadeAvailableModels).map((mill) => (
                            <option key={mill} value={parseInt(mill)}>
                              Мелница {mill}
                            </option>
                          ))}
                        </select>
                        {Object.keys(cascadeAvailableModels).length === 0 && (
                          <div className="text-xs text-slate-500">
                            {cascadeBG.mill.noModels}
                          </div>
                        )}
                        
                        {/* Model Type Selector */}
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm">
                              Тип модел
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={modelType === "xgb" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleModelTypeChange("xgb")}
                              disabled={isLoadingModel}
                              className="flex-1"
                            >
                              XGBoost
                            </Button>
                            <Button
                              variant={modelType === "gpr" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleModelTypeChange("gpr")}
                              disabled={isLoadingModel}
                              className="flex-1"
                            >
                              GPR
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Model Information */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {currentMill}
                        </div>
                        <div className="text-sm text-slate-600">
                          {cascadeBG.mill.selectedMill}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {getAllFeatures().length}
                        </div>
                        <div className="text-sm text-slate-600">
                          {cascadeBG.model.features}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">
                          {getTargetVariable()}
                        </div>
                        <div className="text-sm text-slate-600">
                          {cascadeBG.model.targetVariable}
                        </div>
                      </div>
                    </div>

                    {/* Model Status */}
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {cascadeBG.model.status}
                          </div>
                          <div className="text-xs text-slate-600">
                            {modelMetadata
                              ? `${cascadeBG.model.loaded}: cascade_mill_${modelMetadata.mill_number}`
                              : cascadeBG.model.notLoaded}
                          </div>
                          {isCascadeModelReady && (
                            <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                              <CheckCircle className="h-3 w-3" />
                              {cascadeBG.model.readyForPredictions}
                            </div>
                          )}
                          {modelMetadata && !isCascadeModelReady && (
                            <div className="text-xs text-yellow-600 flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3" />
                              {cascadeBG.model.loadedNotReady}
                            </div>
                          )}
                          {isLoadingModel && (
                            <div className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {cascadeBG.model.loading}
                            </div>
                          )}
                          {modelError && (
                            <div className="text-xs text-red-600 mt-1">
                              {cascadeBG.model.error}: {modelError}
                            </div>
                          )}
                        </div>
                        <div
                          className={`w-3 h-3 rounded-full ${
                            modelMetadata && hasCompleteCascade()
                              ? "bg-green-500"
                              : isLoadingModel
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
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
                      featureClassification={getFeatureClassification()}
                    />
                  </div>
                )}

                {/* Model Feature Importance Metrics */}
                {modelMetadata && (
                  <div className="border-t pt-6">
                    <CascadeModelInsights
                      millNumber={currentMill}
                      modelInfo={modelMetadata?.model_info}
                      isLoading={isLoadingModel}
                      error={modelError || undefined}
                    />
                  </div>
                )}

                {/* No Model Loaded State */}
                {!modelMetadata && !isLoadingModel && (
                  <div className="border-t pt-6">
                    <div className="text-center py-8 text-slate-500">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-lg font-medium mb-2">
                        No Cascade Model Loaded
                      </h3>
                      <p className="text-sm">
                        Select a mill to load its cascade model and view the
                        system flow diagram.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoadingModel && (
                  <div className="border-t pt-6">
                    <div className="text-center py-8 text-slate-500">
                      <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
                      <h3 className="text-lg font-medium mb-2">
                        Loading Cascade Model
                      </h3>
                      <p className="text-sm">
                        Loading model for Mill {currentMill}...
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
                  onMillChange={handleMillChange}
                  onTrainModel={handleTrainModel}
                  isTraining={isTraining}
                  trainingProgress={trainingProgress}
                  trainingError={trainingError}
                  modelInfo={modelMetadata?.model_info}
                  isModelLoading={isLoadingModel}
                  modelError={modelError}
                  onRefreshModelInfo={() => loadModelForMill(currentMill)}
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
                  {cascadeBG.optimization.configuration}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Model Information */}
                <Card className="p-4 bg-slate-50 border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Мелница</div>
                      <div className="text-sm font-semibold text-slate-800">
                        Мелница {currentMill}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Тип модел</div>
                      <div className="text-sm font-semibold text-slate-800 uppercase">
                        {modelType === "gpr" ? "GPR" : "XGBoost"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Целева променлива</div>
                      <div className="text-sm font-semibold text-slate-800">
                        {getTargetVariable()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Брой параметри</div>
                      <div className="text-sm font-semibold text-slate-800">
                        {getAllFeatures().length}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Optimization Controls */}
                {modelType === "gpr" && (
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col flex-1">
                        <div className="text-sm font-medium flex items-center gap-2">
                          Оптимизация с несигурност
                          <button
                            className="text-slate-400 hover:text-slate-600"
                            title="Оптимизацията с несигурност минимизира както целевата стойност, така и несигурността на прогнозата, водейки до по-надеждни решения."
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-xs text-slate-500">
                          Използва несигурността на GPR модела за по-надеждна оптимизация
                        </div>
                      </div>
                      <Switch
                        checked={cascadeStore.useUncertainty}
                        onCheckedChange={cascadeStore.setUseUncertainty}
                        disabled={isOptimizing}
                      />
                    </div>
                  </Card>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleStartOptimization}
                    disabled={isOptimizing || !modelName}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {cascadeBG.optimization.running}
                      </>
                    ) : (
                      cascadeBG.optimization.startOptimization
                    )}
                  </Button>
                  <Button
                    onClick={handleResetOptimization}
                    variant="outline"
                    className="text-slate-700 border-slate-300 hover:bg-slate-50"
                    disabled={isOptimizing}
                  >
                    {cascadeBG.actions.reset}
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
                      Cascade optimization completed with{" "}
                      {(improvementScore || 0) > 0 ? "+" : ""}
                      {(improvementScore || 0).toFixed(1)}% improvement
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Target Trend Display */}
            <CascadeTargetTrend
              currentTarget={currentTarget}
              currentPV={currentPV}
              targetData={targetData}
              isOptimizing={isOptimizing}
              isSimulationMode={isSimulationMode}
              modelName={modelName || undefined}
              targetVariable={getTargetVariable()}
              targetUnit={targetUnit}
              predictionSetpoint={testPredictionTarget}
              predictionUncertainty={predictionUncertainty}
              modelType={modelType}
              spOptimize={
                hasCascadeResults
                  ? cascadePredictedTarget ?? targetSetpoint
                  : undefined
              }
              showOptimizationTarget={hasCascadeResults}
            />

            {/* Parameter Optimization Cards - Organized by Variable Type */}
            <div className="space-y-3">
              {(() => {
                // Only show parameters if we have a loaded cascade model
                if (!modelMetadata) {
                  return (
                    <Card className="p-8 text-center">
                      <div className="text-slate-500">
                        <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-lg font-medium mb-2">
                          Load Cascade Model
                        </h3>
                        <p className="text-sm">
                          Select a mill to load its cascade model and configure
                          optimization parameters.
                        </p>
                      </div>
                    </Card>
                  );
                }

                // Get feature classification from loaded model metadata
                const featureClassification = getFeatureClassification();
                const allModelFeatures = getAllFeatures();

                // Filter parameters to only include those in the loaded model
                const filteredParameters = parameters.filter((parameter) =>
                  allModelFeatures.includes(parameter.id)
                );

                // Group parameters by type using model metadata
                const mvParams = filteredParameters.filter((p) =>
                  featureClassification.mv_features.includes(p.id)
                );
                const cvParams = filteredParameters.filter((p) =>
                  featureClassification.cv_features.includes(p.id)
                );
                const dvParams = filteredParameters.filter((p) =>
                  featureClassification.dv_features.includes(p.id)
                );

                const renderParameterSection = (
                  title: string,
                  description: string | undefined,
                  parameters: typeof filteredParameters,
                  varType: "MV" | "CV" | "DV",
                  iconColor: string,
                  icon: string
                ) => {
                  if (parameters.length === 0) return null;

                  return (
                    <div key={varType} className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-2xl ${iconColor}`}>{icon}</span>
                        <div>
                          <h3 className="text-lg font-semibold">{title}</h3>
                          {description && (
                            <p className="text-sm text-slate-600">
                              {description}
                            </p>
                          )}
                        </div>
                        <div className="ml-auto">
                          <Badge
                            variant="outline"
                            className={`px-3 py-1 ${
                              varType === "MV"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : varType === "CV"
                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {parameters.length} {varType} Parameter
                            {parameters.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {parameters.map((parameter) => {
                          const bounds = parameterBounds[parameter.id] || [
                            0, 100,
                          ];
                          const rangeValue = optimizationBounds[
                            parameter.id
                          ] || [bounds[0], bounds[1]];

                          let proposedValue: number | undefined;
                          if (hasCascadeResults) {
                            if (varType === "MV") {
                              proposedValue =
                                cascadeCurrentResults?.best_mv_values?.[
                                  parameter.id
                                ];
                            } else if (varType === "CV") {
                              proposedValue =
                                cascadeCurrentResults?.predicted_cvs?.[
                                  parameter.id
                                ];
                            } else {
                              const cascadeTargetId = getTargetVariable();
                              if (
                                cascadeTargetId &&
                                cascadeTargetId === parameter.id
                              ) {
                                proposedValue =
                                  cascadeCurrentResults?.predicted_target;
                              }
                            }

                            if (
                              typeof proposedValue !== "number" ||
                              !Number.isFinite(proposedValue)
                            ) {
                              proposedValue = proposedSetpoints?.[parameter.id];
                            }
                          } else {
                            proposedValue = undefined;
                          }

                          // Create cascade parameter with proper typing
                          const cascadeParameter: CascadeParameter = {
                            id: parameter.id,
                            name: parameter.name,
                            unit: parameter.unit,
                            value: parameter.value,
                            sliderSP:
                              cascadeStore.parameters.find(
                                (p) => p.id === parameter.id
                              )?.sliderSP || parameter.value,
                            trend: parameter.trend,
                            color: parameter.color,
                            icon: parameter.icon,
                            varType: varType,
                          };

                          // Helper to validate numeric tuple
                          const validateTuple = (
                            tuple: [number, number] | undefined
                          ): [number, number] | null => {
                            if (!tuple) return null;
                            const [lo, hi] = tuple;
                            if (
                              typeof lo === "number" &&
                              typeof hi === "number" &&
                              Number.isFinite(lo) &&
                              Number.isFinite(hi) &&
                              lo < hi
                            ) {
                              return [lo, hi];
                            }
                            return null;
                          };

                          const getFallbackMedian = (
                            bounds: [number, number] | null
                          ): number | null => {
                            const sliderSP = cascadeStore.parameters.find(
                              (p) => p.id === parameter.id
                            )?.sliderSP;

                            if (
                              typeof proposedValue === "number" &&
                              Number.isFinite(proposedValue)
                            ) {
                              return proposedValue;
                            }

                            if (
                              typeof sliderSP === "number" &&
                              Number.isFinite(sliderSP)
                            ) {
                              return sliderSP;
                            }

                            if (bounds) {
                              return (bounds[0] + bounds[1]) / 2;
                            }

                            const currentValue = parameter.value;
                            return Number.isFinite(currentValue)
                              ? currentValue
                              : null;
                          };

                          const createPercentiles = (
                            bounds: [number, number],
                            median: number | null
                          ) => {
                            const [minVal, maxVal] = bounds;
                            const mid = median ?? (minVal + maxVal) / 2;
                            const span = maxVal - minVal;

                            return {
                              p5: minVal,
                              p25: minVal + span * 0.25,
                              p50: mid,
                              p75: minVal + span * 0.75,
                              p95: maxVal,
                            } as const;
                          };

                          // Determine base bounds from current optimization ranges
                          const optimizedBounds = validateTuple(
                            rangeValue as [number, number]
                          );
                          const parameterDefaultBounds = validateTuple(
                            parameterBounds[parameter.id]
                          );
                          const fallbackBounds =
                            optimizedBounds ?? parameterDefaultBounds;

                          // Get distribution bounds, median, and percentiles for beautiful gradient shading
                          const distributionData = (() => {
                            if (currentTargetResults) {
                              const mvDist =
                                cascadeOptStore.parameterDistributions
                                  .mv_distributions[parameter.id];
                              const cvDist =
                                cascadeOptStore.parameterDistributions
                                  .cv_distributions[parameter.id];
                              const dist = mvDist || cvDist;

                              if (dist) {
                                const {
                                  min_value,
                                  max_value,
                                  median,
                                  sample_count,
                                } = dist;

                                console.log(
                                  `📊 Distribution for ${parameter.id}:`,
                                  {
                                    min: min_value,
                                    max: max_value,
                                    median,
                                    sample_count,
                                    percentiles: dist.percentiles,
                                  }
                                );

                                const validBounds = validateTuple([
                                  min_value,
                                  max_value,
                                ] as [number, number]);

                                if (validBounds) {
                                  const rawP5 =
                                    dist.percentiles?.["5"] ??
                                    dist.percentiles?.["5.0"];
                                  const rawP95 =
                                    dist.percentiles?.["95"] ??
                                    dist.percentiles?.["95.0"];
                                  const rawP25 = dist.percentiles?.["25"];
                                  const rawP75 = dist.percentiles?.["75"];
                                  const rawP50 =
                                    dist.percentiles?.["50"] ??
                                    dist.percentiles?.["50.0"] ??
                                    median;

                                  const lowerPercentile =
                                    typeof rawP5 === "number" &&
                                    Number.isFinite(rawP5)
                                      ? rawP5
                                      : validBounds[0];
                                  const upperPercentile =
                                    typeof rawP95 === "number" &&
                                    Number.isFinite(rawP95)
                                      ? rawP95
                                      : validBounds[1];

                                  const medianValue =
                                    typeof median === "number" &&
                                    Number.isFinite(median)
                                      ? median
                                      : typeof rawP50 === "number" &&
                                        Number.isFinite(rawP50)
                                      ? rawP50
                                      : (lowerPercentile + upperPercentile) / 2;

                                  return {
                                    bounds: [
                                      lowerPercentile,
                                      upperPercentile,
                                    ] as [number, number],
                                    median: medianValue,
                                    percentiles: {
                                      p5: lowerPercentile,
                                      p25:
                                        typeof rawP25 === "number" &&
                                        Number.isFinite(rawP25)
                                          ? rawP25
                                          : lowerPercentile +
                                            (upperPercentile -
                                              lowerPercentile) *
                                              0.25,
                                      p50: medianValue,
                                      p75:
                                        typeof rawP75 === "number" &&
                                        Number.isFinite(rawP75)
                                          ? rawP75
                                          : lowerPercentile +
                                            (upperPercentile -
                                              lowerPercentile) *
                                              0.75,
                                      p95: upperPercentile,
                                    },
                                  };
                                }

                                console.warn(
                                  `⚠️ Invalid distribution values for ${parameter.id}`
                                );
                              }
                            }

                            if (fallbackBounds) {
                              const fallbackMedian =
                                getFallbackMedian(fallbackBounds);
                              return {
                                bounds: fallbackBounds,
                                median: fallbackMedian ?? fallbackBounds[0],
                                percentiles: createPercentiles(
                                  fallbackBounds,
                                  fallbackMedian
                                ),
                              };
                            }

                            return undefined;
                          })();

                          return (
                            <ParameterCascadeOptimizationCard
                              key={parameter.id}
                              parameter={cascadeParameter}
                              bounds={bounds as [number, number]}
                              rangeValue={rangeValue}
                              proposedSetpoint={proposedValue}
                              distributionBounds={distributionData?.bounds}
                              distributionMedian={distributionData?.median}
                              distributionPercentiles={
                                distributionData?.percentiles
                              }
                              onRangeChange={(id, newRange) => {
                                updateParameterBounds(id, newRange);
                              }}
                              showDistributions={true}
                              mvFeatures={featureClassification.mv_features}
                              dvFeatures={featureClassification.dv_features}
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
                      cascadeBG.parameters.controlledFull,
                      cascadeBG.parameters.controlledDescription,
                      cvParams,
                      "CV",
                      "text-blue-600",
                      "📊"
                    )}
                    {renderParameterSection(
                      cascadeBG.parameters.manipulatedFull,
                      cascadeBG.parameters.manipulatedDescription,
                      mvParams,
                      "MV",
                      "text-amber-600",
                      "🎛️"
                    )}
                    {renderParameterSection(
                      cascadeBG.parameters.disturbanceFull,
                      cascadeBG.parameters.disturbanceDescription,
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
                  <h3 className="text-lg font-medium mb-2">
                    Load Cascade Model
                  </h3>
                  <p className="text-sm">
                    Select a mill to load its cascade model and start
                    simulation.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
