"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { useXgboostStore } from "../../stores/xgboost-store";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";
import { DoubleRangeSlider } from "../../components/double-range-slider";

import { CascadeParameter } from ".";

interface ParameterCascadeOptimizationCardProps {
  parameter: CascadeParameter;
  bounds: [number, number];
  rangeValue: [number, number];
  isSimulationMode?: boolean;
  proposedSetpoint?: number;
  distributionBounds?: [number, number]; // Distribution bounds for shading
  distributionMedian?: number; // Median value from target-driven optimization
  onRangeChange: (id: string, range: [number, number]) => void;
}

export default function ParameterCascadeOptimizationCard({
  parameter,
  bounds,
  rangeValue,
  isSimulationMode = false,
  proposedSetpoint,
  onRangeChange,
  distributionBounds,
  distributionMedian,
}: ParameterCascadeOptimizationCardProps) {
  // Store hooks
  const { updateSliderSP, getMVSliderValues, setSimulationTarget } =
    useCascadeOptimizationStore();
  const displayHours = useXgboostStore((state) => state.displayHours);

  // Local state for range values
  const [range, setRange] = useState<[number, number]>(rangeValue);
  const [sliderValue, setSliderValue] = useState<number>(
    parameter.sliderSP || parameter.value
  );
  const [isPredicting, setIsPredicting] = useState(false);

  // Check if this is a lab parameter (DV = Disturbance Variable)
  const isLabParameter = parameter.varType === "DV";

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update local state when prop changes
  useEffect(() => {
    setRange(rangeValue);
  }, [rangeValue]);

  // Reset slider when parameter changes - use sliderSP if available
  useEffect(() => {
    setSliderValue(parameter.sliderSP || parameter.value);
  }, [parameter.id, parameter.sliderSP]);

  // Prevent slider from drifting outside updated range
  useEffect(() => {
    setSliderValue((prev) => {
      const clamped = Math.min(Math.max(prev, range[0]), range[1]);
      return Number.isFinite(clamped) ? clamped : range[0];
    });
  }, [range]);

  // Memoized step for slider to avoid division by zero
  const sliderStep = useMemo(() => {
    const delta = range[1] - range[0];
    if (!Number.isFinite(delta) || delta <= 0) {
      return 0.01;
    }
    return delta / 100;
  }, [range]);

  const isInRange = parameter.value >= range[0] && parameter.value <= range[1];

  // Handle range change from DoubleRangeSlider
  const handleRangeChange = (newRange: [number, number]) => {
    // Always reflect local UI state
    setRange(newRange);
    // Always propagate to parent so bounds stay in sync with sliders
    onRangeChange(parameter.id, newRange);
  };

  // Cascade prediction function
  const callCascadePrediction = async (mvValues: Record<string, number>) => {
    try {
      setIsPredicting(true);
      console.log("🔮 Calling cascade prediction with MV values:", mvValues);

      // TODO: Replace with actual cascade prediction API call
      // For now, simulate prediction with a mock response
      const mockPrediction = {
        predicted_target: 23.5 + Math.random() * 3, // Simulate PSI200 prediction
        predicted_cvs: {
          PressureHC: 450 + Math.random() * 50,
          DensityHC: 1.2 + Math.random() * 0.3,
          PulpHC: 500 + Math.random() * 100,
        },
      };

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      console.log("✅ Cascade prediction result:", mockPrediction);
      setSimulationTarget(mockPrediction.predicted_target);

      return mockPrediction;
    } catch (error) {
      console.error("❌ Cascade prediction failed:", error);
      setSimulationTarget(null);
    } finally {
      setIsPredicting(false);
    }
  };

  // Handle slider SP change with debounced prediction
  const handleSliderChange = (value: number) => {
    // Update local state immediately for smooth UI
    setSliderValue(value);

    // Update the store with the new slider SP value
    updateSliderSP(parameter.id, value);

    // If this is an MV parameter, trigger debounced prediction
    if (parameter.varType === "MV") {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer for debounced prediction
      debounceTimerRef.current = setTimeout(async () => {
        const mvValues = getMVSliderValues();
        console.log("🎛️ MV Slider Values (triggering prediction):", mvValues);

        // Only call prediction if we have all required MV values
        const requiredMVs = ["Ore", "WaterMill", "WaterZumpf", "MotorAmp"];
        const hasAllMVs = requiredMVs.every((mv) => mvValues[mv] !== undefined);

        if (hasAllMVs) {
          await callCascadePrediction(mvValues);
        } else {
          console.warn("⚠️ Missing some MV values, skipping prediction");
        }
      }, 500); // 500ms debounce delay
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Format time for tooltip
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    const formattedTime = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    return `${formattedDate} ${formattedTime}`;
  };

  // Format value for tooltip
  const formatValue = (value: number) => {
    return value.toFixed(1);
  };

  // Simple domain calculation - let Recharts handle most of the work
  const calculateYAxisDomain = (
    trend: Array<{ timestamp: number; value: number }>
  ) => {
    if (trend.length === 0) return ["dataMin - 5", "dataMax + 5"];

    // Use Recharts' auto-scaling with padding
    return ["dataMin - 5%", "dataMax + 5%"];
  };

  // Determine color classes based on parameter.color
  const getBgColorClass = () => {
    switch (parameter.color) {
      case "blue":
        return "bg-blue-50 dark:bg-blue-900/20";
      case "green":
        return "bg-green-50 dark:bg-green-900/20";
      case "red":
        return "bg-red-50 dark:bg-red-900/20";
      case "amber":
        return "bg-amber-50 dark:bg-amber-900/20";
      case "yellow":
        return "bg-yellow-50 dark:bg-yellow-900/20";
      case "purple":
        return "bg-purple-50 dark:bg-purple-900/20";
      case "cyan":
        return "bg-cyan-50 dark:bg-cyan-900/20";
      case "orange":
        return "bg-orange-50 dark:bg-orange-900/20";
      default:
        return "bg-slate-50 dark:bg-slate-800/30";
    }
  };

  const getTextColorClass = () => {
    switch (parameter.color) {
      case "blue":
        return "text-blue-600";
      case "green":
        return "text-green-600";
      case "red":
        return "text-red-600";
      case "amber":
        return "text-amber-600";
      case "yellow":
        return "text-yellow-600";
      case "purple":
        return "text-purple-600";
      case "cyan":
        return "text-cyan-600";
      case "orange":
        return "text-orange-600";
      default:
        return "text-slate-600";
    }
  };

  // Get stroke color for trend line based on parameter.color
  const getStrokeColor = () => {
    switch (parameter.color) {
      case "blue":
        return "#2563eb"; // blue-600
      case "green":
        return "#16a34a"; // green-600
      case "red":
        return "#dc2626"; // red-600
      case "amber":
        return "#d97706"; // amber-600
      case "yellow":
        return "#ca8a04"; // yellow-600
      case "purple":
        return "#9333ea"; // purple-600
      case "cyan":
        return "#0891b2"; // cyan-600
      case "orange":
        return "#ea580c"; // orange-600
      default:
        return "#475569"; // slate-600
    }
  };

  // Enhanced background styles based on varType for better cascade visualization
  const getVarTypeStyles = () => {
    if (parameter.varType === "MV") {
      return {
        cardBg:
          "bg-gradient-to-br from-white to-amber-50/90 dark:from-slate-800 dark:to-amber-900/30",
        topBar: "from-amber-500 to-orange-500",
        ring: "ring-2 ring-amber-200/80 dark:ring-amber-900/60",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        iconColor: "text-amber-600",
        accentColor: "#f97316", // orange-500
        sliderAccent: "accent-orange-500",
        sliderLabel: "text-amber-700",
        sliderThumbColor: "#f97316",
      } as const;
    }

    if (parameter.varType === "CV") {
      return {
        cardBg:
          "bg-gradient-to-br from-white to-blue-50/90 dark:from-slate-800 dark:to-blue-900/30",
        topBar: "from-blue-500 to-cyan-500",
        ring: "ring-2 ring-blue-200/80 dark:ring-blue-900/60",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
        iconColor: "text-blue-600",
        accentColor: "#3b82f6", // blue-500
        sliderAccent: "accent-blue-500",
        sliderLabel: "text-blue-700",
        sliderThumbColor: "#3b82f6",
      } as const;
    }

    return {
      cardBg:
        "bg-gradient-to-br from-white to-emerald-50/90 dark:from-slate-800 dark:to-emerald-900/30",
      topBar: "from-emerald-500 to-green-500",
      ring: "ring-2 ring-emerald-200/80 dark:ring-emerald-900/60",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      iconColor: "text-emerald-600",
      accentColor: "#10b981", // emerald-500
      sliderAccent: "accent-emerald-500",
      sliderLabel: "text-emerald-700",
      sliderThumbColor: "#10b981",
    } as const;
  };

  const vt = getVarTypeStyles();

  return (
    <Card
      className={`shadow-lg border-0 ${vt.cardBg} ${
        vt.ring ?? ""
      } backdrop-blur-sm overflow-hidden`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${vt.topBar}`}
      />

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span className={`text-xl ${vt.iconColor}`}>
                {parameter.icon}
              </span>
              {parameter.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0.5 ${vt.badgeColor}`}
              >
                {parameter.varType}
              </Badge>
              <span className="text-xs text-slate-500">
                {parameter.varType === "MV"
                  ? "Manipulated"
                  : parameter.varType === "CV"
                  ? "Controlled"
                  : "Disturbance"}
              </span>
            </div>
          </div>
          <Badge
            variant={isInRange ? "outline" : "secondary"}
            className={
              isInRange
                ? vt.badgeColor
                : "bg-red-100 text-red-800 border-red-200"
            }
          >
            {isInRange ? "In Range" : "Out of Range"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Values and Range */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {isLabParameter ? "Lab Value" : "Current Value"}
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
              style={{ color: vt.accentColor }}
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

        {/* Trend Chart - Show for process parameters even if no trend points to keep SP/shading visible */}
        {!isLabParameter &&
          (() => {
            // Filter trend data based on current displayHours
            const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000;
            const filteredTrend = parameter.trend.filter(
              (item) => item.timestamp >= hoursAgo
            );

            // Calculate Y-axis domain to include data, optimization bounds, and proposed setpoint
            let yMin: number;
            let yMax: number;

            if (filteredTrend.length > 0) {
              const values = filteredTrend.map((d) => d.value);
              yMin = Math.min(
                ...values,
                range[0],
                typeof proposedSetpoint === "number"
                  ? proposedSetpoint
                  : values[0]
              );
              yMax = Math.max(
                ...values,
                range[1],
                typeof proposedSetpoint === "number"
                  ? proposedSetpoint
                  : values[0]
              );
            } else {
              // Fallback when no trend points in window - ensure bounds and proposed setpoint are visible
              const base =
                typeof proposedSetpoint === "number"
                  ? proposedSetpoint
                  : (range[0] + range[1]) / 2;
              yMin = Math.min(range[0], base);
              yMax = Math.max(range[1], base);
            }

            const pad = yMax - yMin || 1;
            const yAxisDomain: [number, number] = [
              yMin - pad * 0.05,
              yMax + pad * 0.05,
            ];

            const isMVParameter = parameter.varType === "MV";

            return (
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
                        trackClassName={
                          isMVParameter
                            ? "bg-purple-100 dark:bg-purple-950/50"
                            : undefined
                        }
                        rangeClassName={
                          isMVParameter
                            ? "bg-purple-500 dark:bg-purple-400"
                            : undefined
                        }
                        thumbClassName={
                          isMVParameter
                            ? "border-purple-600 bg-white focus-visible:ring-purple-300 dark:border-purple-300 dark:bg-purple-900"
                            : undefined
                        }
                      />
                      <div className="ml--3 w-10 text-sm text-center font-medium">
                        {sliderValue.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
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
                      labelFormatter={(timestamp: number) =>
                        formatTime(timestamp)
                      }
                      contentStyle={{
                        background: "#1f2937",
                        borderColor: "#374151",
                        color: "#e5e7eb",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "#e5e7eb" }}
                    />
                    {/* Distribution Bounds Shading - 90% confidence interval from target-driven optimization */}
                    {distributionBounds && (
                      <ReferenceArea
                        y1={distributionBounds[0]}
                        y2={distributionBounds[1]}
                        fill={
                          parameter.varType === "MV" ? "#f59e0b" : "#3b82f6"
                        } // amber for MV, blue for CV
                        fillOpacity={0.25}
                        ifOverflow="extendDomain"
                      />
                    )}
                    {/* Distribution Median Line - thin dotted line darker than shading */}
                    {typeof distributionMedian === "number" && (
                      <ReferenceLine
                        y={distributionMedian}
                        stroke={
                          parameter.varType === "MV" ? "#d97706" : "#2563eb"
                        } // darker amber/blue than shading
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                        ifOverflow="extendDomain"
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={vt.accentColor}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {/* Proposed Setpoint horizontal dashed line (only shown after optimization) */}
                    {typeof proposedSetpoint === "number" && (
                      <ReferenceLine
                        y={proposedSetpoint}
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        ifOverflow="extendDomain"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

        {/* Double Range Slider (full width, no duplicate labels) */}
        <div className="pt-2">
          <DoubleRangeSlider
            min={bounds[0]}
            max={bounds[1]}
            value={range}
            onChange={handleRangeChange}
            step={(bounds[1] - bounds[0]) / 100}
            className={"w-full"}
          />
          {/* Proposed Setpoint Indicator (only shown after optimization) */}
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
      <style jsx>{`
        input.vertical-slider {
          appearance: none;
          width: 100%;
          height: 100%;
          padding: 0;
          cursor: pointer;
        }

        input.vertical-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          background: rgba(148, 163, 184, 0.6);
          border-radius: 9999px;
          box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.35);
        }

        input.vertical-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: var(--slider-thumb-color, #475569);
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(30, 41, 59, 0.2);
          margin-top: -7px;
          cursor: grab;
        }

        input.vertical-slider::-moz-range-track {
          width: 100%;
          height: 4px;
          background: rgba(148, 163, 184, 0.6);
          border-radius: 9999px;
          box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.35);
        }

        input.vertical-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: var(--slider-thumb-color, #475569);
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(30, 41, 59, 0.2);
          cursor: grab;
        }

        input.vertical-slider:active::-webkit-slider-thumb {
          cursor: grabbing;
        }

        input.vertical-slider:active::-moz-range-thumb {
          cursor: grabbing;
        }
      `}</style>
    </Card>
  );
}
