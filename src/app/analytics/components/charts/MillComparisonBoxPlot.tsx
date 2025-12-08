"use client";
import React, { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ErrorBar,
  Cell,
  ReferenceArea,
} from "recharts";

interface MillComparisonBoxPlotProps {
  millsData: Record<string, number[]>;
  millNames: Record<string, string>;
  title?: string;
  unit?: string;
  globalMean?: number;
  globalStdDev?: number;
}

interface BoxPlotData {
  millName: string;
  displayName: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  iqr: number;
  outlierCount: number;
  status: "good" | "warning" | "critical";
  statusReason: string;
}

export const MillComparisonBoxPlot: React.FC<MillComparisonBoxPlotProps> = ({
  millsData,
  millNames,
  title = "Сравнение на мелници",
  unit = "",
  globalMean,
  globalStdDev,
}) => {
  const { boxPlotData, overallStats } = useMemo(() => {
    const allValues: number[] = [];
    Object.values(millsData).forEach((values) => {
      allValues.push(...values.filter((v) => !isNaN(v) && isFinite(v)));
    });

    if (allValues.length === 0) {
      return { boxPlotData: [], overallStats: null };
    }

    const mean =
      globalMean ?? allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
    const variance =
      allValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      allValues.length;
    const stdDev = globalStdDev ?? Math.sqrt(variance);

    const boxPlotData: BoxPlotData[] = Object.entries(millsData)
      .map(([millName, values]) => {
        const validValues = values
          .filter((v) => !isNaN(v) && isFinite(v))
          .sort((a, b) => a - b);

        if (validValues.length === 0) return null;

        const n = validValues.length;
        const min = validValues[0];
        const max = validValues[n - 1];
        const q1 = validValues[Math.floor(n * 0.25)];
        const median = validValues[Math.floor(n * 0.5)];
        const q3 = validValues[Math.floor(n * 0.75)];
        const iqr = q3 - q1;
        const millMean = validValues.reduce((sum, v) => sum + v, 0) / n;

        // Count outliers (beyond 1.5 * IQR)
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;
        const outlierCount = validValues.filter(
          (v) => v < lowerFence || v > upperFence
        ).length;

        // Determine status based on deviation from global mean
        const deviation = Math.abs(millMean - mean) / stdDev;
        const cv =
          (Math.sqrt(
            validValues.reduce((sum, v) => sum + Math.pow(v - millMean, 2), 0) /
              n
          ) /
            millMean) *
          100;

        let status: "good" | "warning" | "critical" = "good";
        let statusReason = "Нормална работа";

        if (deviation > 2 || cv > 20) {
          status = "critical";
          statusReason =
            deviation > 2
              ? "Голямо отклонение от средното"
              : "Висока вариабилност";
        } else if (deviation > 1 || cv > 10 || outlierCount > n * 0.1) {
          status = "warning";
          statusReason =
            deviation > 1
              ? "Умерено отклонение"
              : outlierCount > n * 0.1
              ? "Много извънредни стойности"
              : "Умерена вариабилност";
        }

        const millNumber = parseInt(millName.replace(/\D/g, ""));
        const displayName = millNames[millNumber] || millName;

        return {
          millName,
          displayName,
          min,
          q1,
          median,
          q3,
          max,
          mean: millMean,
          iqr,
          outlierCount,
          status,
          statusReason,
        };
      })
      .filter((d): d is BoxPlotData => d !== null)
      .sort((a, b) => {
        const numA = parseInt(a.millName.replace(/\D/g, ""));
        const numB = parseInt(b.millName.replace(/\D/g, ""));
        return numA - numB;
      });

    return {
      boxPlotData,
      overallStats: { mean, stdDev },
    };
  }, [millsData, millNames, globalMean, globalStdDev]);

  if (boxPlotData.length === 0 || !overallStats) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Няма данни за сравнение
      </div>
    );
  }

  // Custom box plot rendering using bars
  const chartData = boxPlotData.map((d) => ({
    ...d,
    // For the box plot visualization
    boxStart: d.q1,
    boxHeight: d.q3 - d.q1,
    whiskerLow: d.min,
    whiskerHigh: d.max,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as BoxPlotData;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg min-w-48">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-3 h-3 rounded-full ${
              data.status === "critical"
                ? "bg-red-500"
                : data.status === "warning"
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
          />
          <p className="font-semibold text-gray-800">{data.displayName}</p>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Медиана:</span>
            <span className="font-medium">
              {data.median.toFixed(1)} {unit}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Q1 - Q3:</span>
            <span className="font-medium">
              {data.q1.toFixed(1)} - {data.q3.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Мин - Макс:</span>
            <span className="font-medium">
              {data.min.toFixed(1)} - {data.max.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">IQR:</span>
            <span className="font-medium">{data.iqr.toFixed(1)}</span>
          </div>
          {data.outlierCount > 0 && (
            <div className="flex justify-between text-orange-600">
              <span>Извънредни:</span>
              <span className="font-medium">{data.outlierCount}</span>
            </div>
          )}
        </div>
        <div
          className={`mt-2 pt-2 border-t text-xs ${
            data.status === "critical"
              ? "text-red-600"
              : data.status === "warning"
              ? "text-yellow-600"
              : "text-green-600"
          }`}
        >
          {data.statusReason}
        </div>
      </div>
    );
  };

  const yMin = Math.min(...boxPlotData.map((d) => d.min)) * 0.95;
  const yMax = Math.max(...boxPlotData.map((d) => d.max)) * 1.05;

  // Status counts
  const criticalCount = boxPlotData.filter(
    (d) => d.status === "critical"
  ).length;
  const warningCount = boxPlotData.filter((d) => d.status === "warning").length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <div className="flex gap-3 text-xs">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              {criticalCount} критични
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-600 font-medium">
              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              {warningCount} внимание
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              opacity={0.3}
            />

            {/* Global mean reference line */}
            <ReferenceLine
              x={overallStats.mean}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `μ=${overallStats.mean.toFixed(1)}`,
                position: "top",
                fontSize: 10,
                fill: "#3b82f6",
              }}
            />

            {/* ±1σ zone */}
            <ReferenceArea
              x1={overallStats.mean - overallStats.stdDev}
              x2={overallStats.mean + overallStats.stdDev}
              fill="#dcfce7"
              fillOpacity={0.3}
            />

            <XAxis
              type="number"
              domain={[yMin, yMax]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(0)}
            />
            <YAxis
              type="category"
              dataKey="displayName"
              tick={{ fontSize: 11 }}
              width={75}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Box (IQR) */}
            <Bar
              dataKey="iqr"
              stackId="box"
              fill="#3b82f6"
              radius={[4, 4, 4, 4]}
              barSize={20}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.status === "critical"
                      ? "#ef4444"
                      : entry.status === "warning"
                      ? "#f59e0b"
                      : "#22c55e"
                  }
                  fillOpacity={0.7}
                />
              ))}
            </Bar>

            {/* Median line - rendered as scatter points */}
            {chartData.map((entry, index) => (
              <ReferenceLine
                key={`median-${index}`}
                x={entry.median}
                stroke="transparent"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded opacity-70" />
          <span>Нормално</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded opacity-70" />
          <span>Внимание</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded opacity-70" />
          <span>Критично</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-6 h-0.5 bg-blue-500"
            style={{ borderStyle: "dashed" }}
          />
          <span>Средно (μ)</span>
        </div>
      </div>
    </div>
  );
};
