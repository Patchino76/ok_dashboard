"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  minor: "#eab308",
  major: "#ef4444",
};

export function DowntimeCategoryChart({
  metrics,
  title = "Разпределение по категория",
}: DowntimeCategoryChartProps) {
  const data = [
    {
      name: "Незначителни",
      value: metrics.totalMinorDowntimes,
      color: COLORS.minor,
    },
    {
      name: "Значителни",
      value: metrics.totalMajorDowntimes,
      color: COLORS.major,
    },
  ];

  const total = metrics.totalMinorDowntimes + metrics.totalMajorDowntimes;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription>
          Съотношение между незначителни ({"<"}60 мин) и значителни (≥60 мин)
          престои
        </CardDescription>
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
                  `${value} събития (${
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
            <p className="text-2xl font-bold text-yellow-500">
              {metrics.totalMinorDowntimes}
            </p>
            <p className="text-sm text-muted-foreground">Незначителни</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">
              {metrics.totalMajorDowntimes}
            </p>
            <p className="text-sm text-muted-foreground">Значителни</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
