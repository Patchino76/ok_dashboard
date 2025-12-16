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
  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 18, right: 140, bottom: 18, left: 140 }}>
            <Pie
              data={data}
              cx="50%"
              cy="48%"
              labelLine={false}
              label={({ name, value }) => {
                const n = String(name);
                const v = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(v) || v <= 0) return "";
                if (labelFormatter)
                  return labelFormatter({ name: n, value: v });
                return `${n}: ${v}t`;
              }}
              outerRadius={Math.min(
                150,
                Math.max(80, Math.floor(height * 0.38))
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

        {showLegendList ? (
          <div className="mt-4 space-y-2">
            {data.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-semibold">
                  {item.value.toFixed(1)} [t]
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
