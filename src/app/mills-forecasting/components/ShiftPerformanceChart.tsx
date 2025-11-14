import { FC } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { Forecast } from "../types/forecasting";

interface ShiftPerformanceChartProps {
  forecast: Forecast;
  shiftTarget: number;
  currentOreRate: number;
}

export const ShiftPerformanceChart: FC<ShiftPerformanceChartProps> = ({
  forecast,
  shiftTarget,
  currentOreRate,
}) => {
  const data = [
    {
      shift: "S1 (06-14)",
      actual:
        forecast.shiftInfo.shift === 1
          ? forecast.productionSoFar
          : currentOreRate * 8,
      expected:
        forecast.shiftInfo.shift === 1
          ? forecast.forecastShiftExpected
          : currentOreRate * 8 * forecast.uncertainty.factor,
      optimistic:
        forecast.shiftInfo.shift === 1
          ? forecast.forecastShiftOptimistic
          : currentOreRate * 8,
      target: shiftTarget,
    },
    {
      shift: "S2 (14-22)",
      actual:
        forecast.shiftInfo.shift === 2
          ? forecast.productionSoFar
          : forecast.shiftInfo.shift > 2
          ? currentOreRate * 8
          : 0,
      expected:
        forecast.shiftInfo.shift === 2
          ? forecast.forecastShiftExpected
          : currentOreRate * 8 * forecast.uncertainty.factor,
      optimistic:
        forecast.shiftInfo.shift === 2
          ? forecast.forecastShiftOptimistic
          : currentOreRate * 8,
      target: shiftTarget,
    },
    {
      shift: "S3 (22-06)",
      actual: forecast.shiftInfo.shift === 3 ? forecast.productionSoFar : 0,
      expected:
        forecast.shiftInfo.shift === 3
          ? forecast.forecastShiftExpected
          : currentOreRate * 8 * forecast.uncertainty.factor,
      optimistic:
        forecast.shiftInfo.shift === 3
          ? forecast.forecastShiftOptimistic
          : currentOreRate * 8,
      target: shiftTarget,
    },
  ];

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="shift" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
          <Bar
            dataKey="expected"
            fill={forecast.uncertainty.color}
            name="Expected"
          />
          <Bar
            dataKey="optimistic"
            fill="#10b981"
            fillOpacity={0.4}
            name="Best Case"
          />
          <ReferenceLine
            y={shiftTarget}
            stroke="#ef4444"
            strokeDasharray="5 5"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
