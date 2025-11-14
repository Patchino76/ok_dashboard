import { FC } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Target,
  TrendingUp,
} from "lucide-react";
import type { Forecast } from "../types/forecasting";
import { ProductionForecastChart } from "./ProductionForecastChart";
import { ShiftPerformanceChart } from "./ShiftPerformanceChart";
import { PerMillOreSetpointChart } from "./PerMillOreSetpointChart";
import { OreFeedTimelineChart } from "./OreFeedTimelineChart";

interface ForecastLayoutProps {
  forecast: Forecast;
  shiftTarget: number;
  dayTarget: number;
  currentOreRate: number;
  adjustedOreRate: number;
  uncertaintyLevel: 1 | 2 | 3;
  onChangeShiftTarget: (value: number) => void;
  onChangeDayTarget: (value: number) => void;
  onChangeCurrentOreRate: (value: number) => void;
  onChangeAdjustedOreRate: (value: number) => void;
  onChangeUncertaintyLevel: (value: 1 | 2 | 3) => void;
}

export const ForecastLayout: FC<ForecastLayoutProps> = ({
  forecast,
  shiftTarget,
  dayTarget,
  currentOreRate,
  adjustedOreRate,
  uncertaintyLevel,
  onChangeShiftTarget,
  onChangeDayTarget,
  onChangeCurrentOreRate,
  onChangeAdjustedOreRate,
  onChangeUncertaintyLevel,
}) => {
  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Left column */}
      <div className="col-span-12 lg:col-span-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-2">
            <div className="text-xs text-slate-600 mb-1">Shift Progress</div>
            <div className="text-lg font-bold text-slate-900">
              {forecast.productionSoFar.toFixed(0)}t
            </div>
            <div className="text-[11px] text-slate-500">
              {((forecast.productionSoFar / shiftTarget) * 100).toFixed(0)}% of
              target
            </div>
          </Card>
          <Card className="p-2">
            <div className="text-xs text-slate-600 mb-1">Day Progress</div>
            <div className="text-lg font-bold text-slate-900">
              {forecast.productionToday.toFixed(0)}t
            </div>
            <div className="text-[11px] text-slate-500">
              {((forecast.productionToday / dayTarget) * 100).toFixed(0)}% of
              target
            </div>
          </Card>
        </div>

        <Card className="p-3 space-y-3">
          <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
            <Target className="h-4 w-4" />
            Targets
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-600">Shift (8h)</span>
                <span className="text-sm font-bold text-slate-900">
                  {shiftTarget}t
                </span>
              </div>
              <Slider
                min={800}
                max={2000}
                step={50}
                value={[shiftTarget]}
                onValueChange={(v) => onChangeShiftTarget(v[0] ?? shiftTarget)}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-600">Daily (24h)</span>
                <span className="text-sm font-bold text-slate-900">
                  {dayTarget}t
                </span>
              </div>
              <Slider
                min={2400}
                max={6000}
                step={100}
                value={[dayTarget]}
                onValueChange={(v) => onChangeDayTarget(v[0] ?? dayTarget)}
              />
            </div>
          </div>
        </Card>

        <Card className="p-3 space-y-3">
          <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Ore Feeding Rates
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-600">Current Rate</span>
                <span className="text-sm font-bold text-blue-600">
                  {currentOreRate.toFixed(1)} t/h
                </span>
              </div>
              <Slider
                min={100}
                max={250}
                step={0.5}
                value={[currentOreRate]}
                onValueChange={(v) =>
                  onChangeCurrentOreRate(v[0] ?? currentOreRate)
                }
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-600">
                  Adjusted Rate (Rest of Period)
                </span>
                <span className="text-sm font-bold text-emerald-600">
                  {adjustedOreRate.toFixed(1)} t/h
                </span>
              </div>
              <Slider
                min={100}
                max={250}
                step={0.5}
                value={[adjustedOreRate]}
                onValueChange={(v) =>
                  onChangeAdjustedOreRate(v[0] ?? adjustedOreRate)
                }
              />
              <div className="text-[11px] text-slate-500 mt-1">
                Change rate for remaining time
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Operating Uncertainty
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((level) => {
              const active = uncertaintyLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => onChangeUncertaintyLevel(level as 1 | 2 | 3)}
                  className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border text-center transition-colors ${
                    active
                      ? "text-white border-transparent"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                  style={
                    active
                      ? { backgroundColor: forecast.uncertainty.color }
                      : undefined
                  }
                >
                  {forecast.uncertainty.name === "Low" && level === 1
                    ? "Low"
                    : forecast.uncertainty.name === "Medium" && level === 2
                    ? "Medium"
                    : level === 3
                    ? "High"
                    : level === 1
                    ? "Low"
                    : level === 2
                    ? "Medium"
                    : "High"}
                </button>
              );
            })}
          </div>
          <div className="bg-slate-50 p-2 rounded text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Availability:</span>
              <span className="font-semibold">
                {(forecast.uncertainty.factor * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Expected Stoppages:</span>
              <span className="font-semibold">
                {forecast.expectedStoppages} events
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Expected Downtime:</span>
              <span className="font-semibold">
                {forecast.expectedDowntime.toFixed(0)} min
              </span>
            </div>
          </div>
        </Card>

        <Card
          className={`p-3 text-[11px] space-y-1 border ${
            forecast.canMeetShiftTarget && forecast.canMeetDayTarget
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-start gap-2 mb-1">
            {forecast.canMeetShiftTarget && forecast.canMeetDayTarget ? (
              <AlertCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600" />
            )}
            <div className="font-semibold">
              Required Rates (with uncertainty)
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-700">Shift (ideal):</span>
            <span className="font-bold">
              {forecast.requiredRateShift > 0
                ? forecast.requiredRateShift.toFixed(1)
                : "0.0"}{" "}
              t/h
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-700">Shift (adjusted):</span>
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
            <span className="text-slate-700">Day (ideal):</span>
            <span className="font-bold">
              {forecast.requiredRateDay > 0
                ? forecast.requiredRateDay.toFixed(1)
                : "0.0"}{" "}
              t/h
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-700">Day (adjusted):</span>
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
                  forecast.forecastDayExpected >= dayTarget
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {forecast.forecastDayExpected >= dayTarget ? "+" : ""}
                {(forecast.forecastDayExpected - dayTarget).toFixed(0)}t
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Right column */}
      <div className="col-span-12 lg:col-span-8 space-y-3">
        <Card className="p-3">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            Production Forecast with Uncertainty Range
          </div>
          <ProductionForecastChart
            data={forecast.hourlyForecast}
            dayTarget={dayTarget}
            uncertainty={forecast.uncertainty}
            expectedStoppages={forecast.expectedStoppages}
            expectedDowntime={forecast.expectedDowntime}
          />
        </Card>

        <Card className="p-3">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            Shift Performance Forecast
          </div>
          <ShiftPerformanceChart
            forecast={forecast}
            shiftTarget={shiftTarget}
            currentOreRate={currentOreRate}
          />
        </Card>

        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-slate-900 mb-1">
            Per-Mill Ore Feed Recommendations
          </div>
          <PerMillOreSetpointChart data={forecast.perMillSetpoints} />
        </Card>

        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-slate-900 mb-1">
            Ore Feed Timeline (Rates)
          </div>
          <OreFeedTimelineChart data={forecast.oreFeedTimeline} />
        </Card>

        <Card className="p-3">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            Risk Analysis &amp; Recommendations
          </div>
          <div className="space-y-2 text-[11px]">
            <div
              className={`p-2 rounded border ${
                forecast.canMeetDayTarget
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  className={
                    forecast.canMeetDayTarget
                      ? "h-4 w-4 text-emerald-600 mt-0.5"
                      : "h-4 w-4 text-red-600 mt-0.5"
                  }
                />
                <div>
                  <div className="font-semibold mb-1">
                    {forecast.canMeetDayTarget
                      ? "Target Achievable"
                      : "Target at Risk"}
                  </div>
                  <div className="text-slate-700">
                    {forecast.canMeetDayTarget
                      ? `With ${forecast.uncertainty.name.toLowerCase()} uncertainty, on track to meet target. Expected: ${forecast.forecastDayExpected.toFixed(
                          0
                        )}t.`
                      : `Shortfall of ${(
                          dayTarget - forecast.forecastDayExpected
                        ).toFixed(
                          0
                        )}t. Increase rate to ${forecast.requiredRateDayAdjusted.toFixed(
                          1
                        )} t/h.`}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 rounded bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-semibold mb-1">Operational Buffer</div>
                  <div className="text-slate-700">
                    Account for {forecast.uncertainty.name.toLowerCase()}{" "}
                    uncertainty (
                    {`${(100 - forecast.uncertainty.factor * 100).toFixed(0)}%`}{" "}
                    loss). Maintain rate
                    {forecast.requiredRateDay > 0
                      ? ` ${(
                          ((forecast.requiredRateDayAdjusted -
                            forecast.requiredRateDay) /
                            forecast.requiredRateDay) *
                          100
                        ).toFixed(0)}%`
                      : ""}{" "}
                    above ideal.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
