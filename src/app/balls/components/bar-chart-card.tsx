"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { BarDatum } from "../lib/types";

type BarChartCardProps = {
  title: string;
  data: BarDatum[];
  barFill?: string;
  useBarColors?: boolean;
  height?: number;
};

export function BarChartCard({
  title,
  data,
  barFill = "#ec4899",
  useBarColors,
  height = 350,
}: BarChartCardProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="target" tick={{ fill: "#6b7280" }} />
          <YAxis tick={{ fill: "#6b7280" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Bar
            dataKey="value"
            name="Тонаж"
            fill={barFill}
            radius={[8, 8, 0, 0]}
          >
            {useBarColors
              ? data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || barFill} />
                ))
              : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
