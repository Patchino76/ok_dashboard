"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { DoubleRangeSlider } from "../../components/double-range-slider";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";
import { useXgboostStore } from "../../stores/xgboost-store";
import type { CascadeParameter } from "../stores/cascade-optimization-store";

interface CommonParameterProps {
  parameter: CascadeParameter;
  bounds: [number, number];
  rangeValue: [number, number];
  proposedSetpoint?: number;
  onRangeChange: (id: string, range: [number, number]) => void;
  distributionBounds?: [number, number];
  distributionMedian?: number;
}

export function MVParameterCard({
  parameter,
  bounds,
  rangeValue,
  proposedSetpoint,
  onRangeChange,
  distributionBounds,
  distributionMedian,
}: CommonParameterProps) {
  const {
    updateSliderSP,
    getMVSliderValues,
    setSimulationTarget,
    updateCVPredictions,
  } = useCascadeOptimizationStore();
  const displayHours = useXgboostStore((state) => state.displayHours);

  const [range, setRange] = useState<[number, number]>(rangeValue);
  const [sliderValue, setSliderValue] = useState<number>(
    parameter.sliderSP || parameter.value
  );
  const [isPredicting, setIsPredicting] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRange(rangeValue);
  }, [rangeValue]);

  useEffect(() => {
    setSliderValue(parameter.sliderSP || parameter.value);
  }, [parameter.id, parameter.sliderSP]);

  useEffect(() => {
    setSliderValue((prev) => {
      const clamped = Math.min(Math.max(prev, range[0]), range[1]);
      return Number.isFinite(clamped) ? clamped : range[0];
    });
  }, [range]);

  const sliderStep = useMemo(() => {
    const delta = range[1] - range[0];
    if (!Number.isFinite(delta) || delta <= 0) {
      return 0.01;
    }
    return delta / 100;
  }, [range]);

  const handleRangeChange = (newRange: [number, number]) => {
    setRange(newRange);
    onRangeChange(parameter.id, newRange);
  };

  const callCascadePrediction = async (mvValues: Record<string, number>) => {
    try {
      setIsPredicting(true);
      console.log("🔮 Calling cascade prediction with MV values:", mvValues);

      // Get current mill number and DV values from cascade optimization store
      const { millNumber, dvValues } = useCascadeOptimizationStore.getState();

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

      // Prepare prediction request payload (API expects mv_values and dv_values only)
      const predictionRequest = {
        mv_values: mvValues,
        dv_values: dvValues, // Use current DV values from store
      };

      console.log("📡 Sending cascade prediction request:", predictionRequest);
      console.log(`🏭 Using Mill ${millNumber} models`);
      console.log("🔗 Full API URL:", "/api/v1/ml/cascade/predict");
      console.log("📋 Request headers:", {
        "Content-Type": "application/json",
      });
      console.log(
        "📦 Request body:",
        JSON.stringify(predictionRequest, null, 2)
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
          url: response.url,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
        });
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const predictionResult = await response.json();
      console.log("✅ Cascade prediction result:", predictionResult);

      // Update store with real prediction results
      setSimulationTarget(predictionResult.predicted_target);
      updateCVPredictions(predictionResult.predicted_cvs);

      return predictionResult;
    } catch (error) {
      console.error("❌ Cascade prediction failed:", error);
      setSimulationTarget(null);

      // Optional: Show user-friendly error message
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    updateSliderSP(parameter.id, value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const mvValues = getMVSliderValues();
      console.log("🎛️ MV Slider Values (triggering prediction):", mvValues);

      const requiredMVs = ["Ore", "WaterMill", "WaterZumpf", "MotorAmp"];
      const hasAllMVs = requiredMVs.every((mv) => mvValues[mv] !== undefined);

      if (hasAllMVs) {
        await callCascadePrediction(mvValues);
      } else {
        console.warn("⚠️ Missing some MV values, skipping prediction");
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  const formatValue = (value: number) => value.toFixed(1);

  const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000;
  const filteredTrend = parameter.trend.filter(
    (item) => item.timestamp >= hoursAgo
  );

  const yAxisDomain = useMemo((): [number, number] => {
    if (filteredTrend.length === 0) {
      const base =
        typeof proposedSetpoint === "number"
          ? proposedSetpoint
          : (range[0] + range[1]) / 2;
      return [Math.min(range[0], base), Math.max(range[1], base)];
    }

    const values = filteredTrend.map((d) => d.value);
    const extremes = [
      ...values,
      range[0],
      range[1],
      typeof proposedSetpoint === "number" ? proposedSetpoint : values[0],
    ];
    const min = Math.min(...extremes);
    const max = Math.max(...extremes);
    const pad = max - min || 1;
    return [min - pad * 0.05, max + pad * 0.05];
  }, [filteredTrend, proposedSetpoint, range]);

  const isInRange = parameter.value >= range[0] && parameter.value <= range[1];

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-amber-50/90 dark:from-slate-800 dark:to-amber-900/30 ring-2 ring-amber-200/80 dark:ring-amber-900/60 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span className="text-xl text-amber-600">{parameter.icon}</span>
              {parameter.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-200"
              >
                MV
              </Badge>
              <span className="text-xs text-slate-500">Manipulated</span>
            </div>
          </div>
          <Badge
            variant={isInRange ? "outline" : "secondary"}
            className={
              isInRange
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-red-100 text-red-800 border-red-200"
            }
          >
            {isInRange ? "In Range" : "Out of Range"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Current Value
            </div>
            <div className="text-2xl font-bold flex items-center gap-1">
              {parameter.value.toFixed(2)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
              Target (SP)
              {isPredicting && (
                <div className="animate-spin h-3 w-3 border border-slate-400 border-t-transparent rounded-full"></div>
              )}
            </div>
            <div
              className="text-2xl font-bold flex items-center gap-1"
              style={{ color: "#f97316" }}
            >
              {isPredicting
                ? "..."
                : typeof distributionMedian === "number"
                ? distributionMedian.toFixed(2)
                : typeof proposedSetpoint === "number"
                ? proposedSetpoint.toFixed(2)
                : "--"}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
        </div>

        <div className="flex h-32 -mx-2 sm:h-40">
          <div className="flex flex-col items-center justify-center w-12 px-1 gap-1">
            <div className="flex items-center h-full">
              <div className="h-32 flex items-center">
                <Slider
                  orientation="vertical"
                  min={range[0]}
                  max={range[1]}
                  step={sliderStep}
                  value={[sliderValue]}
                  onValueChange={([value]) => handleSliderChange(value)}
                  className="h-full"
                  trackClassName="bg-purple-100 dark:bg-purple-950/50"
                  rangeClassName="bg-purple-500 dark:bg-purple-400"
                  thumbClassName="border-purple-600 bg-white focus-visible:ring-purple-300 dark:border-purple-300 dark:bg-purple-900"
                />
                <div className="ml--3 w-10 text-sm text-center font-medium">
                  {sliderValue.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filteredTrend}
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
              >
                <XAxis dataKey="timestamp" hide={true} />
                <YAxis
                  domain={yAxisDomain}
                  hide={false}
                  width={40}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) =>
                    value >= 1 ? value.toFixed(0) : value.toFixed(2)
                  }
                  interval={0}
                  allowDataOverflow={false}
                  axisLine={true}
                  tickLine={true}
                  tickMargin={3}
                  orientation="left"
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatValue(value),
                    parameter.name,
                  ]}
                  labelFormatter={formatTime}
                  contentStyle={{
                    background: "#1f2937",
                    borderColor: "#374151",
                    color: "#e5e7eb",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#e5e7eb" }}
                />
                {distributionMedian !== undefined && (
                  <ReferenceLine
                    y={distributionMedian}
                    stroke="#d97706"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    ifOverflow="extendDomain"
                  />
                )}
                {typeof proposedSetpoint === "number" && (
                  <ReferenceLine
                    y={proposedSetpoint}
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    ifOverflow="extendDomain"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {distributionMedian === undefined && distributionBounds && (
                  <ReferenceArea
                    y1={distributionBounds[0]}
                    y2={distributionBounds[1]}
                    fill="#f59e0b"
                    fillOpacity={0.25}
                    ifOverflow="extendDomain"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pt-2">
          <DoubleRangeSlider
            min={bounds[0]}
            max={bounds[1]}
            value={range}
            onChange={handleRangeChange}
            step={(bounds[1] - bounds[0]) / 100}
            className="w-full"
          />
          {typeof proposedSetpoint === "number" && (
            <div className="mt-2 text-sm text-orange-400 font-extrabold flex items-center gap-2">
              <div className="w-4 h-2 bg-orange-400 rounded"></div>
              <span className="text-orange-400">
                Предложение: {proposedSetpoint.toFixed(2)} {parameter.unit}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
