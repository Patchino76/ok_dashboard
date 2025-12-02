"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DowntimeByReason } from "../lib/downtime-types";

interface ParetoChartProps {
  data: DowntimeByReason[];
  title?: string;
}

export function ParetoChart({
  data,
  title = "Парето анализ на причини",
}: ParetoChartProps) {
  // Sort by total descending
  const sortedData = [...data].sort((a, b) => b.total - a.total);

  // Calculate cumulative percentage
  const totalEvents = sortedData.reduce((sum, d) => sum + d.total, 0);
  let cumulative = 0;
  const paretoData = sortedData.map((d) => {
    cumulative += d.total;
    return {
      ...d,
      cumulativePercent: totalEvents > 0 ? (cumulative / totalEvents) * 100 : 0,
    };
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription>
          Идентифициране на основните причини за престой (правило 80/20)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis
                dataKey="reasonBg"
                stroke="#a1a1aa"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                yAxisId="left"
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#e5e7eb" }}
                formatter={(value: number, name: string) => {
                  if (name === "cumulativePercent") {
                    return [`${value.toFixed(1)}%`, "Кумулативен %"];
                  }
                  return [value, "Брой събития"];
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="total"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                name="total"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePercent"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316", r: 4 }}
                name="cumulativePercent"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
