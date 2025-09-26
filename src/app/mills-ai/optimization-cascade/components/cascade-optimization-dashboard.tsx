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
import { ParameterCascadeOptimizationCard, CascadeParameter } from ".";
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
    // Optimization-specific properties
    targetSetpoint,
    maximize,
    setTargetSetpoint,
    setMaximize,
    proposedSetpoints,
    setProposedSetpoints,
    clearProposedSetpoints,
    clearResults,
    autoApplyResults,
    setAutoApplyResults,
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

  const predictWithCascadeModel = useCallback(async () => {
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
      console.log("🎯 Making cascade prediction via hook...");

      const mvValues: Record<string, number> = {};
      const dvValues: Record<string, number> = {};

      parameters.forEach((param) => {
        if (param.varType === "MV") {
          mvValues[param.id] = param.value;
        } else if (param.varType === "DV") {
          dvValues[param.id] = param.value;
        }
      });

      console.log("📊 Cascade prediction data:", { mvValues, dvValues });

      const prediction = await predictCascade(mvValues, dvValues);

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
  }, [modelInfo, parameters, predictCascade]);

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

    if (
      lastPredictionTimestampRef.current &&
      latestPoint.timestamp <= lastPredictionTimestampRef.current
    ) {
      return;
    }

    if (isPredictingFromRealTimeRef.current) {
      return;
    }

    const mvValues: Record<string, number> = {};
    const dvValues: Record<string, number> = {};

    parameters.forEach((param) => {
      if (param.varType === "MV") {
        mvValues[param.id] = param.value;
      } else if (param.varType === "DV") {
        dvValues[param.id] = param.value;
      }
    });

    if (Object.keys(mvValues).length === 0) {
      return;
    }

    isPredictingFromRealTimeRef.current = true;

    (async () => {
      try {
        const prediction = await predictCascade(mvValues, dvValues);
        if (
          prediction &&
          typeof prediction.predicted_target === "number" &&
          Number.isFinite(prediction.predicted_target)
        ) {
          setTestPredictionTarget(prediction.predicted_target);
          lastPredictionTimestampRef.current = latestPoint.timestamp;
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
    parameters,
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
          toast.success("Trend data refreshed for optimization tab");
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

    // Show feedback to user
    toast.success(
      "Optimization reset: cleared all optimization results and returned to default values"
    );
  };

  const handleDebugTrendData = async () => {
    console.log("🔍 CASCADE OPTIMIZATION DEBUG - Current State:", {
      activeTab: activeTab,
      cascadeModelFeatures: getAllFeatures(),
      cascadeModelName: modelInfo?.modelName,
      currentMill: currentMill,
      xgboostParametersWithTrends: xgboostParameters.map((p: any) => ({
        id: p.id,
        name: p.name,
        trendLength: p.trend.length,
        varType: parameters.find((cp) => cp.id === p.id)?.varType,
      })),
      targetDataLength: targetData.length,
      displayHours: displayHours,
      isFetching: isFetching,
      cascadeModelMetadata: modelMetadata,
      cascadeFeatures: getAllFeatures(),
      xgboostModelFeatures: xgboostModelFeatures,
      xgboostModelTarget: xgboostModelTarget,
      realTimeUpdatesActive: !!xgboostStore.dataUpdateInterval,
    });

    // Force restart real-time updates if needed
    if (!getAllFeatures() || getAllFeatures().length === 0) {
      console.log(
        "⚠️ No cascade model features detected, attempting to reload cascade model..."
      );
      try {
        await loadModelForMill(currentMill);
        console.log("✅ Cascade model reloaded");
      } catch (error) {
        console.error("❌ Failed to reload cascade model:", error);
      }
    }

    // Force restart real-time updates if XGBoost store is configured but not running
    if (
      xgboostModelFeatures &&
      xgboostModelFeatures.length > 0 &&
      !xgboostStore.dataUpdateInterval
    ) {
      console.log(
        "🔄 XGBoost store configured but real-time updates not running, restarting..."
      );
      try {
        stopRealTimeUpdates();
        const cleanupFn = startRealTimeUpdates();
        console.log("✅ Real-time updates restarted");
      } catch (error) {
        console.error("❌ Failed to restart real-time updates:", error);
      }
    }

    // Trigger manual data fetch from XGBoost store
    console.log(
      "🔄 Manually triggering fetchRealTimeData from XGBoost store..."
    );
    try {
      await fetchRealTimeData();
      console.log("✅ Manual data fetch completed");
    } catch (error) {
      console.error("❌ Manual data fetch failed:", error);
    }

    toast.info("Debug info logged to console. Check browser dev tools.");
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

      // Set MV bounds from optimization bounds
      const mvBounds: Record<string, [number, number]> = {};
      featureClassification.mv_features.forEach((paramId) => {
        const optBounds = optimizationBounds[paramId] ||
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

        // Auto-apply remains optional for legacy flows (no-op for cascade store)
        if (autoApplyResults) {
          applyOptimizedParameters();
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
      resample_freq: "1min",
    };

    if (
      isTraining ||
      !trainingConfig.mill_number ||
      !trainingConfig.start_date ||
      !trainingConfig.end_date
    )
      return;

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
            <TabsTrigger
              value="optimization"
              className="flex items-center gap-2"
            >
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
                        ? "OPTIMIZING..."
                        : isOptimizationReady
                        ? "READY"
                        : "CONFIGURING"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1 bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1"
                    >
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
                          <span className="font-medium text-sm">
                            Mill Selection
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
                        <div className="text-2xl font-bold text-blue-600">
                          {currentMill}
                        </div>
                        <div className="text-sm text-slate-600">
                          Selected Mill
                        </div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {getAllFeatures().length}
                        </div>
                        <div className="text-sm text-slate-600">
                          Model Features
                        </div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">
                          {getTargetVariable()}
                        </div>
                        <div className="text-sm text-slate-600">
                          Target Variable
                        </div>
                      </div>
                    </div>

                    {/* Model Status */}
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            Cascade Model Status
                          </div>
                          <div className="text-xs text-slate-600">
                            {modelMetadata
                              ? `Loaded: cascade_mill_${modelMetadata.mill_number}`
                              : "No cascade model loaded"}
                          </div>
                          {isCascadeModelReady && (
                            <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                              <CheckCircle className="h-3 w-3" />
                              Ready for predictions
                            </div>
                          )}
                          {modelMetadata && !isCascadeModelReady && (
                            <div className="text-xs text-yellow-600 flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3" />
                              Model loaded but not ready
                            </div>
                          )}
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
                  onMillChange={cascadeStore.setMillNumber}
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
                        <div className="text-sm font-medium">
                          Optimization Goal
                        </div>
                        <div className="text-xs text-slate-500">
                          Choose whether to maximize or minimize the target
                          value
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs ${
                            !maximize
                              ? "text-slate-900 font-medium"
                              : "text-slate-500"
                          }`}
                        >
                          Minimize
                        </span>
                        <Switch
                          checked={maximize}
                          onCheckedChange={setMaximize}
                          disabled={isOptimizing}
                        />
                        <span
                          className={`text-xs ${
                            maximize
                              ? "text-slate-900 font-medium"
                              : "text-slate-500"
                          }`}
                        >
                          Maximize
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* Auto-Apply Proposed Setpoints Toggle */}
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium">
                          Auto-Apply Proposed Setpoints
                        </div>
                        <div className="text-xs text-slate-500">
                          Automatically apply optimized parameters when
                          optimization completes
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs ${
                            !autoApplyResults
                              ? "text-slate-900 font-medium"
                              : "text-slate-500"
                          }`}
                        >
                          Manual
                        </span>
                        <Switch
                          checked={autoApplyResults}
                          onCheckedChange={setAutoApplyResults}
                          disabled={isOptimizing}
                        />
                        <span
                          className={`text-xs ${
                            autoApplyResults
                              ? "text-slate-900 font-medium"
                              : "text-slate-500"
                          }`}
                        >
                          Auto
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleStartOptimization}
                    disabled={isOptimizing || !modelName}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      "Start Optimization"
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
                  <Button
                    onClick={handleDebugTrendData}
                    variant="outline"
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                    disabled={isOptimizing}
                    title="Debug trend data - check console"
                  >
                    🔍 Debug
                  </Button>
                  <Button
                    onClick={predictWithCascadeModel}
                    variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50"
                    disabled={
                      isOptimizing ||
                      !isCascadeModelReady ||
                      isCascadePredicting
                    }
                    title="Test cascade prediction - check console and toast"
                  >
                    {isCascadePredicting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Predicting...
                      </>
                    ) : (
                      "🎯 Test Prediction"
                    )}
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
              spOptimize={
                hasCascadeResults
                  ? cascadePredictedTarget ?? targetSetpoint
                  : undefined
              }
              showOptimizationTarget={hasCascadeResults}
            />

            {/* Parameter Optimization Cards - Organized by Variable Type */}
            <div className="space-y-8">
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
                          <p className="text-sm text-slate-600">
                            {description}
                          </p>
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

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                            trend: parameter.trend,
                            color: parameter.color,
                            icon: parameter.icon,
                            varType: varType,
                          };

                          // Get distribution bounds and median for shading if available
                          const distributionData = (() => {
                            if (currentTargetResults) {
                              const mvDist =
                                cascadeOptStore.parameterDistributions
                                  .mv_distributions[parameter.id];
                              const cvDist =
                                cascadeOptStore.parameterDistributions
                                  .cv_distributions[parameter.id];
                              const dist = mvDist || cvDist;

                              if (dist && dist.percentiles) {
                                return {
                                  bounds: [
                                    dist.percentiles["5.0"] || dist.min_value,
                                    dist.percentiles["95.0"] || dist.max_value,
                                  ] as [number, number],
                                  median: dist.median,
                                  mean: dist.mean,
                                };
                              }
                            }
                            return undefined;
                          })();

                          return (
                            <ParameterCascadeOptimizationCard
                              key={parameter.id}
                              parameter={cascadeParameter}
                              bounds={bounds as [number, number]}
                              rangeValue={rangeValue as [number, number]}
                              isSimulationMode={false}
                              proposedSetpoint={
                                typeof proposedValue === "number"
                                  ? proposedValue
                                  : undefined
                              }
                              distributionBounds={distributionData?.bounds}
                              distributionMedian={distributionData?.median}
                              distributionMean={distributionData?.mean}
                              onRangeChange={(
                                id: string,
                                newRange: [number, number]
                              ) => {
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
