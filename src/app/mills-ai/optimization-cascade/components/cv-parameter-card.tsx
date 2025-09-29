"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { CascadeParameter } from "../stores/cascade-optimization-store";

interface CVParameterCardProps {
  parameter: CascadeParameter;
  bounds: [number, number];
  rangeValue: [number, number];
  proposedSetpoint?: number;
  distributionBounds?: [number, number];
  distributionMedian?: number;
}

export function CVParameterCard({
  parameter,
  rangeValue,
  proposedSetpoint,
  distributionBounds,
  distributionMedian,
}: CVParameterCardProps) {
  const displayHours = useXgboostStore((state) => state.displayHours);

  const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000;
  const filteredTrend = parameter.trend.filter(
    (item) => item.timestamp >= hoursAgo
  );
  const filteredPredictionTrend = (parameter.predictionTrend ?? []).filter(
    (item) => item.timestamp >= hoursAgo
  );

  const yAxisDomain = useMemo((): [number, number] => {
    const allValues = [
      ...filteredTrend.map((d) => d.value),
      ...filteredPredictionTrend.map((d) => d.value),
      rangeValue[0],
      rangeValue[1],
      typeof proposedSetpoint === "number" ? proposedSetpoint : undefined,
    ].filter((v): v is number => v !== undefined && Number.isFinite(v));

    if (allValues.length === 0) {
      const mid = (rangeValue[0] + rangeValue[1]) / 2;
      return [mid - 1, mid + 1];
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = (max - min || 1) * 0.05;
    return [min - pad, max + pad];
  }, [filteredTrend, filteredPredictionTrend, proposedSetpoint, rangeValue]);

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
            Target range: {rangeValue[0].toFixed(1)} – {rangeValue[1].toFixed(1)} {" "}
            {parameter.unit}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Current Value (PV)
            </div>
            <div className="text-2xl font-bold flex items-center gap-1 text-blue-600">
              {parameter.value.toFixed(2)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Last Prediction
            </div>
            <div className="text-2xl font-bold flex items-center gap-1 text-purple-600">
              {filteredPredictionTrend.length > 0
                ? filteredPredictionTrend[filteredPredictionTrend.length - 1].value.toFixed(2)
                : "--"}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 h-40">
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
                formatter={(value: number, name, props) => {
                  const isPrediction = name === "Predicted";
                  const displayValue = value.toFixed(2);
                  const label = isPrediction ? "Predicted" : parameter.name;
                  return [displayValue, label];
                }}
                labelFormatter={(timestamp: number) => {
                  const date = new Date(timestamp);
                  return `${date.getHours().toString().padStart(2, "0")}:${date
                    .getMinutes()
                    .toString()
                    .padStart(2, "0")}`;
                }}
              />
              {distributionBounds && (
                <ReferenceArea
                  y1={distributionBounds[0]}
                  y2={distributionBounds[1]}
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  ifOverflow="extendDomain"
                />
              )}
              {typeof distributionMedian === "number" && (
                <ReferenceLine
                  y={distributionMedian}
                  stroke="#2563eb"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  ifOverflow="extendDomain"
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {filteredPredictionTrend.length > 0 && (
                <Line
                  type="monotone"
                  data={filteredPredictionTrend}
                  dataKey="value"
                  name="Predicted"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
