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
  Cell,
} from "recharts";
import type { DowntimeByReason } from "../lib/downtime-types";

interface ReasonBreakdownChartProps {
  data: DowntimeByReason[];
  title?: string;
}

export function ReasonBreakdownChart({
  data,
  title = "Престои по причина",
}: ReasonBreakdownChartProps) {
  // Sort by total and take top 8
  const sortedData = [...data].sort((a, b) => b.total - a.total).slice(0, 8);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription>Разпределение на престоите по причина</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#262626"
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="reasonBg"
                stroke="#a1a1aa"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#e5e7eb" }}
                formatter={(value, name) => [
                  value,
                  name === "minor" ? "Кратки" : "ППР",
                ]}
              />
              <Legend
                wrapperStyle={{ paddingTop: "10px" }}
                formatter={(value) => (value === "minor" ? "Кратки" : "ППР")}
              />
              <Bar
                dataKey="minor"
                name="minor"
                fill="#f97316"
                radius={[0, 4, 4, 0]}
                stackId="stack"
              />
              <Bar
                dataKey="major"
                name="major"
                fill="#ef4444"
                radius={[0, 4, 4, 0]}
                stackId="stack"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
