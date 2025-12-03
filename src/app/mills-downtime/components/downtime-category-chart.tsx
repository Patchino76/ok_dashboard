"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { AggregateMetrics } from "../lib/downtime-types";

interface DowntimeCategoryChartProps {
  metrics: AggregateMetrics;
  title?: string;
}

const COLORS = {
  minor: "#f97316",
  major: "#ef4444",
};

export function DowntimeCategoryChart({
  metrics,
  title = "Разпределение по категория",
}: DowntimeCategoryChartProps) {
  const [showDuration, setShowDuration] = useState(false);

  const countData = [
    {
      name: "Кратки",
      value: metrics.totalMinorDowntimes,
      color: COLORS.minor,
    },
    {
      name: "ППР",
      value: metrics.totalMajorDowntimes,
      color: COLORS.major,
    },
  ];

  const durationData = [
    {
      name: "Кратки",
      value: metrics.totalMinorDurationHours,
      color: COLORS.minor,
    },
    {
      name: "ППР",
      value: metrics.totalMajorDurationHours,
      color: COLORS.major,
    },
  ];

  const data = showDuration ? durationData : countData;
  const total = showDuration
    ? metrics.totalMinorDurationHours + metrics.totalMajorDurationHours
    : metrics.totalMinorDowntimes + metrics.totalMajorDowntimes;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">{title}</CardTitle>
            <CardDescription>
              {showDuration
                ? "Продължителност по категория (часове)"
                : "Брой престои по категория"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="category-duration-mode"
              className="text-xs text-muted-foreground"
            >
              Брой
            </Label>
            <Switch
              id="category-duration-mode"
              checked={showDuration}
              onCheckedChange={setShowDuration}
            />
            <Label
              htmlFor="category-duration-mode"
              className="text-xs text-muted-foreground"
            >
              Часове
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                formatter={(value: number, name: string) => [
                  showDuration
                    ? `${value.toFixed(1)} ч (${
                        total > 0 ? ((value / total) * 100).toFixed(1) : 0
                      }%)`
                    : `${value} събития (${
                        total > 0 ? ((value / total) * 100).toFixed(1) : 0
                      }%)`,
                  name,
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-orange-500">
              {showDuration
                ? `${metrics.totalMinorDurationHours.toFixed(1)}ч`
                : metrics.totalMinorDowntimes}
            </p>
            <p className="text-sm text-muted-foreground">Кратки</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">
              {showDuration
                ? `${metrics.totalMajorDurationHours.toFixed(1)}ч`
                : metrics.totalMajorDowntimes}
            </p>
            <p className="text-sm text-muted-foreground">ППР</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
