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
  ComposedChart,
  Line,
} from "recharts";
import type { Forecast } from "../types/forecasting";
import { VerticalShiftSlider } from "./shared/VerticalShiftSlider";

// Fixed slider bounds - completely static, never changes
const SLIDER_MIN = 10000;
const SLIDER_MAX = 20000;

// Custom tooltip with rates
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="mb-1">
            <p style={{ color: entry.color }} className="text-xs font-medium">
              {entry.name}: <strong>{Math.round(entry.value)} t</strong>
            </p>
            {entry.payload.rates && entry.dataKey && (
              <p className="text-[10px] text-gray-500 pl-2">
                Скорост: {Math.round(entry.payload.rates[entry.dataKey])} t/h
              </p>
            )}
          </div>
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
  shift1Locked: boolean;
  shift2Locked: boolean;
  shift3Locked: boolean;
  dayTarget: number;
  currentOreRate: number;
  onAdjustShiftTarget: (shiftIndex: 1 | 2 | 3, newValue: number) => void;
  onToggleShiftLock: (shiftIndex: 1 | 2 | 3) => void;
  canLockShift: (shiftIndex: 1 | 2 | 3) => boolean;
}

export const ShiftPerformanceChart: FC<ShiftPerformanceChartProps> = ({
  forecast,
  shift1Target,
  shift2Target,
  shift3Target,
  shift1Locked,
  shift2Locked,
  shift3Locked,
  dayTarget,
  currentOreRate,
  onAdjustShiftTarget,
  onToggleShiftLock,
  canLockShift,
}) => {
  // Calculate rates for tooltip
  const getRates = (target: number) => ({
    actual: currentOreRate,
    expected: currentOreRate * forecast.uncertainty.factor,
    target: target / 8,
  });

  const data = [
    {
      shift: "См.1 (06-14)",
      actual:
        forecast.shiftInfo.shift === 1
          ? forecast.productionSoFar
          : currentOreRate * 8,
      expected:
        forecast.shiftInfo.shift === 1
          ? forecast.forecastShiftExpected
          : currentOreRate * 8 * forecast.uncertainty.factor,
      target: shift1Target,
      rates: getRates(shift1Target),
    },
    {
      shift: "См.2 (14-22)",
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
      target: shift2Target,
      rates: getRates(shift2Target),
    },
    {
      shift: "См.3 (22-06)",
      actual: forecast.shiftInfo.shift === 3 ? forecast.productionSoFar : 0,
      expected:
        forecast.shiftInfo.shift === 3
          ? forecast.forecastShiftExpected
          : currentOreRate * 8 * forecast.uncertainty.factor,
      target: shift3Target,
      rates: getRates(shift3Target),
    },
  ];

  const totalShiftTargets = shift1Target + shift2Target + shift3Target;
  const isBalanced = Math.abs(totalShiftTargets - dayTarget) < 1;

  return (
    <div className="space-y-2">
      {/* Total validation header */}
      <div className="flex items-center justify-end text-xs">
        <span
          className={`text-xs font-medium ${
            isBalanced ? "text-green-600" : "text-red-600"
          }`}
        >
          Общо: {Math.round(totalShiftTargets)}t / {Math.round(dayTarget)}t
          {isBalanced ? " ✓" : " ⚠️"}
        </span>
      </div>

      {/* Sliders on left + Chart on right */}
      <div className="flex items-center gap-4">
        {/* Shift Target Sliders - Left Side */}
        <div className="flex gap-3 pr-4 border-r">
          <VerticalShiftSlider
            label="См.1"
            value={shift1Target}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            color="blue"
            isLocked={shift1Locked}
            canLock={canLockShift(1)}
            onChange={(value) => onAdjustShiftTarget(1, value)}
            onToggleLock={() => onToggleShiftLock(1)}
          />
          <VerticalShiftSlider
            label="См.2"
            value={shift2Target}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            color="orange"
            isLocked={shift2Locked}
            canLock={canLockShift(2)}
            onChange={(value) => onAdjustShiftTarget(2, value)}
            onToggleLock={() => onToggleShiftLock(2)}
          />
          <VerticalShiftSlider
            label="См.3"
            value={shift3Target}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            color="purple"
            isLocked={shift3Locked}
            canLock={canLockShift(3)}
            onChange={(value) => onAdjustShiftTarget(3, value)}
            onToggleLock={() => onToggleShiftLock(3)}
          />
        </div>

        {/* Bar Chart - Right Side */}
        <div className="flex-1 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="shift" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="actual"
                fill="#3b82f6"
                name="Фактическо / Текущо"
                barSize={40}
              />
              <Bar
                dataKey="expected"
                fill={forecast.uncertainty.color}
                name="Прогнозирано (с несигурност)"
                barSize={40}
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#a855f7"
                strokeWidth={2}
                name="Цел (Плъзгач)"
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
