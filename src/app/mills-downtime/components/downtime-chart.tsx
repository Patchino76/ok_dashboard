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
import { Button } from "@/components/ui/button";
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

type CategoryFilter = "all" | "minor" | "major";

interface DowntimeChartProps {
  data: DowntimeByDay[];
  title?: string;
}

export function DowntimeChart({
  data,
  title = "Престои по дни",
}: DowntimeChartProps) {
  const [showDuration, setShowDuration] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  // Format date for display
  const formattedData = data.map((d) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString("bg-BG", {
      month: "short",
      day: "numeric",
    }),
  }));

  // Select which data keys to use based on mode
  const minorKey = showDuration ? "minorDuration" : "minor";
  const majorKey = showDuration ? "majorDuration" : "major";

  // Determine which bars to show
  const showMinor = categoryFilter === "all" || categoryFilter === "minor";
  const showMajor = categoryFilter === "all" || categoryFilter === "major";

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">{title}</CardTitle>
            <CardDescription>
              {showDuration
                ? "Продължителност на престоите по категория (часове)"
                : "Брой престои по категория за всеки ден"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="duration-mode"
              className="text-xs text-muted-foreground"
            >
              Брой
            </Label>
            <Switch
              id="duration-mode"
              checked={showDuration}
              onCheckedChange={setShowDuration}
            />
            <Label
              htmlFor="duration-mode"
              className="text-xs text-muted-foreground"
            >
              Часове
            </Label>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setCategoryFilter("all")}
            >
              Всички
            </Button>
            <Button
              variant={categoryFilter === "minor" ? "default" : "outline"}
              size="sm"
              className={`text-xs h-7 px-3 ${
                categoryFilter === "minor"
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                  : ""
              }`}
              onClick={() => setCategoryFilter("minor")}
            >
              Кратки
            </Button>
            <Button
              variant={categoryFilter === "major" ? "default" : "outline"}
              size="sm"
              className={`text-xs h-7 px-3 ${
                categoryFilter === "major"
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : ""
              }`}
              onClick={() => setCategoryFilter("major")}
            >
              ППР
            </Button>
          </div>
        </div>
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
                allowDecimals={showDuration}
                tickFormatter={(v) => (showDuration ? `${v}h` : v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#e5e7eb" }}
                formatter={(value: number, name: string) => [
                  showDuration ? `${value.toFixed(1)} h` : value,
                  name === "minor" || name === "minorDuration"
                    ? "Кратки"
                    : "ППР",
                ]}
              />
              {categoryFilter === "all" && (
                <Legend
                  wrapperStyle={{ paddingTop: "10px" }}
                  formatter={(value: string) =>
                    value === "minor" || value === "minorDuration"
                      ? "Кратки"
                      : "ППР"
                  }
                />
              )}
              {showMinor && (
                <Bar
                  dataKey={minorKey}
                  name={minorKey}
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  stackId="stack"
                />
              )}
              {showMajor && (
                <Bar
                  dataKey={majorKey}
                  name={majorKey}
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  stackId="stack"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
