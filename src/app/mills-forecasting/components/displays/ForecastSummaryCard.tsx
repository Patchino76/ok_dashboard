import { FC } from "react";
import { Card } from "@/components/ui/card";
import type { Forecast } from "../../types/forecasting";

interface ForecastSummaryCardProps {
  forecast: Forecast;
  dayTarget: number;
}

export const ForecastSummaryCard: FC<ForecastSummaryCardProps> = ({
  forecast,
  dayTarget,
}) => {
  const gap = forecast.forecastDayExpected - dayTarget;

  return (
    <Card className="p-3 space-y-2">
      <div className="text-sm font-semibold text-slate-900">
        Day Forecast Summary
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Optimistic:</span>
          <span className="font-bold text-emerald-600">
            {forecast.forecastDayOptimistic.toFixed(0)}t
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Expected:</span>
          <span className="font-bold text-slate-900">
            {forecast.forecastDayExpected.toFixed(0)}t
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Pessimistic:</span>
          <span className="font-bold text-red-600">
            {forecast.forecastDayPessimistic.toFixed(0)}t
          </span>
        </div>
        <div className="h-px bg-slate-300 my-1" />
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Target:</span>
          <span className="font-bold text-blue-600">{dayTarget}t</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Gap:</span>
          <span
            className={`font-bold ${
              gap >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {gap >= 0 ? "+" : ""}
            {gap.toFixed(0)}t
          </span>
        </div>
      </div>
    </Card>
  );
};
