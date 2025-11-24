import { FC } from "react";
import { Card } from "@/components/ui/card";
import { Target } from "lucide-react";
import { SliderControl } from "../shared/SliderControl";
import { TARGET_RANGES } from "../../constants";
import { Forecast } from "../../types/forecasting";

interface TargetControlPanelProps {
  dayTarget: number;
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
  forecast: Forecast;
  onChangeDayTarget: (value: number) => void;
}

export const TargetControlPanel: FC<TargetControlPanelProps> = ({
  dayTarget,
  shift1Target,
  shift2Target,
  shift3Target,
  forecast,
  onChangeDayTarget,
}) => {
  // Calculate percentages for visualization
  // Use the same scale as the slider to align the handle with the target marker
  const min = TARGET_RANGES.day.min;
  const max = TARGET_RANGES.day.max;
  const range = max - min;

  const getPercent = (val: number) => {
    const clamped = Math.max(min, Math.min(max, val));
    return ((clamped - min) / range) * 100;
  };

  const actualPercent = getPercent(forecast.productionToday);

  // Remaining starts after actual
  const forecastTotal =
    forecast.productionToday +
    Math.max(0, forecast.forecastDayExpected - forecast.productionToday);
  const totalPercent = getPercent(forecastTotal);
  const remainingWidth = totalPercent - actualPercent;

  const targetPercent = getPercent(dayTarget);

  const isProjectedToMeet = forecast.forecastDayExpected >= dayTarget;
  const gap = forecast.forecastDayExpected - dayTarget;

  // Shift breakdown calculations
  // We approximate the forecast distribution based on the targets if precise shift forecast isn't available
  const totalShiftTargets = shift1Target + shift2Target + shift3Target;
  const s1Ratio = totalShiftTargets ? shift1Target / totalShiftTargets : 1 / 3;
  const s2Ratio = totalShiftTargets ? shift2Target / totalShiftTargets : 1 / 3;

  const s1Forecast = forecast.forecastDayExpected * s1Ratio;
  const s2Forecast = forecast.forecastDayExpected * s2Ratio;

  const s1Width = getPercent(s1Forecast);
  const s2Width = getPercent(s1Forecast + s2Forecast) - s1Width;
  const s3Width = totalPercent - s1Width - s2Width;

  // Cumulative target markers
  const t1Percent = getPercent(shift1Target);
  const t2Percent = getPercent(shift1Target + shift2Target);
  const t3Percent = getPercent(shift1Target + shift2Target + shift3Target);

  // Helper to format values in Kt
  const formatKt = (val: number) => `${(val / 1000).toFixed(1)} Kt`;

  return (
    <Card className="p-3 space-y-3">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
        <Target className="h-4 w-4" />
        Цел на производство
      </div>
      <div className="space-y-4">
        <SliderControl
          label="Дневна цел (24ч)"
          value={dayTarget}
          unit="t"
          min={TARGET_RANGES.day.min}
          max={TARGET_RANGES.day.max}
          step={TARGET_RANGES.day.step}
          onChange={onChangeDayTarget}
        />

        {/* Forecast Preview Bar */}
        <div className="space-y-1 px-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">Прогноза:</span>
            <span
              className={`font-bold ${
                isProjectedToMeet ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatKt(forecast.forecastDayExpected)} ({gap > 0 ? "+" : ""}
              {formatKt(gap)})
            </span>
          </div>
          <div className="h-5 bg-slate-100 rounded-t-sm relative overflow-hidden flex items-center">
            {/* Actual Production (Lighter Blue) */}
            <div
              className="absolute top-0 left-0 h-full bg-blue-200 flex items-center justify-end px-2 overflow-hidden transition-all duration-300"
              style={{ width: `${actualPercent}%` }}
            >
              <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap shadow-sm">
                {formatKt(forecast.productionToday)}
              </span>
            </div>
            {/* Remaining Forecast */}
            <div
              className={`absolute top-0 h-full ${
                isProjectedToMeet ? "bg-emerald-400" : "bg-rose-400"
              } opacity-80`}
              style={{
                left: `${actualPercent}%`,
                width: `${remainingWidth}%`,
              }}
            />

            {/* Daily Target Marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-black z-20"
              style={{ left: `${targetPercent}%` }}
            />
          </div>

          {/* Shift Breakdown Bar */}
          <div className="h-6 bg-slate-50 rounded-b-sm relative overflow-hidden border-t border-white flex text-[10px] font-semibold text-slate-700">
            {/* S1 Forecast */}
            <div
              className="absolute top-0 left-0 h-full bg-blue-100 flex items-center justify-center overflow-hidden px-1 border-r border-white/50"
              style={{ width: `${s1Width}%` }}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                См.1: {formatKt(s1Forecast)}
              </span>
            </div>
            {/* S2 Forecast */}
            <div
              className="absolute top-0 h-full bg-orange-100 flex items-center justify-center overflow-hidden px-1 border-r border-white/50"
              style={{ left: `${s1Width}%`, width: `${s2Width}%` }}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                См.2: {formatKt(s2Forecast)}
              </span>
            </div>
            {/* S3 Forecast */}
            <div
              className="absolute top-0 h-full bg-purple-100 flex items-center justify-center overflow-hidden px-1"
              style={{ left: `${s1Width + s2Width}%`, width: `${s3Width}%` }}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                См.3:{" "}
                {formatKt(
                  forecast.forecastDayExpected - s1Forecast - s2Forecast
                )}
              </span>
            </div>
          </div>

          {/* Markers Row */}
          <div className="relative h-6">
            {/* S1 Target Marker */}
            <div
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center group"
              style={{ left: `${t1Percent}%`, marginTop: "-1px" }}
            >
              <div className="w-0.5 h-2 bg-blue-500" />
              <div className="text-[9px] font-bold text-slate-600 whitespace-nowrap">
                См.1: {formatKt(shift1Target)}
              </div>
            </div>

            {/* S2 Target Marker */}
            <div
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center group"
              style={{ left: `${t2Percent}%`, marginTop: "-1px" }}
            >
              <div className="w-0.5 h-2 bg-orange-500" />
              <div className="text-[9px] font-bold text-slate-600 whitespace-nowrap">
                См.2: {formatKt(shift1Target + shift2Target)}
              </div>
            </div>

            {/* S3 Target Marker */}
            <div
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center group"
              style={{ left: `${t3Percent}%`, marginTop: "-1px" }}
            >
              <div className="w-0.5 h-2 bg-purple-500" />
              <div className="text-[9px] font-bold text-slate-600 whitespace-nowrap">
                См.3: {formatKt(shift1Target + shift2Target + shift3Target)}
              </div>
            </div>

            {/* Daily Target Marker Label */}
            <div
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${targetPercent}%`, marginTop: "-1px" }}
            >
              <div className="w-0.5 h-2 bg-black" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
