"use client";
import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart,
  ReferenceArea,
} from "recharts";
import { millsNames } from "@/lib/tags/mills-tags";

interface AnomalyTimelineProps {
  data: { timestamp: string; [key: string]: any }[];
  parameter: string;
  unit?: string;
  title?: string;
}

interface AnomalyPoint {
  timestamp: string;
  formattedTime: string;
  value: number;
  millName: string;
  displayName: string;
  severity: "low" | "medium" | "high";
  deviation: number;
  zScore: number;
}

interface TimelineDataPoint {
  timestamp: string;
  formattedTime: string;
  mean: number;
  ucl: number;
  lcl: number;
  anomalies: AnomalyPoint[];
}

export const AnomalyTimeline: React.FC<AnomalyTimelineProps> = ({
  data,
  parameter,
  unit = "",
  title = "Времева линия на аномалии",
}) => {
  const { timelineData, allAnomalies, stats } = useMemo(() => {
    if (!data || data.length === 0) {
      return { timelineData: [], allAnomalies: [], stats: null };
    }

    // Extract mill names
    const millNames = Object.keys(data[0]).filter((k) => k !== "timestamp");

    // Calculate global statistics for each mill
    const millStats: Record<
      string,
      { mean: number; stdDev: number; values: number[] }
    > = {};

    millNames.forEach((mill) => {
      const values = data
        .map((row) => parseFloat(row[mill]))
        .filter((v) => !isNaN(v) && isFinite(v));

      if (values.length > 0) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance =
          values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
          values.length;
        millStats[mill] = { mean, stdDev: Math.sqrt(variance), values };
      }
    });

    // Calculate overall mean and bounds for visualization
    const allValues = Object.values(millStats).flatMap((s) => s.values);
    const overallMean =
      allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
    const overallVariance =
      allValues.reduce((sum, v) => sum + Math.pow(v - overallMean, 2), 0) /
      allValues.length;
    const overallStdDev = Math.sqrt(overallVariance);

    const allAnomalies: AnomalyPoint[] = [];
    const timelineData: TimelineDataPoint[] = [];

    data.forEach((row) => {
      const date = new Date(row.timestamp);
      const formattedTime = `${
        date.getMonth() + 1
      }/${date.getDate()} ${date.getHours()}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      const anomaliesAtTime: AnomalyPoint[] = [];
      let sumAtTime = 0;
      let countAtTime = 0;

      millNames.forEach((mill) => {
        const value = parseFloat(row[mill]);
        if (isNaN(value) || !millStats[mill]) return;

        sumAtTime += value;
        countAtTime++;

        const { mean, stdDev } = millStats[mill];
        const zScore = stdDev > 0 ? (value - mean) / stdDev : 0;
        const deviation = Math.abs(zScore);

        // Detect anomalies (beyond 2 standard deviations)
        if (deviation > 2) {
          const millNum = parseInt(mill.replace(/\D/g, ""));
          const displayName = millsNames[millNum - 1]?.bg || mill;

          let severity: "low" | "medium" | "high" = "low";
          if (deviation > 3) severity = "high";
          else if (deviation > 2.5) severity = "medium";

          const anomaly: AnomalyPoint = {
            timestamp: row.timestamp,
            formattedTime,
            value,
            millName: mill,
            displayName,
            severity,
            deviation,
            zScore,
          };

          anomaliesAtTime.push(anomaly);
          allAnomalies.push(anomaly);
        }
      });

      timelineData.push({
        timestamp: row.timestamp,
        formattedTime,
        mean: countAtTime > 0 ? sumAtTime / countAtTime : 0,
        ucl: overallMean + 2 * overallStdDev,
        lcl: overallMean - 2 * overallStdDev,
        anomalies: anomaliesAtTime,
      });
    });

    return {
      timelineData,
      allAnomalies,
      stats: {
        mean: overallMean,
        stdDev: overallStdDev,
        ucl: overallMean + 2 * overallStdDev,
        lcl: overallMean - 2 * overallStdDev,
      },
    };
  }, [data]);

  if (timelineData.length === 0 || !stats) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Няма данни за анализ на аномалии
      </div>
    );
  }

  // Group anomalies by severity
  const highSeverity = allAnomalies.filter((a) => a.severity === "high");
  const mediumSeverity = allAnomalies.filter((a) => a.severity === "medium");
  const lowSeverity = allAnomalies.filter((a) => a.severity === "low");

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload as TimelineDataPoint;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg max-w-xs">
        <p className="text-xs text-gray-500 mb-1">{point.timestamp}</p>
        <p className="text-sm font-medium text-gray-800">
          Средно: {point.mean.toFixed(2)} {unit}
        </p>
        {point.anomalies.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs font-semibold text-red-600 mb-1">
              Аномалии ({point.anomalies.length}):
            </p>
            {point.anomalies.slice(0, 3).map((a, i) => (
              <div key={i} className="text-xs text-gray-600">
                {a.severity === "high"
                  ? "🔴"
                  : a.severity === "medium"
                  ? "🟠"
                  : "🟡"}
                {a.displayName}: {a.value.toFixed(2)} ({a.zScore > 0 ? "+" : ""}
                {a.zScore.toFixed(1)}σ)
              </div>
            ))}
            {point.anomalies.length > 3 && (
              <p className="text-xs text-gray-400 mt-1">
                +{point.anomalies.length - 3} още...
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Високо: {highSeverity.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Средно: {mediumSeverity.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Ниско: {lowSeverity.length}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={timelineData}
            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.3}
            />

            {/* Warning zone */}
            <ReferenceArea
              y1={stats.lcl}
              y2={stats.ucl}
              fill="#dcfce7"
              fillOpacity={0.3}
            />

            <XAxis
              dataKey="formattedTime"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(0)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Control limits */}
            <ReferenceLine
              y={stats.ucl}
              stroke="#f59e0b"
              strokeDasharray="5 5"
            />
            <ReferenceLine
              y={stats.lcl}
              stroke="#f59e0b"
              strokeDasharray="5 5"
            />
            <ReferenceLine y={stats.mean} stroke="#22c55e" strokeWidth={1} />

            {/* Mean line */}
            <Line
              type="monotone"
              dataKey="mean"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />

            {/* Anomaly markers */}
            <Scatter
              dataKey="mean"
              data={timelineData.filter((d) => d.anomalies.length > 0)}
              fill="#ef4444"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const maxSeverity = payload.anomalies.reduce(
                  (max: string, a: AnomalyPoint) => {
                    if (a.severity === "high") return "high";
                    if (a.severity === "medium" && max !== "high")
                      return "medium";
                    return max;
                  },
                  "low"
                );

                const color =
                  maxSeverity === "high"
                    ? "#ef4444"
                    : maxSeverity === "medium"
                    ? "#f97316"
                    : "#eab308";
                const size =
                  maxSeverity === "high" ? 8 : maxSeverity === "medium" ? 6 : 4;

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={size}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: "pointer" }}
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary */}
      <div className="flex justify-between items-center mt-2 px-2 py-1 bg-gray-50 rounded text-xs">
        <span className="text-gray-600">
          Общо аномалии:{" "}
          <span className="font-semibold">{allAnomalies.length}</span>
        </span>
        <span className="text-gray-600">
          Засегнати времеви точки:{" "}
          <span className="font-semibold">
            {timelineData.filter((d) => d.anomalies.length > 0).length}
          </span>{" "}
          / {timelineData.length}
        </span>
      </div>
    </div>
  );
};
