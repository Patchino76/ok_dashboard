"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CascadeParameter } from "../stores/cascade-optimization-store";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";
import { useXgboostStore } from "../../stores/xgboost-store";
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
  // Check if this DV parameter has trend data available
  const paramConfig = millsParameters.find((p) => p.id === parameter.id);
  const hasTrend = paramConfig?.hasTrend || false;

  // For hasTrend=true: use PV value (read-only), for hasTrend=false: use slider value
  const [sliderValue, setSliderValue] = useState<number>(parameter.value);

  // Sync slider value with parameter.value when hasTrend is true (PV updates)
  useEffect(() => {
    if (hasTrend) {
      setSliderValue(parameter.value);
    }
  }, [parameter.value, hasTrend]);
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

  // Get display hours from XGBoost store for trend filtering
  const displayHours = useXgboostStore((state) => state.displayHours);

  // Filter trend data based on display hours
  const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000;
  const filteredTrend = parameter.trend.filter(
    (item) => item.timestamp >= hoursAgo
  );

  // Calculate Y-axis domain for trend chart
  const yAxisDomain = useMemo((): [number, number] => {
    if (filteredTrend.length === 0) {
      return [minBound, maxBound];
    }

    const trendValues = filteredTrend.map((d) => d.value);
    const trendMin = Math.min(...trendValues);
    const trendMax = Math.max(...trendValues);
    const trendRange = trendMax - trendMin;

    // Add 5% padding
    const padding = Math.max(trendRange * 0.05, (maxBound - minBound) * 0.02);
    return [trendMin - padding, trendMax + padding];
  }, [filteredTrend, minBound, maxBound]);

  // Format timestamp for chart
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-emerald-50/90 dark:from-slate-800 dark:to-emerald-900/30 ring-2 ring-emerald-200/80 dark:ring-emerald-900/60 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle
              className="text-base font-medium flex items-center gap-2 cursor-help"
              title={
                getParameterDescriptionBG(parameter.id, millsParameters) ||
                `Смущаваща променлива: ${parameter.id}`
              }
            >
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
                DV • {hasTrend ? "Реално време" : "Ръчно"}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasTrend ? (
          // DV with trend data - show chart like MV cards
          <div className="space-y-3">
            {/* Current Value Display */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {cascadeBG.card.currentValue} (PV)
                </div>
                <div className="text-2xl font-bold flex items-center gap-1 text-emerald-600">
                  {parameter.value.toFixed(2)}
                  <span className="text-xs text-slate-500">
                    {parameter.unit}
                  </span>
                  {isPredicting && (
                    <span className="ml-2 text-sm text-emerald-500 animate-spin">
                      ⏳
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                🔒 Само четене
              </div>
            </div>

            {/* Trend Chart */}
            {filteredTrend.length > 0 ? (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredTrend}>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      domain={yAxisDomain}
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(31, 41, 55, 0.95)",
                        border: "1px solid rgba(55, 65, 81, 0.8)",
                        borderRadius: "6px",
                        backdropFilter: "blur(8px)",
                      }}
                      labelFormatter={(label) =>
                        `Час: ${formatTime(label as number)}`
                      }
                      formatter={(value: number) => [
                        `${value.toFixed(2)} ${parameter.unit}`,
                        "PV",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-slate-400">
                📊 Зареждане на данни...
              </div>
            )}

            {/* Info message - slider disabled for real-time DVs */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
              <span>📡</span>
              <span>
                Стойността се актуализира автоматично от реално време данни
              </span>
            </div>
          </div>
        ) : (
          // DV without trend data - show simple vertical slider
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
              <div className="text-xs text-slate-400 italic">
                🧪 Ръчно въведена стойност
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
        )}
      </CardContent>
    </Card>
  );
}
