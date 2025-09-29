import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CascadePrediction } from "../stores/cascade-simulation-store";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";

interface PredictionRequest {
  mv_values: Record<string, number>
  dv_values: Record<string, number>
}

interface PredictionResponse {
  predicted_target: number
  predicted_cvs: Record<string, number>
  is_feasible: boolean
  constraint_violations?: string[]
  mill_number: number
}

export function useCascadePrediction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSimulationTarget = useCascadeOptimizationStore(
    (state) => state.setSimulationTarget
  );

  const predictCascade = useCallback(async (
    mvValues: Record<string, number>,
    dvValues: Record<string, number>
  ): Promise<CascadePrediction | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const requestBody: PredictionRequest = {
        mv_values: mvValues,
        dv_values: dvValues,
      };

      console.log("🔍 Making cascade prediction request:", requestBody);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/v1/ml/cascade/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data: PredictionResponse = await response.json();
      console.log("✅ Cascade prediction successful:", data);

      const prediction: CascadePrediction = {
        predicted_target: data.predicted_target,
        predicted_cvs: data.predicted_cvs,
        is_feasible: data.is_feasible,
        constraint_violations: data.constraint_violations || [],
        timestamp: Date.now(),
      };

      setSimulationTarget(prediction.predicted_target);

      return prediction;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("❌ Cascade prediction failed:", errorMessage);
      setError(errorMessage);
      setSimulationTarget(null);

      // Only show toast for non-network errors to avoid spam
      if (!errorMessage.includes("fetch")) {
        toast.error(`Prediction failed: ${errorMessage}`);
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [setSimulationTarget]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    predictCascade,
    isLoading,
    error,
    clearError,
  };
}
