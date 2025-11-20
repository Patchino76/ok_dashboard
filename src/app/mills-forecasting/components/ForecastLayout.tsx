import { FC } from "react";
import { Card } from "@/components/ui/card";
import type { Forecast } from "../types/forecasting";
import { ProductionForecastChart } from "./ProductionForecastChart";
import { ShiftPerformanceChart } from "./ShiftPerformanceChart";
import { PerMillOreSetpointChart } from "./PerMillOreSetpointChart";
import { TargetControlPanel } from "./controls/TargetControlPanel";
import { OreRateControlPanel } from "./controls/OreRateControlPanel";
import { UncertaintyControlPanel } from "./controls/UncertaintyControlPanel";
import { ProgressSummaryCards } from "./displays/ProgressSummaryCards";
import { RequiredRatesCard } from "./displays/RequiredRatesCard";
import { ForecastSummaryCard } from "./displays/ForecastSummaryCard";

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
      {/* Left column - Controls and Summary */}
      <div className="col-span-12 lg:col-span-4 space-y-3">
        <ProgressSummaryCards
          forecast={forecast}
          shiftTarget={shiftTarget}
          dayTarget={dayTarget}
        />

        <TargetControlPanel
          shiftTarget={shiftTarget}
          dayTarget={dayTarget}
          onChangeShiftTarget={onChangeShiftTarget}
          onChangeDayTarget={onChangeDayTarget}
        />

        <OreRateControlPanel
          currentOreRate={currentOreRate}
          adjustedOreRate={adjustedOreRate}
          onChangeCurrentOreRate={onChangeCurrentOreRate}
          onChangeAdjustedOreRate={onChangeAdjustedOreRate}
        />

        <UncertaintyControlPanel
          uncertaintyLevel={uncertaintyLevel}
          uncertainty={forecast.uncertainty}
          onChangeUncertaintyLevel={onChangeUncertaintyLevel}
          expectedStoppages={forecast.expectedStoppages}
          expectedDowntime={forecast.expectedDowntime}
        />

        <RequiredRatesCard forecast={forecast} />

        <ForecastSummaryCard forecast={forecast} dayTarget={dayTarget} />
      </div>

      {/* Right column - Charts and Analysis */}
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
      </div>
    </div>
  );
};
