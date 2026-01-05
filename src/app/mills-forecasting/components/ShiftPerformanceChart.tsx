import { FC } from "react";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
  Bar,
  Line,
} from "recharts";
import type { Forecast } from "../types/forecasting";
import { useForecastingStore } from "../stores/forecastingStore";
import { Clock, CheckCircle, TrendingUp } from "lucide-react";

// Custom tooltip with rates and status
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
  dayTarget: number;
  currentOreRate: number;
}

export const ShiftPerformanceChart: FC<ShiftPerformanceChartProps> = ({
  forecast,
  shift1Target,
  shift2Target,
  shift3Target,
  dayTarget,
  currentOreRate,
}) => {
  // Get calculated shift data from store
  const { calculatedShifts } = useForecastingStore();

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
          : calculatedShifts.shift1.isActual
          ? shift1Target
          : 0,
      expected:
        forecast.shiftInfo.shift === 1
          ? forecast.forecastShiftExpected
          : shift1Target,
      target: shift1Target,
      rates: getRates(shift1Target),
      isActual: calculatedShifts.shift1.isActual,
      hoursRemaining: calculatedShifts.shift1.hoursRemaining,
    },
    {
      shift: "См.2 (14-22)",
      actual:
        forecast.shiftInfo.shift === 2
          ? forecast.productionSoFar
          : calculatedShifts.shift2.isActual
          ? shift2Target
          : 0,
      expected:
        forecast.shiftInfo.shift === 2
          ? forecast.forecastShiftExpected
          : shift2Target,
      target: shift2Target,
      rates: getRates(shift2Target),
      isActual: calculatedShifts.shift2.isActual,
      hoursRemaining: calculatedShifts.shift2.hoursRemaining,
    },
    {
      shift: "См.3 (22-06)",
      actual: forecast.shiftInfo.shift === 3 ? forecast.productionSoFar : 0,
      expected:
        forecast.shiftInfo.shift === 3
          ? forecast.forecastShiftExpected
          : shift3Target,
      target: shift3Target,
      rates: getRates(shift3Target),
      isActual: calculatedShifts.shift3.isActual,
      hoursRemaining: calculatedShifts.shift3.hoursRemaining,
    },
  ];

  const totalShiftTargets = shift1Target + shift2Target + shift3Target;
  const isBalanced = Math.abs(totalShiftTargets - dayTarget) < 100;

  // Format number as Kt
  const formatKt = (val: number) => `${(val / 1000).toFixed(1)}k`;

  return (
    <div className="space-y-3">
      {/* Shift Target Cards - Read-only display */}
      <div className="grid grid-cols-3 gap-3">
        {/* Shift 1 */}
        <div
          className={`p-3 rounded-lg border ${
            calculatedShifts.shift1.isActual
              ? "bg-blue-50 border-blue-200"
              : forecast.shiftInfo.shift === 1
              ? "bg-blue-100 border-blue-300 ring-2 ring-blue-400"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">
              См.1 (06-14)
            </span>
            {calculatedShifts.shift1.isActual ? (
              <CheckCircle className="h-3 w-3 text-blue-500" />
            ) : forecast.shiftInfo.shift === 1 ? (
              <Clock className="h-3 w-3 text-blue-600 animate-pulse" />
            ) : (
              <TrendingUp className="h-3 w-3 text-slate-400" />
            )}
          </div>
          <div className="text-lg font-bold text-blue-700">
            {formatKt(shift1Target)}
          </div>
          <div className="text-[10px] text-slate-500">
            {calculatedShifts.shift1.isActual
              ? "Завършена"
              : forecast.shiftInfo.shift === 1
              ? `${calculatedShifts.shift1.hoursRemaining.toFixed(1)}ч оставащи`
              : "Бъдеща"}
          </div>
        </div>

        {/* Shift 2 */}
        <div
          className={`p-3 rounded-lg border ${
            calculatedShifts.shift2.isActual
              ? "bg-orange-50 border-orange-200"
              : forecast.shiftInfo.shift === 2
              ? "bg-orange-100 border-orange-300 ring-2 ring-orange-400"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">
              См.2 (14-22)
            </span>
            {calculatedShifts.shift2.isActual ? (
              <CheckCircle className="h-3 w-3 text-orange-500" />
            ) : forecast.shiftInfo.shift === 2 ? (
              <Clock className="h-3 w-3 text-orange-600 animate-pulse" />
            ) : (
              <TrendingUp className="h-3 w-3 text-slate-400" />
            )}
          </div>
          <div className="text-lg font-bold text-orange-700">
            {formatKt(shift2Target)}
          </div>
          <div className="text-[10px] text-slate-500">
            {calculatedShifts.shift2.isActual
              ? "Завършена"
              : forecast.shiftInfo.shift === 2
              ? `${calculatedShifts.shift2.hoursRemaining.toFixed(1)}ч оставащи`
              : "Бъдеща"}
          </div>
        </div>

        {/* Shift 3 */}
        <div
          className={`p-3 rounded-lg border ${
            calculatedShifts.shift3.isActual
              ? "bg-purple-50 border-purple-200"
              : forecast.shiftInfo.shift === 3
              ? "bg-purple-100 border-purple-300 ring-2 ring-purple-400"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">
              См.3 (22-06)
            </span>
            {calculatedShifts.shift3.isActual ? (
              <CheckCircle className="h-3 w-3 text-purple-500" />
            ) : forecast.shiftInfo.shift === 3 ? (
              <Clock className="h-3 w-3 text-purple-600 animate-pulse" />
            ) : (
              <TrendingUp className="h-3 w-3 text-slate-400" />
            )}
          </div>
          <div className="text-lg font-bold text-purple-700">
            {formatKt(shift3Target)}
          </div>
          <div className="text-[10px] text-slate-500">
            {calculatedShifts.shift3.isActual
              ? "Завършена"
              : forecast.shiftInfo.shift === 3
              ? `${calculatedShifts.shift3.hoursRemaining.toFixed(1)}ч оставащи`
              : "Бъдеща"}
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-500">
          Необходима скорост:{" "}
          <strong className="text-slate-700">
            {calculatedShifts.requiredRate.toFixed(0)} t/h
          </strong>
        </span>
        <span
          className={`font-medium ${
            isBalanced ? "text-green-600" : "text-red-600"
          }`}
        >
          Общо: {formatKt(totalShiftTargets)} / {formatKt(dayTarget)}
          {isBalanced ? " ✓" : " ⚠️"}
        </span>
      </div>

      {/* Bar Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="shift" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar
              dataKey="actual"
              fill="#3b82f6"
              name="Фактическо"
              barSize={30}
            />
            <Bar
              dataKey="expected"
              fill={forecast.uncertainty.color}
              name="Прогноза"
              barSize={30}
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#a855f7"
              strokeWidth={2}
              name="Цел (авто)"
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
