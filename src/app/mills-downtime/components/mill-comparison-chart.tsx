"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import type { MillComparisonData } from "../lib/downtime-types";

interface MillComparisonChartProps {
  data: MillComparisonData[];
  metric: "availability" | "mtbf" | "mttr";
}

const METRIC_CONFIG = {
  availability: {
    title: "Наличност по мелници",
    description: "Процент на наличност за всяка мелница",
    unit: "%",
    color: "#22c55e",
    reference: 95,
    referenceLabel: "Цел: 95%",
  },
  mtbf: {
    title: "MTBF по мелници",
    description: "Средно време между повреди (часове)",
    unit: "h",
    color: "#3b82f6",
    reference: null,
    referenceLabel: null,
  },
  mttr: {
    title: "MTTR по мелници",
    description: "Средно време за ремонт (часове)",
    unit: "h",
    color: "#f97316",
    reference: null,
    referenceLabel: null,
  },
};

export function MillComparisonChart({
  data,
  metric,
}: MillComparisonChartProps) {
  const config = METRIC_CONFIG[metric];

  const getBarColor = (value: number) => {
    if (metric === "availability") {
      if (value >= 95) return "#22c55e";
      if (value >= 85) return "#eab308";
      return "#ef4444";
    }
    if (metric === "mttr") {
      if (value <= 1) return "#22c55e";
      if (value <= 2) return "#eab308";
      return "#ef4444";
    }
    return config.color;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis
                dataKey="millBg"
                stroke="#a1a1aa"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={metric === "availability" ? [0, 100] : undefined}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#e5e7eb" }}
                formatter={(value: number) => [
                  `${value.toFixed(1)} ${config.unit}`,
                  config.title,
                ]}
              />
              {config.reference && (
                <ReferenceLine
                  y={config.reference}
                  stroke="#22c55e"
                  strokeDasharray="5 5"
                  label={{
                    value: config.referenceLabel,
                    position: "right",
                    fill: "#22c55e",
                    fontSize: 11,
                  }}
                />
              )}
              <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry[metric])}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
