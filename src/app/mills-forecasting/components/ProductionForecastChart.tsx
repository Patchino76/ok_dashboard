import { FC } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  Line,
} from "recharts";
import type { HourlyForecastPoint, Uncertainty } from "../types/forecasting";

interface ProductionForecastChartProps {
  data: HourlyForecastPoint[];
  dayTarget: number;
  uncertainty: Uncertainty;
  expectedStoppages: number;
  expectedDowntime: number;
}

export const ProductionForecastChart: FC<ProductionForecastChartProps> = ({
  data,
  dayTarget,
  uncertainty,
  expectedStoppages,
  expectedDowntime,
}) => {
  return (
    <div className="space-y-2">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={dayTarget}
              stroke="#3b82f6"
              strokeDasharray="5 5"
              label={{ value: "Target", fontSize: 10, fill: "#3b82f6" }}
            />

            <Area
              type="monotone"
              dataKey="optimistic"
              stroke="none"
              fill="#10b981"
              fillOpacity={0.1}
              name="Optimistic Range"
            />
            <Area
              type="monotone"
              dataKey="pessimistic"
              stroke="none"
              fill="#ef4444"
              fillOpacity={0.1}
              name="Pessimistic Range"
            />

            <Line
              type="monotone"
              dataKey="optimistic"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="Best Case"
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke={uncertainty.color}
              strokeWidth={3}
              dot={false}
              name={`Expected (${uncertainty.name})`}
            />
            <Line
              type="monotone"
              dataKey="pessimistic"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="Worst Case"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
        <strong>Note:</strong> Uncertainty range based on{" "}
        {uncertainty.name.toLowerCase()} conditions. Expected scenario: ~
        {expectedStoppages} stoppages, {expectedDowntime.toFixed(0)} min
        downtime.
      </div>
    </div>
  );
};
