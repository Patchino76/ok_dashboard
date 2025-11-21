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
import { VerticalShiftSlider } from "./shared/VerticalShiftSlider";

// Fixed slider bounds - completely static, never changes
const SLIDER_MIN = 10000;
const SLIDER_MAX = 20000;

// Custom tooltip without decimals
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-xs">
            {entry.name}: <strong>{Math.round(entry.value)} t</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface ShiftPerformanceChartProps {
  forecast: Forecast;
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
  dayTarget: number;
  currentOreRate: number;
  onAdjustShiftTarget: (shiftIndex: 1 | 2 | 3, newValue: number) => void;
}

export const ShiftPerformanceChart: FC<ShiftPerformanceChartProps> = ({
  forecast,
  shift1Target,
  shift2Target,
  shift3Target,
  dayTarget,
  currentOreRate,
  onAdjustShiftTarget,
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
      target: shift1Target,
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
      target: shift2Target,
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
      target: shift3Target,
    },
  ];

  const totalShiftTargets = shift1Target + shift2Target + shift3Target;
  const isBalanced = Math.abs(totalShiftTargets - dayTarget) < 1;

  return (
    <div className="space-y-2">
      {/* Total validation header */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">Shift Targets</span>
        <span
          className={`text-xs font-medium ${
            isBalanced ? "text-green-600" : "text-red-600"
          }`}
        >
          Total: {Math.round(totalShiftTargets)}t / {Math.round(dayTarget)}t
          {isBalanced ? " ✓" : " ⚠️"}
        </span>
      </div>

      {/* Sliders on left + Bar Chart on right */}
      <div className="flex items-start gap-4">
        {/* Shift Target Sliders - Left Side */}
        <div className="flex gap-3 pr-4 border-r">
          <VerticalShiftSlider
            label="S1"
            value={shift1Target}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            color="blue"
            onChange={(value) => onAdjustShiftTarget(1, value)}
          />
          <VerticalShiftSlider
            label="S2"
            value={shift2Target}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            color="orange"
            onChange={(value) => onAdjustShiftTarget(2, value)}
          />
          <VerticalShiftSlider
            label="S3"
            value={shift3Target}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            color="purple"
            onChange={(value) => onAdjustShiftTarget(3, value)}
          />
        </div>

        {/* Bar Chart - Right Side */}
        <div className="flex-1 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="shift" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
              <Bar
                dataKey="expected"
                fill={forecast.uncertainty.color}
                name="Expected"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
