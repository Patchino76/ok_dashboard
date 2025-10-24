"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import type { CascadeParameter } from "../stores/cascade-optimization-store";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";
import { millsParameters } from "../../data/mills-parameters";
import {
  cascadeBG,
  getParameterNameBG,
  getParameterDescriptionBG,
} from "../translations/bg";

interface DVParameterCardProps {
  parameter: CascadeParameter;
  bounds: [number, number]; // Initial bounds for slider min/max
  dvFeatures?: string[]; // Dynamic DV features from model metadata
}

export function DVParameterCard({
  parameter,
  bounds,
  dvFeatures,
}: DVParameterCardProps) {
  const {
    updateDVValue,
    updateSliderSP,
    getMVSliderValues,
    getDVSliderValues,
    setSimulationTarget,
    updateCVPredictions,
  } = useCascadeOptimizationStore();
  const [sliderValue, setSliderValue] = useState<number>(parameter.value);
  const [isPredicting, setIsPredicting] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const callCascadePrediction = async (
    mvValues: Record<string, number>,
    dvValues: Record<string, number>
  ) => {
    try {
      setIsPredicting(true);
      console.log("🔮 Calling cascade prediction with DV change:", dvValues);

      // Get current mill number from cascade optimization store
      const { millNumber } = useCascadeOptimizationStore.getState();

      // First, ensure the mill model is loaded
      console.log(`📥 Loading cascade models for Mill ${millNumber}...`);
      const loadResponse = await fetch(
        `/api/v1/ml/cascade/models/${millNumber}/load`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!loadResponse.ok) {
        console.warn(
          `⚠️ Failed to load Mill ${millNumber} models: ${loadResponse.status}`
        );
        // Continue anyway - models might already be loaded
      } else {
        const loadResult = await loadResponse.json();
        console.log("✅ Mill models loaded:", loadResult.message);
      }

      // Prepare prediction request payload
      const predictionRequest = {
        mv_values: mvValues,
        dv_values: dvValues,
      };

      console.log(
        "📡 Sending cascade prediction request (DV changed):",
        predictionRequest
      );

      // Call real cascade prediction API
      const response = await fetch("/api/v1/ml/cascade/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(predictionRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🚨 API Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const predictionResult = await response.json();
      console.log(
        "✅ DV-triggered prediction completed (Purple SP):",
        predictionResult.predicted_target?.toFixed(2)
      );

      // Update store with real prediction results
      setSimulationTarget(predictionResult.predicted_target);

      // Update CV predictions
      if (predictionResult.predicted_cvs) {
        console.log("🚀 Updating CV predictions from DV change");
        Object.entries(predictionResult.predicted_cvs).forEach(
          ([cvId, value]) => {
            console.log(`📡 Calling addCVPrediction for ${cvId}:`, value);
            (window as any).addCVPrediction(cvId, value as number);
          }
        );
      }

      updateCVPredictions(predictionResult.predicted_cvs);

      return predictionResult;
    } catch (error) {
      console.error("❌ Cascade prediction failed (DV change):", error);
      setSimulationTarget(null);

      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    updateSliderSP(parameter.id, value); // Update parameter's sliderSP
    updateDVValue(parameter.id, value); // Update store's dvValues object

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounced prediction trigger (500ms delay)
    debounceTimerRef.current = setTimeout(async () => {
      const mvValues = getMVSliderValues();
      const dvValues = getDVSliderValues(dvFeatures); // Get current DV slider values filtered by model's DV features

      console.log("🧪 DV Slider changed:", parameter.id, "→", value.toFixed(2));
      console.log("📊 Current MV values:", mvValues);
      console.log(
        "📊 Current DV values (filtered by model features):",
        dvValues
      );
      console.log("📊 Model DV features:", dvFeatures);

      // Check if we have all required MV values
      const requiredMVs = ["Ore", "WaterMill", "WaterZumpf"];
      const hasAllMVs = requiredMVs.every((mv) => mvValues[mv] !== undefined);

      if (hasAllMVs) {
        await callCascadePrediction(mvValues, dvValues);
      } else {
        const missingMVs = requiredMVs.filter(
          (mv) => mvValues[mv] === undefined
        );
        console.warn(
          "⚠️ Missing MV values:",
          missingMVs,
          "- skipping prediction"
        );
      }
    }, 500);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const [minBound, maxBound] = bounds;
  const sliderStep = (maxBound - minBound) / 100;

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-emerald-50/90 dark:from-slate-800 dark:to-emerald-900/30 ring-2 ring-emerald-200/80 dark:ring-emerald-900/60 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span className="text-xl text-emerald-600">{parameter.icon}</span>
              {getParameterNameBG(parameter.id, millsParameters)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-200"
              >
                {cascadeBG.parameters.disturbanceShort}
              </Badge>
              <span className="text-xs text-slate-500">
                {cascadeBG.parameters.disturbance}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Current Value Display */}
          <div className="flex-1 space-y-2">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {cascadeBG.card.currentValue}
            </div>
            <div className="text-2xl font-bold flex items-center gap-1 text-emerald-600">
              {sliderValue.toFixed(2)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
              {isPredicting && (
                <span className="ml-2 text-sm text-emerald-500 animate-spin">
                  ⏳
                </span>
              )}
            </div>
          </div>

          {/* Vertical Slider */}
          <div className="h-32 flex flex-col items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              {maxBound.toFixed(1)}
            </div>
            <div className="h-full flex items-center px-2">
              <Slider
                orientation="vertical"
                min={minBound}
                max={maxBound}
                step={sliderStep}
                value={[sliderValue]}
                onValueChange={([value]) => handleSliderChange(value)}
                className="h-[85%]"
                trackClassName="bg-emerald-100 dark:bg-emerald-950/50"
                rangeClassName="bg-emerald-500 dark:bg-emerald-400"
                thumbClassName="border-emerald-600 bg-white focus-visible:ring-emerald-300 dark:border-emerald-300 dark:bg-emerald-900"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {minBound.toFixed(1)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
