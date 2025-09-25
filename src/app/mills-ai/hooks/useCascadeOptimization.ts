import { useState, useCallback } from "react";
import { toast } from "sonner";
import { mlApiClient } from "../utils/api-client";
import { useCascadeOptimizationStore } from "../optimization-cascade/stores/cascade-optimization-store";
import type {
  CascadeOptimizationConfig,
  CascadeOptimizationResult,
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

export interface UseCascadeOptimizationReturn {
  startCascadeOptimization: () => Promise<CascadeOptimizationResult | null>;
  getCascadeInfo: () => Promise<any>;
  trainCascadeModels: (request: CascadeTrainingRequest) => Promise<any>;
  getTrainingStatus: () => Promise<any>;
  isOptimizing: boolean;
  error: string | null;
  currentResults: CascadeOptimizationResult | null;
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
    getOptimizationConfig,
    startOptimization,
    stopOptimization,
    setResults,
    addToHistory,
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
    startCascadeOptimization,
    getCascadeInfo,
    trainCascadeModels,
    getTrainingStatus,
    isOptimizing,
    error,
    currentResults,
  };
}
