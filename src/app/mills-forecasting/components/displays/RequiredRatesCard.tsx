import { FC } from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import type { Forecast } from "../../types/forecasting";

interface RequiredRatesCardProps {
  forecast: Forecast;
}

export const RequiredRatesCard: FC<RequiredRatesCardProps> = ({ forecast }) => {
  const canMeetTargets =
    forecast.canMeetShiftTarget && forecast.canMeetDayTarget;

  return (
    <Card
      className={`p-3 text-[11px] space-y-1 border ${
        canMeetTargets
          ? "bg-emerald-50 border-emerald-200"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="flex items-start gap-2 mb-1">
        <AlertCircle
          className={`h-4 w-4 ${
            canMeetTargets ? "text-emerald-600" : "text-amber-600"
          }`}
        />
        <div className="font-semibold">Необходими скорости (с несигурност)</div>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-700">Смяна (идеално):</span>
        <span className="font-bold">
          {forecast.requiredRateShift > 0
            ? forecast.requiredRateShift.toFixed(1)
            : "0.0"}{" "}
          t/h
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-700">Смяна (коригирано):</span>
        <span
          className="font-bold"
          style={{ color: forecast.uncertainty.color }}
        >
          {forecast.requiredRateShiftAdjusted > 0
            ? forecast.requiredRateShiftAdjusted.toFixed(1)
            : "0.0"}{" "}
          t/h
        </span>
      </div>

      <div className="h-px bg-slate-300 my-1" />

      <div className="flex justify-between">
        <span className="text-slate-700">Ден (идеално):</span>
        <span className="font-bold">
          {forecast.requiredRateDay > 0
            ? forecast.requiredRateDay.toFixed(1)
            : "0.0"}{" "}
          t/h
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-700">Ден (коригирано):</span>
        <span
          className="font-bold"
          style={{ color: forecast.uncertainty.color }}
        >
          {forecast.requiredRateDayAdjusted > 0
            ? forecast.requiredRateDayAdjusted.toFixed(1)
            : "0.0"}{" "}
          t/h
        </span>
      </div>
    </Card>
  );
};
