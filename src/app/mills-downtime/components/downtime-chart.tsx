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
  Legend,
} from "recharts";
import type { DowntimeByDay } from "../lib/downtime-types";

interface DowntimeChartProps {
  data: DowntimeByDay[];
  title?: string;
}

export function DowntimeChart({
  data,
  title = "Престои по дни",
}: DowntimeChartProps) {
  // Format date for display
  const formattedData = data.map((d) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString("bg-BG", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription>
          Брой престои по категория за всеки ден
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis
                dataKey="dateLabel"
                stroke="#a1a1aa"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#e5e7eb" }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "10px" }}
                formatter={(value) =>
                  value === "minor" ? "Незначителни" : "Значителни"
                }
              />
              <Bar
                dataKey="minor"
                name="minor"
                fill="#eab308"
                radius={[4, 4, 0, 0]}
                stackId="stack"
              />
              <Bar
                dataKey="major"
                name="major"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                stackId="stack"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
