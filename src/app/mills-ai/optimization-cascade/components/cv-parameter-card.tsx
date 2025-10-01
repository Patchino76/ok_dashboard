"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useXgboostStore } from "../../stores/xgboost-store";
import type { CascadeParameter } from "../stores/cascade-optimization-store";

// Global prediction cache to store CV predictions
const predictionCache = new Map<
  string,
  { timestamp: number; value: number; parameterId: string }[]
>();

// Initialize global functions only on client side
if (typeof window !== "undefined") {
  // Global function to add predictions
  (window as any).addCVPrediction = (parameterId: string, value: number) => {
    const timestamp = Date.now();
    const existing = predictionCache.get(parameterId) || [];
    const updated = [...existing, { timestamp, value, parameterId }].slice(-50);
    predictionCache.set(parameterId, updated);

    // Trigger re-render by dispatching custom event
    window.dispatchEvent(
      new CustomEvent("cvPredictionUpdate", {
        detail: { parameterId, value, timestamp },
      })
    );
    console.log(
      `🔮 Added prediction for ${parameterId}:`,
      value,
      "Cache size:",
      updated.length
    );
  };

  // Test function to verify the approach works
  (window as any).testCVPredictions = () => {
    console.log("🧪 Testing CV predictions...");
    (window as any).addCVPrediction("PulpHC", 455.83);
    (window as any).addCVPrediction("DensityHC", 1724.88);
    (window as any).addCVPrediction("PressureHC", 0.295);
    console.log("✅ Test predictions sent. Check CV cards for purple lines!");
  };
}

interface CVParameterCardProps {
  parameter: CascadeParameter;
  bounds: [number, number];
  rangeValue: [number, number];
  proposedSetpoint?: number;
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

export function CVParameterCard({
  parameter,
  rangeValue,
  proposedSetpoint,
  distributionBounds,
  distributionMedian,
  distributionPercentiles,
  showDistributions,
}: CVParameterCardProps) {
  const displayHours = useXgboostStore((state) => state.displayHours);
  const [predictions, setPredictions] = useState<
    { timestamp: number; value: number }[]
  >([]);
  const [latestPrediction, setLatestPrediction] = useState<number | null>(null);

  // Listen for prediction updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePredictionUpdate = (event: CustomEvent) => {
      const { parameterId, value, timestamp } = event.detail;
      if (parameterId === parameter.id) {
        console.log(`🎯 CV ${parameter.id} received prediction update:`, value);
        setLatestPrediction(value);
        setPredictions((prev) => [...prev, { timestamp, value }].slice(-50));
      }
    };

    window.addEventListener(
      "cvPredictionUpdate",
      handlePredictionUpdate as EventListener
    );

    // Load existing predictions from cache
    const cached = predictionCache.get(parameter.id) || [];
    if (cached.length > 0) {
      setPredictions(cached);
      setLatestPrediction(cached[cached.length - 1].value);
      console.log(
        `📥 CV ${parameter.id} loaded ${cached.length} cached predictions`
      );
    }

    return () => {
      window.removeEventListener(
        "cvPredictionUpdate",
        handlePredictionUpdate as EventListener
      );
    };
  }, [parameter.id]);

  const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000;
  const filteredTrend = parameter.trend.filter(
    (item) => item.timestamp >= hoursAgo
  );
  // Use only current trend data for chart (prediction shown as reference line)
  const chartData = filteredTrend;

  const yAxisDomain = useMemo((): [number, number] => {
    // Smart adaptive Y-axis scaling for better trend visibility
    
    // Priority 1: Use actual trend data if available (this is what we want to see clearly)
    const trendValues = filteredTrend.map((d) => d.value);
    
    // Priority 2: Include important reference values
    const referenceValues = [
      typeof proposedSetpoint === "number" ? proposedSetpoint : undefined,
      latestPrediction !== null ? latestPrediction : undefined,
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
      const paddingPercent = dataRange < trendRange * 0.1 ? 0.02 : 
                             dataRange < trendRange * 0.5 ? 0.05 : 0.08;
      const padding = Math.max(dataRange * paddingPercent, trendRange * 0.02);
      
      // Ensure shading bounds are visible if they're close to the data
      const lowerBound = distributionPercentiles?.p5 ?? distributionBounds?.[0] ?? rangeValue[0];
      const upperBound = distributionPercentiles?.p95 ?? distributionBounds?.[1] ?? rangeValue[1];
      
      let finalMin = dataMin - padding;
      let finalMax = dataMax + padding;
      
      // Only extend domain to include bounds if they're reasonably close to the data
      if (lowerBound > finalMin && lowerBound < dataMin + dataRange * 0.3) {
        finalMin = Math.min(finalMin, lowerBound - padding * 0.5);
      }
      if (upperBound < finalMax && upperBound > dataMax - dataRange * 0.3) {
        finalMax = Math.max(finalMax, upperBound + padding * 0.5);
      }
      
      console.log(`📊 CV ${parameter.id} Smart Y-axis:`, {
        trendRange: trendRange.toFixed(3),
        dataRange: dataRange.toFixed(3),
        paddingPercent: (paddingPercent * 100).toFixed(1) + '%',
        domain: [finalMin.toFixed(3), finalMax.toFixed(3)]
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
    rangeValue,
    latestPrediction,
    distributionBounds,
    distributionMedian,
    distributionPercentiles,
    parameter.id,
  ]);

  const lowerBound =
    distributionPercentiles?.p5 ?? distributionBounds?.[0] ?? rangeValue[0];
  const upperBound =
    distributionPercentiles?.p95 ?? distributionBounds?.[1] ?? rangeValue[1];
  const medianValue =
    distributionPercentiles?.p50 ??
    distributionMedian ??
    (lowerBound + upperBound) / 2;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  const shadingData = chartData.map((point) => ({
    ...point,
    hiValue: upperBound,
    loValue: lowerBound,
  }));

  const composedChartData = shadingData.length
    ? shadingData
    : [
        {
          timestamp: Date.now(),
          value: parameter.value,
          hiValue: upperBound,
          loValue: lowerBound,
        },
      ];

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50/90 dark:from-slate-800 dark:to-blue-900/30 ring-2 ring-blue-200/80 dark:ring-blue-900/60 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span className="text-xl text-blue-600">{parameter.icon}</span>
              {parameter.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 border-blue-200"
              >
                CV
              </Badge>
              <span className="text-xs text-slate-500">Controlled</span>
            </div>
          </div>
          <span className="text-xs text-slate-500">
            Target range: {rangeValue[0].toFixed(1)} –{" "}
            {rangeValue[1].toFixed(1)} {parameter.unit}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Current Value (PV)
            </div>
            <div className="text-lg font-bold flex items-center gap-1 text-blue-600">
              {parameter.value.toFixed(2)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Predicted Value
            </div>
            <div className="text-lg font-bold flex items-center gap-1 text-purple-600">
              {latestPrediction !== null ? latestPrediction.toFixed(2) : "--"}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={composedChartData}
              margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
              key={`chart-${parameter.id}-${lowerBound}-${upperBound}`}
            >
              <defs>
                <linearGradient
                  id={`cv-shading-${parameter.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.05} />
                  <stop offset="50%" stopColor="#2563eb" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
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
                formatter={(value: number) => [
                  `${value >= 1 ? value.toFixed(2) : value.toPrecision(3)} ${
                    parameter.unit
                  }`,
                  parameter.name,
                ]}
                labelFormatter={formatTime}
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
              />
              <Area
                type="monotone"
                dataKey="hiValue"
                stroke="none"
                fill={`url(#cv-shading-${parameter.id})`}
                fillOpacity={showDistributions ? 1 : 0}
                baseValue={lowerBound}
                isAnimationActive={false}
              />
              <ReferenceLine
                y={lowerBound}
                stroke="#60a5fa"
                strokeWidth={1}
                strokeDasharray="6 4"
                strokeOpacity={showDistributions ? 1 : 0}
                ifOverflow="extendDomain"
              />
              <ReferenceLine
                y={medianValue}
                stroke="#3b82f6"
                strokeWidth={1}
                strokeDasharray="6 4"
                strokeOpacity={showDistributions ? 1 : 0}
                ifOverflow="extendDomain"
              />
              <ReferenceLine
                y={upperBound}
                stroke="#60a5fa"
                strokeWidth={1}
                strokeDasharray="6 4"
                strokeOpacity={showDistributions ? 1 : 0}
                ifOverflow="extendDomain"
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name="Current Value"
                connectNulls={false}
              />
              {/* Purple horizontal reference line for predicted value */}
              {latestPrediction !== null && (
                <ReferenceLine
                  y={latestPrediction}
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="6 4"
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
