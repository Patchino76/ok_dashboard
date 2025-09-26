import { useState, useCallback } from "react";
import { toast } from "sonner";
import { mlApiClient } from "../utils/api-client";
import { useCascadeOptimizationStore } from "../optimization-cascade/stores/cascade-optimization-store";
import type {
  CascadeOptimizationConfig,
  CascadeOptimizationResult,
  TargetDrivenOptimizationConfig,
  TargetDrivenOptimizationResult,
  ParameterDistribution,
} from "../optimization-cascade/stores/cascade-optimization-store";

// API request/response interfaces
export interface CascadeOptimizationRequest {
  mill_number: number;
  mv_bounds: Record<string, [number, number]>;
  cv_bounds: Record<string, [number, number]>;
  dv_values: Record<string, number>;
  target_variable: string;
  target_setpoint?: number;
  maximize?: boolean;
  n_trials?: number;
  timeout_seconds?: number;
}

// Target-driven optimization API interfaces
export interface TargetDrivenOptimizationRequest {
  mill_number: number;
  target_value: number;
  target_variable: string;
  tolerance: number;
  mv_bounds: Record<string, [number, number]>;
  cv_bounds: Record<string, [number, number]>;
  dv_values: Record<string, number>;
  n_trials: number;
  confidence_level: number;
}

export interface CascadeOptimizationApiResponse {
  optimization_id?: string;
  best_mv_values?: Record<string, number>;
  best_cv_values?: Record<string, number>;
  best_target_value?: number;
  predicted_cvs?: Record<string, number>;
  predicted_target?: number;
  is_feasible?: boolean;
  constraint_violations?: string[];
  optimization_history?: Array<{
    trial: number;
    mv_values: Record<string, number>;
    predicted_target: number;
    is_feasible: boolean;
  }>;
  convergence_data?: Array<{
    trial: number;
    best_target: number;
  }>;
  duration_seconds?: number;
  status?: string;
}

// Target-driven optimization API response
export interface TargetDrivenOptimizationApiResponse {
  status: string;
  target_achieved: boolean;
  best_distance: number;
  target_value: number;
  tolerance: number;
  best_mv_values: Record<string, number>;
  best_cv_values: Record<string, number>;
  best_target_value: number;
  mv_distributions: Record<string, ParameterDistribution>;
  cv_distributions: Record<string, ParameterDistribution>;
  successful_trials: number;
  total_trials: number;
  success_rate: number;
  confidence_level: number;
  optimization_time: number;
  mill_number: number;
  optimization_config: {
    target_variable: string;
    target_value: number;
    tolerance: number;
    n_trials: number;
    confidence_level: number;
  };
}

export interface UseCascadeOptimizationReturn {
  // Regular optimization
  startCascadeOptimization: () => Promise<CascadeOptimizationResult | null>;
  
  // Target-driven optimization
  startTargetDrivenOptimization: () => Promise<TargetDrivenOptimizationResult | null>;
  
  // Common functions
  getCascadeInfo: () => Promise<any>;
  trainCascadeModels: (request: CascadeTrainingRequest) => Promise<any>;
  getTrainingStatus: () => Promise<any>;
  
  // State
  isOptimizing: boolean;
  error: string | null;
  currentResults: CascadeOptimizationResult | null;
  currentTargetResults: TargetDrivenOptimizationResult | null;
  
  // Utility functions
  getParameterBoundsFromDistributions: (confidenceLevel?: number) => {
    mv_bounds: Record<string, [number, number]>;
    cv_bounds: Record<string, [number, number]>;
  };
}

export interface CascadeTrainingRequest {
  mill_number: number;
  start_date: string;
  end_date: string;
  test_size?: number;
  resample_freq?: string;
}

export function useCascadeOptimization(): UseCascadeOptimizationReturn {
  const [error, setError] = useState<string | null>(null);

  // Use the cascade optimization store
  const {
    isOptimizing,
    currentResults,
    currentTargetResults,
    getOptimizationConfig,
    getTargetOptimizationConfig,
    startOptimization,
    startTargetOptimization,
    stopOptimization,
    setResults,
    addToHistory,
    setTargetResults,
    addToTargetHistory,
    getParameterBoundsFromDistributions,
  } = useCascadeOptimizationStore();

  const startCascadeOptimization =
    useCallback(async (): Promise<CascadeOptimizationResult | null> => {
      try {
        setError(null);

        // Get configuration from store
        const config = getOptimizationConfig();
        console.log("Starting cascade optimization with config:", config);

        // Start optimization in store
        startOptimization(config);

        // Prepare API request
        const request: CascadeOptimizationRequest = {
          mill_number: config.mill_number,
          mv_bounds: config.mv_bounds,
          cv_bounds: config.cv_bounds,
          dv_values: config.dv_values,
          target_variable: config.target_variable,
          target_setpoint: config.target_setpoint,
          maximize: config.maximize,
          n_trials: config.n_trials,
          timeout_seconds: config.timeout_seconds,
        };

        // Call the cascade optimization API
        const response = await mlApiClient.post<CascadeOptimizationApiResponse>(
          "/cascade/optimize",
          request
        );

        if (!response.data) {
          throw new Error("No data received from cascade optimization API");
        }

        // Create cascade optimization result object
        const cascadeResult: CascadeOptimizationResult = {
          id:
            response.data.optimization_id ||
            `cascade_opt_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`,
          timestamp: Date.now(),
          config,
          best_mv_values: response.data.best_mv_values || {},
          predicted_cvs:
            response.data.predicted_cvs || response.data.best_cv_values || {},
          predicted_target:
            response.data.predicted_target ??
            response.data.best_target_value ??
            0,
          is_feasible: response.data.is_feasible ?? false,
          constraint_violations: response.data.constraint_violations || [],
          optimization_history: response.data.optimization_history || [],
          convergence_data: response.data.convergence_data || [],
          duration_seconds: response.data.duration_seconds || 0,
          status:
            response.data.status === "success" ? "completed" : 
            (response.data.status as CascadeOptimizationResult["status"]) ||
            "completed",
        };

        // Update store with results
        setResults(cascadeResult);
        addToHistory(cascadeResult);

        console.log(
          "Cascade optimization completed successfully:",
          cascadeResult
        );
        return cascadeResult;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown cascade optimization error";
        console.error("Cascade optimization failed:", err);

        setError(errorMessage);

        // Create failed result
        const failedResult: CascadeOptimizationResult = {
          id: `cascade_opt_failed_${Date.now()}`,
          timestamp: Date.now(),
          config: getOptimizationConfig(),
          best_mv_values: {},
          predicted_cvs: {},
          predicted_target: 0,
          is_feasible: false,
          constraint_violations: [],
          optimization_history: [],
          convergence_data: [],
          duration_seconds: 0,
          status: "failed",
          error_message: errorMessage,
        };

        setResults(failedResult);
        return null;
      }
    }, [getOptimizationConfig, startOptimization, setResults, addToHistory]);

  const startTargetDrivenOptimization =
    useCallback(async (): Promise<TargetDrivenOptimizationResult | null> => {
      try {
        setError(null);

        // Get target optimization configuration from store
        const config = getTargetOptimizationConfig();
        console.log("🎯 Starting target-driven optimization with config:", config);
        console.log("🎯 Target value from config:", config.target_value);

        // Start target optimization in store
        startTargetOptimization(config);

        // Prepare API request
        const request: TargetDrivenOptimizationRequest = {
          mill_number: config.mill_number,
          target_value: config.target_value,
          target_variable: config.target_variable,
          tolerance: config.tolerance,
          mv_bounds: config.mv_bounds,
          cv_bounds: config.cv_bounds,
          dv_values: config.dv_values,
          n_trials: config.n_trials,
          confidence_level: config.confidence_level,
        };

        console.log("🎯 Sending target-driven optimization request to API:", request);
        console.log("🎯 API request target_value:", request.target_value);

        // Call the target-driven optimization API
        const response = await mlApiClient.post<TargetDrivenOptimizationApiResponse>(
          "/cascade/optimize-target",
          request
        );

        if (!response.data) {
          throw new Error("No data received from target-driven optimization API");
        }

        // Create target optimization result object
        const targetResult: TargetDrivenOptimizationResult = {
          id: `target_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          config,
          target_achieved: response.data.target_achieved,
          best_distance: response.data.best_distance,
          target_value: response.data.target_value,
          tolerance: response.data.tolerance,
          best_mv_values: response.data.best_mv_values,
          best_cv_values: response.data.best_cv_values,
          best_target_value: response.data.best_target_value,
          mv_distributions: response.data.mv_distributions,
          cv_distributions: response.data.cv_distributions,
          successful_trials: response.data.successful_trials,
          total_trials: response.data.total_trials,
          success_rate: response.data.success_rate,
          confidence_level: response.data.confidence_level,
          optimization_time: response.data.optimization_time,
          status: response.data.status === "success" ? "completed" : "failed",
        };

        // Update store with results
        setTargetResults(targetResult);
        addToTargetHistory(targetResult);

        console.log(
          "Target-driven optimization completed successfully:",
          targetResult
        );
        
        toast.success(
          `Target optimization completed! ${targetResult.successful_trials}/${targetResult.total_trials} trials successful (${(targetResult.success_rate * 100).toFixed(1)}%)`
        );
        
        return targetResult;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown target-driven optimization error";
        console.error("Target-driven optimization failed:", err);

        setError(errorMessage);
        toast.error(`Target optimization failed: ${errorMessage}`);

        // Create failed result
        const failedResult: TargetDrivenOptimizationResult = {
          id: `target_opt_failed_${Date.now()}`,
          timestamp: Date.now(),
          config: getTargetOptimizationConfig(),
          target_achieved: false,
          best_distance: Infinity,
          target_value: 0,
          tolerance: 0,
          best_mv_values: {},
          best_cv_values: {},
          best_target_value: 0,
          mv_distributions: {},
          cv_distributions: {},
          successful_trials: 0,
          total_trials: 0,
          success_rate: 0,
          confidence_level: 0.90,
          optimization_time: 0,
          status: "failed",
          error_message: errorMessage,
        };

        setTargetResults(failedResult);
        return null;
      }
    }, [getTargetOptimizationConfig, startTargetOptimization, setTargetResults, addToTargetHistory]);

  const getCascadeInfo = useCallback(async () => {
    try {
      const response = await mlApiClient.get("/cascade/info");
      return response.data;
    } catch (err) {
      console.error("Failed to get cascade info:", err);
      throw err;
    }
  }, []);

  const trainCascadeModels = useCallback(
    async (request: CascadeTrainingRequest) => {
      try {
        const response = await mlApiClient.post("/cascade/train", request);
        return response.data;
      } catch (err) {
        console.error("Failed to start cascade training:", err);
        throw err;
      }
    },
    []
  );

  const getTrainingStatus = useCallback(async () => {
    try {
      const response = await mlApiClient.get("/cascade/training/status");
      return response.data;
    } catch (err) {
      console.error("Failed to get training status:", err);
      throw err;
    }
  }, []);

  return {
    // Regular optimization
    startCascadeOptimization,
    
    // Target-driven optimization
    startTargetDrivenOptimization,
    
    // Common functions
    getCascadeInfo,
    trainCascadeModels,
    getTrainingStatus,
    
    // State
    isOptimizing,
    error,
    currentResults,
    currentTargetResults,
    
    // Utility functions
    getParameterBoundsFromDistributions,
  };
}
