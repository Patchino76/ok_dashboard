"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
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
  distributionPercentiles?: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  showDistributions: boolean;
}

export function MVParameterCard({
  parameter,
  bounds: _bounds,
  rangeValue,
  proposedSetpoint,
  onRangeChange: _onRangeChange,
  distributionBounds,
  distributionMedian,
  distributionPercentiles,
  showDistributions,
}: CommonParameterProps) {
  const {
    updateSliderSP,
    getMVSliderValues,
    setSimulationTarget,
    updateCVPredictions,
  } = useCascadeOptimizationStore();
  const displayHours = useXgboostStore((state) => state.displayHours);

  const [sliderValue, setSliderValue] = useState<number>(
    parameter.sliderSP || parameter.value
  );
  const [isPredicting, setIsPredicting] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debug: Log distribution data
  useEffect(() => {
    console.log(`🔍 MV ${parameter.id} DISTRIBUTION DEBUG:`, {
      hasBounds: !!distributionBounds,
      bounds: distributionBounds,
      hasPercentiles: !!distributionPercentiles,
      percentiles: distributionPercentiles,
      hasMedian: distributionMedian !== undefined,
      median: distributionMedian,
    });
  }, [
    distributionBounds,
    distributionPercentiles,
    distributionMedian,
    parameter.id,
  ]);

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
      console.log("✅ EVENT-BASED prediction completed (Purple SP):", predictionResult.predicted_target?.toFixed(2));

      // Debug: Check the structure of predicted_cvs
      console.log("🔍 Predicted CVs structure:", {
        predicted_cvs: predictionResult.predicted_cvs,
        keys: Object.keys(predictionResult.predicted_cvs || {}),
        values: Object.values(predictionResult.predicted_cvs || {}),
      });

      // Update store with real prediction results
      setSimulationTarget(predictionResult.predicted_target);

      // RADICALLY DIFFERENT APPROACH: Direct CV prediction updates
      if (predictionResult.predicted_cvs) {
        console.log("🚀 Using direct CV prediction approach");
        Object.entries(predictionResult.predicted_cvs).forEach(
          ([cvId, value]) => {
            console.log(`📡 Calling addCVPrediction for ${cvId}:`, value);
            (window as any).addCVPrediction(cvId, value as number);
          }
        );
      }

      // Keep the old approach as backup
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
      console.log("🎛️ EVENT-BASED prediction triggered (Purple SP) - MV Slider changed:", parameter.id, "→", value.toFixed(2));
      console.log("📊 All MV Slider Values:", mvValues);

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
    // Smart adaptive Y-axis scaling for better trend visibility

    // Priority 1: Use actual trend data if available (this is what we want to see clearly)
    const trendValues = filteredTrend.map((d) => d.value);

    // Priority 2: Include important reference values
    const referenceValues = [
      typeof proposedSetpoint === "number" ? proposedSetpoint : undefined,
      distributionMedian,
    ].filter((v): v is number => v !== undefined && Number.isFinite(v));

    // If we have trend data, focus on it for better zoom
    if (trendValues.length > 0) {
      const trendMin = Math.min(...trendValues);
      const trendMax = Math.max(...trendValues);
      const trendRange = trendMax - trendMin;

      // Include reference values in the domain calculation
      const allRelevantValues = [...trendValues, ...referenceValues];
      const dataMin = Math.min(...allRelevantValues);
      const dataMax = Math.max(...allRelevantValues);
      const dataRange = dataMax - dataMin;

      // Adaptive padding: smaller padding for tightly clustered data
      // Use 2% padding if data is very tight, up to 8% for wider ranges
      const paddingPercent =
        dataRange < trendRange * 0.1
          ? 0.02
          : dataRange < trendRange * 0.5
          ? 0.05
          : 0.08;
      const padding = Math.max(dataRange * paddingPercent, trendRange * 0.02);

      // Ensure shading bounds are visible if they're close to the data
      const lowerBound = distributionBounds?.[0] ?? rangeValue[0];
      const upperBound = distributionBounds?.[1] ?? rangeValue[1];

      let finalMin = dataMin - padding;
      let finalMax = dataMax + padding;

      // If distributions are shown, ALWAYS include shading bounds in domain to prevent overflow
      if (showDistributions && distributionBounds) {
        finalMin = Math.min(finalMin, lowerBound);
        finalMax = Math.max(finalMax, upperBound);
        // Add small padding beyond bounds to ensure they're fully visible
        const boundsPadding = (upperBound - lowerBound) * 0.02;
        finalMin -= boundsPadding;
        finalMax += boundsPadding;
      } else {
        // Only extend domain to include bounds if they're reasonably close to the data
        if (lowerBound > finalMin && lowerBound < dataMin + dataRange * 0.3) {
          finalMin = Math.min(finalMin, lowerBound - padding * 0.5);
        }
        if (upperBound < finalMax && upperBound > dataMax - dataRange * 0.3) {
          finalMax = Math.max(finalMax, upperBound + padding * 0.5);
        }
      }

      console.log(`📊 MV ${parameter.id} Smart Y-axis:`, {
        trendRange: trendRange.toFixed(3),
        dataRange: dataRange.toFixed(3),
        paddingPercent: (paddingPercent * 100).toFixed(1) + "%",
        domain: [finalMin.toFixed(3), finalMax.toFixed(3)],
        distributionBounds,
      });

      return [finalMin, finalMax];
    }

    // Fallback: No trend data, use bounds and references
    const fallbackValues = [
      ...referenceValues,
      rangeValue[0],
      rangeValue[1],
      distributionBounds?.[0],
      distributionBounds?.[1],
    ].filter((v): v is number => v !== undefined && Number.isFinite(v));

    if (fallbackValues.length === 0) {
      const mid = (rangeValue[0] + rangeValue[1]) / 2;
      return [mid - 1, mid + 1];
    }

    const min = Math.min(...fallbackValues);
    const max = Math.max(...fallbackValues);
    const pad = (max - min || 1) * 0.1;

    return [min - pad, max + pad];
  }, [
    filteredTrend,
    proposedSetpoint,
    distributionBounds,
    distributionMedian,
    parameter.id,
    showDistributions,
  ]);

  const [sliderDomainMin, sliderDomainMax] = yAxisDomain;

  useEffect(() => {
    const rawValue =
      typeof parameter.sliderSP === "number"
        ? parameter.sliderSP
        : parameter.value;
    if (!Number.isFinite(rawValue)) {
      return;
    }

    const clamped = Math.min(
      Math.max(rawValue, sliderDomainMin),
      sliderDomainMax
    );

    setSliderValue((prev) =>
      Number.isFinite(clamped) && clamped !== prev
        ? clamped
        : Number.isFinite(prev)
        ? prev
        : clamped
    );
  }, [
    parameter.id,
    parameter.sliderSP,
    parameter.value,
    sliderDomainMin,
    sliderDomainMax,
  ]);

  useEffect(() => {
    setSliderValue((prev) => {
      const clamped = Math.min(
        Math.max(prev, sliderDomainMin),
        sliderDomainMax
      );
      if (Number.isFinite(clamped)) {
        return clamped;
      }

      if (Number.isFinite(prev)) {
        return prev;
      }

      if (Number.isFinite(sliderDomainMin)) {
        return sliderDomainMin;
      }

      if (Number.isFinite(sliderDomainMax)) {
        return sliderDomainMax;
      }

      return 0;
    });
  }, [sliderDomainMin, sliderDomainMax]);

  const sliderStep = useMemo(() => {
    const delta = sliderDomainMax - sliderDomainMin;
    if (!Number.isFinite(delta) || delta <= 0) {
      return 0.01;
    }
    return delta / 100;
  }, [sliderDomainMin, sliderDomainMax]);

  const lowerBound =
    distributionBounds && distributionBounds[0] !== undefined
      ? distributionBounds[0]
      : sliderDomainMin;
  const upperBound =
    distributionBounds && distributionBounds[1] !== undefined
      ? distributionBounds[1]
      : sliderDomainMax;
  // Use actual distribution median (p50) - don't calculate fallback
  const medianValue = distributionMedian;

  // Debug logging for distribution values
  if (showDistributions && distributionMedian) {
    console.log(`📊 MV ${parameter.id} Distribution Values:`, {
      lowerBound: lowerBound.toFixed(2),
      medianValue: medianValue?.toFixed(2) ?? "N/A",
      upperBound: upperBound.toFixed(2),
      distributionBounds,
      rawMedian: distributionMedian,
      rangeValue,
    });
  }

  const shadingData = filteredTrend.map((point) => ({
    ...point,
    hiValue: upperBound,
    loValue: lowerBound,
    sliderValue: sliderValue, // Add slider value for tooltip binding
  }));

  const chartData = shadingData.length
    ? shadingData
    : [
        {
          timestamp: Date.now(),
          value: parameter.value,
          hiValue: upperBound,
          loValue: lowerBound,
          sliderValue: sliderValue, // Add slider value for tooltip binding
        },
      ];

  const isInRange =
    parameter.value >= sliderDomainMin && parameter.value <= sliderDomainMax;

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
            <div className="flex items-center h-full pt-1 pb-3">
              <Slider
                orientation="vertical"
                min={sliderDomainMin}
                max={sliderDomainMax}
                step={sliderStep}
                value={[sliderValue]}
                onValueChange={([value]) => handleSliderChange(value)}
                className="h-[85%]"
                trackClassName="bg-purple-100 dark:bg-purple-950/50"
                rangeClassName="bg-purple-500 dark:bg-purple-400"
                thumbClassName="border-purple-600 bg-white focus-visible:ring-purple-300 dark:border-purple-300 dark:bg-purple-900"
              />
              <div className="ml-2 text-sm text-center font-medium w-10">
                {sliderValue.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="flex-1 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
                key={`chart-${parameter.id}-${lowerBound}-${upperBound}`}
              >
                <defs>
                  <linearGradient
                    id={`mv-shading-${parameter.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#e2e8f0" stopOpacity={0.2} />
                    <stop offset="50%" stopColor="#cbd5f5" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  hide={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={formatTime}
                />
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
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    
                    // Find slider and PV values from payload
                    const sliderData = payload.find(p => typeof p.name === 'string' && p.name.includes('Slider'));
                    const pvData = payload.find(p => (typeof p.name !== 'string' || !p.name.includes('Slider')) && p.dataKey === 'value');
                    
                    return (
                      <div
                        style={{
                          background: 'rgba(31, 41, 55, 0.92)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          color: '#ffffff',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
                        }}
                      >
                        <div style={{ marginBottom: '4px', fontWeight: '600', color: '#ffffff' }}>
                          Час: {formatTime(label)}
                        </div>
                        {sliderData && (
                          <div style={{ color: '#c084fc', fontWeight: '600' }}>
                            SP: {formatValue(sliderData.value as number)} {parameter.unit}
                          </div>
                        )}
                        {pvData && (
                          <div style={{ color: '#fb923c', fontWeight: '600' }}>
                            PV: {formatValue(pvData.value as number)} {parameter.unit}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sliderValue"
                  stroke="none"
                  fill="transparent"
                  fillOpacity={0}
                  isAnimationActive={false}
                  name={`${parameter.name} (Slider)`}
                />
                {/* Shading area for distribution bounds - hidden from tooltip */}
                <Area
                  type="monotone"
                  dataKey="hiValue"
                  stroke="none"
                  fill={`url(#mv-shading-${parameter.id})`}
                  fillOpacity={showDistributions ? 1 : 0}
                  baseValue={lowerBound}
                  isAnimationActive={false}
                  activeDot={false}
                  name=""
                />
                <ReferenceLine
                  y={lowerBound}
                  stroke="#475569"
                  strokeWidth={0.75}
                  strokeDasharray="6 4"
                  strokeOpacity={showDistributions ? 1 : 0}
                  ifOverflow="extendDomain"
                />
                {typeof medianValue === "number" && (
                  <ReferenceLine
                    y={medianValue}
                    stroke="#1e293b"
                    strokeWidth={1}
                    strokeDasharray="6 4"
                    strokeOpacity={showDistributions ? 1 : 0}
                    ifOverflow="extendDomain"
                  />
                )}
                <ReferenceLine
                  y={upperBound}
                  stroke="#475569"
                  strokeWidth={0.75}
                  strokeDasharray="6 4"
                  strokeOpacity={showDistributions ? 1 : 0}
                  ifOverflow="extendDomain"
                />
                <ReferenceLine
                  y={sliderValue}
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: "Slider",
                    position: "right",
                    fill: "#a855f7",
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  name={parameter.name}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {typeof proposedSetpoint === "number" && (
          <div className="pt-2 text-sm text-orange-400 font-extrabold flex items-center gap-2">
            <div className="w-4 h-2 bg-orange-400 rounded"></div>
            <span className="text-orange-400">
              Предложение: {proposedSetpoint.toFixed(2)} {parameter.unit}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
