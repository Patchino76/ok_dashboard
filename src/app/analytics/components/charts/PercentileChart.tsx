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
  Cell,
  ReferenceLine,
} from "recharts";

interface PercentileChartProps {
  data: number[];
  title?: string;
  unit?: string;
  currentValue?: number;
}

interface PercentileData {
  label: string;
  percentile: number;
  value: number;
  color: string;
}

export const PercentileChart: React.FC<PercentileChartProps> = ({
  data,
  title = "Разпределение по перцентили",
  unit = "",
  currentValue,
}) => {
  const percentileData = useMemo((): PercentileData[] => {
    if (!data || data.length === 0) return [];

    const validData = data
      .filter((v) => !isNaN(v) && isFinite(v))
      .sort((a, b) => a - b);
    if (validData.length === 0) return [];

    const getPercentile = (p: number): number => {
      const index = (p / 100) * (validData.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;

      if (upper >= validData.length) return validData[validData.length - 1];
      return validData[lower] * (1 - weight) + validData[upper] * weight;
    };

    const percentiles = [
      { label: "P5", percentile: 5, color: "#ef4444" },
      { label: "P10", percentile: 10, color: "#f97316" },
      { label: "P25", percentile: 25, color: "#eab308" },
      { label: "P50", percentile: 50, color: "#22c55e" },
      { label: "P75", percentile: 75, color: "#eab308" },
      { label: "P90", percentile: 90, color: "#f97316" },
      { label: "P95", percentile: 95, color: "#ef4444" },
    ];

    return percentiles.map((p) => ({
      ...p,
      value: getPercentile(p.percentile),
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const validData = data.filter((v) => !isNaN(v) && isFinite(v));
    if (validData.length === 0) return null;

    const mean = validData.reduce((sum, v) => sum + v, 0) / validData.length;
    const min = Math.min(...validData);
    const max = Math.max(...validData);

    return { mean, min, max, n: validData.length };
  }, [data]);

  if (percentileData.length === 0 || !stats) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Няма данни за перцентилен анализ
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload as PercentileData;
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-800">
          {point.label} ({point.percentile}%)
        </p>
        <p className="text-sm text-gray-600">
          Стойност:{" "}
          <span className="font-medium">
            {point.value.toFixed(2)} {unit}
          </span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {point.percentile}% от стойностите са под {point.value.toFixed(2)}
        </p>
      </div>
    );
  };

  // Find where current value falls
  const currentPercentile =
    currentValue !== undefined
      ? percentileData.findIndex((p) => currentValue <= p.value)
      : -1;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>n={stats.n}</span>
          <span>min={stats.min.toFixed(1)}</span>
          <span>max={stats.max.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={percentileData}
            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.3}
            />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Mean reference line */}
            <ReferenceLine
              y={stats.mean}
              stroke="#3b82f6"
              strokeDasharray="5 5"
              label={{
                value: `μ=${stats.mean.toFixed(1)}`,
                position: "right",
                fontSize: 10,
                fill: "#3b82f6",
              }}
            />

            {/* Current value reference if provided */}
            {currentValue !== undefined && (
              <ReferenceLine
                y={currentValue}
                stroke="#8b5cf6"
                strokeWidth={2}
                label={{
                  value: `Текущо: ${currentValue.toFixed(1)}`,
                  position: "right",
                  fontSize: 10,
                  fill: "#8b5cf6",
                }}
              />
            )}

            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {percentileData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Percentile values table */}
      <div className="grid grid-cols-7 gap-1 mt-2 text-xs">
        {percentileData.map((p, i) => (
          <div
            key={i}
            className="text-center p-1 rounded"
            style={{ backgroundColor: `${p.color}20` }}
          >
            <div className="font-medium" style={{ color: p.color }}>
              {p.label}
            </div>
            <div className="text-gray-700">{p.value.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
