"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PieDatum } from "../lib/types";

type PieDistributionCardProps = {
  title: string;
  data: PieDatum[];
  height: number;
  showLegendList?: boolean;
  labelFormatter?: (args: { name: string; value: number }) => string;
};

export function PieDistributionCard({
  title,
  data,
  height,
  showLegendList,
  labelFormatter,
}: PieDistributionCardProps) {
  const showSliceLabels = !showLegendList;

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={
            showLegendList
              ? "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-center"
              : ""
          }
        >
          <div>
            <ResponsiveContainer width="100%" height={height}>
              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={showSliceLabels}
                  label={
                    showSliceLabels
                      ? ({ name, value }) => {
                          const n = String(name);
                          const v =
                            typeof value === "number" ? value : Number(value);
                          if (!Number.isFinite(v) || v <= 0) return "";
                          if (labelFormatter)
                            return labelFormatter({ name: n, value: v });
                          return `${n}: ${v}t`;
                        }
                      : undefined
                  }
                  outerRadius={Math.min(
                    140,
                    Math.max(70, Math.floor(height * 0.42))
                  )}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {showLegendList ? (
            <div className="space-y-1">
              {data.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-700 truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {item.value.toFixed(1)} [t]
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
