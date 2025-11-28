"use client";
import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface HistogramChartProps {
  data: number[];
  binCount?: number;
  title?: string;
  unit?: string;
  showNormalCurve?: boolean;
  highlightOutliers?: boolean;
  mean?: number;
  stdDev?: number;
}

interface HistogramBin {
  range: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  percentage: number;
  isOutlier: boolean;
}

export const HistogramChart: React.FC<HistogramChartProps> = ({
  data,
  binCount = 15,
  title,
  unit = "",
  showNormalCurve = false,
  highlightOutliers = true,
  mean: providedMean,
  stdDev: providedStdDev,
}) => {
  const histogramData = useMemo((): HistogramBin[] => {
    if (!data || data.length === 0) return [];

    const validData = data.filter((v) => !isNaN(v) && isFinite(v));
    if (validData.length === 0) return [];

    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const range = max - min;
    const binSize = range / binCount;

    // Calculate mean and stdDev if not provided
    const mean =
      providedMean ??
      validData.reduce((sum, v) => sum + v, 0) / validData.length;
    const variance =
      validData.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      validData.length;
    const stdDev = providedStdDev ?? Math.sqrt(variance);

    // Create bins
    const bins: HistogramBin[] = [];
    for (let i = 0; i < binCount; i++) {
      const rangeStart = min + i * binSize;
      const rangeEnd = min + (i + 1) * binSize;
      const count = validData.filter((v) =>
        i === binCount - 1
          ? v >= rangeStart && v <= rangeEnd
          : v >= rangeStart && v < rangeEnd
      ).length;

      // Check if this bin contains outliers (beyond 2 std dev)
      const binMidpoint = (rangeStart + rangeEnd) / 2;
      const isOutlier = Math.abs(binMidpoint - mean) > 2 * stdDev;

      bins.push({
        range: `${rangeStart.toFixed(1)}`,
        rangeStart,
        rangeEnd,
        count,
        percentage: (count / validData.length) * 100,
        isOutlier,
      });
    }

    return bins;
  }, [data, binCount, providedMean, providedStdDev]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const validData = data.filter((v) => !isNaN(v) && isFinite(v));
    if (validData.length === 0) return null;

    const mean = validData.reduce((sum, v) => sum + v, 0) / validData.length;
    const variance =
      validData.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      validData.length;
    const stdDev = Math.sqrt(variance);

    // Skewness
    const skewness =
      validData.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) /
      validData.length;

    // Kurtosis
    const kurtosis =
      validData.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0) /
        validData.length -
      3;

    return { mean, stdDev, skewness, kurtosis, n: validData.length };
  }, [data]);

  if (!histogramData.length || !stats) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Няма данни за хистограма
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const bin = payload[0].payload as HistogramBin;
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-800">
          {bin.rangeStart.toFixed(2)} - {bin.rangeEnd.toFixed(2)} {unit}
        </p>
        <p className="text-sm text-gray-600">
          Брой: <span className="font-medium">{bin.count}</span>
        </p>
        <p className="text-sm text-gray-600">
          Процент:{" "}
          <span className="font-medium">{bin.percentage.toFixed(1)}%</span>
        </p>
        {bin.isOutlier && (
          <p className="text-xs text-orange-600 mt-1">⚠️ Извън 2σ</p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>n={stats.n}</span>
            <span>μ={stats.mean.toFixed(2)}</span>
            <span>σ={stats.stdDev.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={histogramData}
            margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.3}
            />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={50}
              interval={Math.floor(binCount / 8)}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              label={{
                value: "Брой",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              x={histogramData
                .findIndex(
                  (b) => b.rangeStart <= stats.mean && b.rangeEnd > stats.mean
                )
                ?.toString()}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {histogramData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    highlightOutliers && entry.isOutlier ? "#f97316" : "#3b82f6"
                  }
                  opacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution shape indicators */}
      <div className="flex justify-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Асиметрия:</span>
          <span
            className={`font-medium ${
              Math.abs(stats.skewness) > 1
                ? "text-orange-600"
                : "text-green-600"
            }`}
          >
            {stats.skewness.toFixed(2)}
            {stats.skewness > 0.5 ? " →" : stats.skewness < -0.5 ? " ←" : " ↔"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Ексцес:</span>
          <span
            className={`font-medium ${
              Math.abs(stats.kurtosis) > 1
                ? "text-orange-600"
                : "text-green-600"
            }`}
          >
            {stats.kurtosis.toFixed(2)}
            {stats.kurtosis > 1 ? " ⋀" : stats.kurtosis < -1 ? " ⋃" : " ~"}
          </span>
        </div>
      </div>
    </div>
  );
};
