import { FC } from "react";
import { Card } from "@/components/ui/card";
import { Clock, TrendingUp, Calendar, Radio, Factory } from "lucide-react";
import type { Forecast } from "../types/forecasting";

interface MillsForecastingHeaderProps {
  currentTime: Date | null;
  forecast: Forecast;
  isRealTimeMode?: boolean;
  activeMillsCount?: number;
  lastDataUpdate?: Date | null;
}

export const MillsForecastingHeader: FC<MillsForecastingHeaderProps> = ({
  currentTime,
  forecast,
  isRealTimeMode = true,
  activeMillsCount = 0,
  lastDataUpdate,
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("bg-BG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">
            Табло за прогнозиране на производството
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-600">
              Прогноза за производство в реално време с анализ на несигурността
            </p>
            {isRealTimeMode && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 border border-green-200 rounded-full">
                <Radio className="h-3 w-3 text-green-600 animate-pulse" />
                <span className="text-[10px] font-medium text-green-700">
                  ДАННИ В РЕАЛНО ВРЕМЕ
                </span>
              </div>
            )}
            {!isRealTimeMode && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-50 border border-orange-200 rounded-full">
                <span className="text-[10px] font-medium text-orange-700">
                  РЪЧЕН РЕЖИМ
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Current Time */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-[11px] text-slate-500">Текущо време</div>
              <div className="text-sm font-semibold text-slate-900">
                {currentTime ? formatTime(currentTime) : "--:--"}
              </div>
            </div>
          </div>

          {/* Current Date */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-[11px] text-slate-500">Дата</div>
              <div className="text-sm font-semibold text-slate-900">
                {currentTime ? formatDate(currentTime) : "--/--/----"}
              </div>
            </div>
          </div>

          {/* Current Shift */}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-[11px] text-slate-500">Активна смяна</div>
              <div className="text-sm font-semibold text-slate-900">
                {forecast.shiftInfo.name} ({forecast.shiftInfo.startHour}:00-
                {forecast.shiftInfo.endHour}:00)
              </div>
            </div>
          </div>

          {/* Active Mills Count */}
          {isRealTimeMode && activeMillsCount > 0 && (
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-slate-500" />
              <div>
                <div className="text-[11px] text-slate-500">
                  Активни мелници
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {activeMillsCount} / 12
                </div>
              </div>
            </div>
          )}

          {/* Time Remaining */}
          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-[11px] text-blue-600 font-medium mb-0.5">
              Време до края на смяната
            </div>
            <div className="text-lg font-bold text-blue-700">
              {forecast.hoursToShiftEnd.toFixed(1)}h
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
