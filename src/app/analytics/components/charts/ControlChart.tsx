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
  ReferenceArea,
  Scatter,
  ComposedChart,
} from "recharts";

interface ControlChartProps {
  data: { timestamp: string; value: number }[];
  title?: string;
  unit?: string;
  showZones?: boolean;
  millName?: string;
}

interface ControlLimits {
  ucl: number; // Upper Control Limit (mean + 3σ)
  lcl: number; // Lower Control Limit (mean - 3σ)
  uwl: number; // Upper Warning Limit (mean + 2σ)
  lwl: number; // Lower Warning Limit (mean - 2σ)
  mean: number;
  stdDev: number;
}

interface ChartDataPoint {
  timestamp: string;
  value: number;
  formattedTime: string;
  isOutOfControl: boolean;
  isWarning: boolean;
  zone: "A" | "B" | "C";
}

export const ControlChart: React.FC<ControlChartProps> = ({
  data,
  title = "Контролна карта (X-bar)",
  unit = "",
  showZones = true,
  millName,
}) => {
  const { limits, chartData, violations } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        limits: null,
        chartData: [],
        violations: { outOfControl: 0, warnings: 0 },
      };
    }

    const values = data
      .map((d) => d.value)
      .filter((v) => !isNaN(v) && isFinite(v));
    if (values.length === 0) {
      return {
        limits: null,
        chartData: [],
        violations: { outOfControl: 0, warnings: 0 },
      };
    }

    // Calculate control limits
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const limits: ControlLimits = {
      ucl: mean + 3 * stdDev,
      lcl: mean - 3 * stdDev,
      uwl: mean + 2 * stdDev,
      lwl: mean - 2 * stdDev,
      mean,
      stdDev,
    };

    let outOfControl = 0;
    let warnings = 0;

    const chartData: ChartDataPoint[] = data.map((d) => {
      const isOutOfControl = d.value > limits.ucl || d.value < limits.lcl;
      const isWarning =
        !isOutOfControl && (d.value > limits.uwl || d.value < limits.lwl);

      if (isOutOfControl) outOfControl++;
      if (isWarning) warnings++;

      // Determine zone
      let zone: "A" | "B" | "C" = "C";
      const deviation = Math.abs(d.value - mean) / stdDev;
      if (deviation > 2) zone = "A";
      else if (deviation > 1) zone = "B";

      const date = new Date(d.timestamp);
      const formattedTime = `${date
        .getHours()
        .toString()
        .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

      return {
        timestamp: d.timestamp,
        value: d.value,
        formattedTime,
        isOutOfControl,
        isWarning,
        zone,
      };
    });

    return { limits, chartData, violations: { outOfControl, warnings } };
  }, [data]);

  if (!limits || chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Няма данни за контролна карта
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload as ChartDataPoint;
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="text-xs text-gray-500">{point.timestamp}</p>
        <p className="font-semibold text-gray-800">
          {point.value.toFixed(2)} {unit}
        </p>
        <p className="text-xs mt-1">
          Зона:{" "}
          <span
            className={`font-medium ${
              point.zone === "A"
                ? "text-red-600"
                : point.zone === "B"
                ? "text-yellow-600"
                : "text-green-600"
            }`}
          >
            {point.zone}
          </span>
        </p>
        {point.isOutOfControl && (
          <p className="text-xs text-red-600 mt-1">🔴 Извън контрол!</p>
        )}
        {point.isWarning && (
          <p className="text-xs text-yellow-600 mt-1">⚠️ Предупреждение</p>
        )}
      </div>
    );
  };

  // Calculate Y-axis domain with padding
  const yMin = Math.min(limits.lcl, ...chartData.map((d) => d.value)) * 0.95;
  const yMax = Math.max(limits.ucl, ...chartData.map((d) => d.value)) * 1.05;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">
          {title} {millName && `- ${millName}`}
        </h4>
        <div className="flex gap-3 text-xs">
          <span className="text-gray-500">μ={limits.mean.toFixed(2)}</span>
          <span className="text-gray-500">σ={limits.stdDev.toFixed(2)}</span>
          {violations.outOfControl > 0 && (
            <span className="text-red-600 font-medium">
              🔴 {violations.outOfControl}
            </span>
          )}
          {violations.warnings > 0 && (
            <span className="text-yellow-600 font-medium">
              ⚠️ {violations.warnings}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.3}
            />

            {/* Zone shading */}
            {showZones && (
              <>
                {/* Zone A (outer) - Red tint */}
                <ReferenceArea
                  y1={limits.uwl}
                  y2={limits.ucl}
                  fill="#fee2e2"
                  fillOpacity={0.5}
                />
                <ReferenceArea
                  y1={limits.lcl}
                  y2={limits.lwl}
                  fill="#fee2e2"
                  fillOpacity={0.5}
                />
                {/* Zone B (middle) - Yellow tint */}
                <ReferenceArea
                  y1={limits.mean + limits.stdDev}
                  y2={limits.uwl}
                  fill="#fef3c7"
                  fillOpacity={0.5}
                />
                <ReferenceArea
                  y1={limits.lwl}
                  y2={limits.mean - limits.stdDev}
                  fill="#fef3c7"
                  fillOpacity={0.5}
                />
                {/* Zone C (center) - Green tint */}
                <ReferenceArea
                  y1={limits.mean - limits.stdDev}
                  y2={limits.mean + limits.stdDev}
                  fill="#dcfce7"
                  fillOpacity={0.5}
                />
              </>
            )}

            <XAxis
              dataKey="formattedTime"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Control limits */}
            <ReferenceLine
              y={limits.ucl}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: "UCL",
                position: "right",
                fontSize: 10,
                fill: "#ef4444",
              }}
            />
            <ReferenceLine
              y={limits.lcl}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: "LCL",
                position: "right",
                fontSize: 10,
                fill: "#ef4444",
              }}
            />
            <ReferenceLine
              y={limits.uwl}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <ReferenceLine
              y={limits.lwl}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <ReferenceLine
              y={limits.mean}
              stroke="#22c55e"
              strokeWidth={2}
              label={{
                value: "CL",
                position: "right",
                fontSize: 10,
                fill: "#22c55e",
              }}
            />

            {/* Data line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isOutOfControl) {
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="#ef4444"
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  );
                }
                if (payload.isWarning) {
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#f59e0b"
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  );
                }
                return <circle cx={cx} cy={cy} r={2} fill="#3b82f6" />;
              }}
              activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
          <span>Зона C (±1σ)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded" />
          <span>Зона B (±2σ)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
          <span>Зона A (±3σ)</span>
        </div>
      </div>
    </div>
  );
};
