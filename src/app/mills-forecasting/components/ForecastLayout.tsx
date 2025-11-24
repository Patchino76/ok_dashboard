import { FC } from "react";
import { Card } from "@/components/ui/card";
import type { Forecast } from "../types/forecasting";
import { ShiftPerformanceChart } from "./ShiftPerformanceChart";
import { PerMillOreSetpointChart } from "./PerMillOreSetpointChart";
import { TargetControlPanel } from "./controls/TargetControlPanel";
import { UncertaintyControlPanel } from "./controls/UncertaintyControlPanel";
import { ProgressSummaryCards } from "./displays/ProgressSummaryCards";
import { RequiredRatesCard } from "./displays/RequiredRatesCard";
import { ForecastSummaryCard } from "./displays/ForecastSummaryCard";

interface ForecastLayoutProps {
  forecast: Forecast;
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
  shift1Locked: boolean;
  shift2Locked: boolean;
  shift3Locked: boolean;
  dayTarget: number;
  currentOreRate: number;
  uncertaintyPercent: number;
  currentTime?: Date | null;
  onChangeDayTarget: (value: number) => void;
  onAdjustShiftTarget: (shiftIndex: 1 | 2 | 3, newValue: number) => void;
  onToggleShiftLock: (shiftIndex: 1 | 2 | 3) => void;
  canLockShift: (shiftIndex: 1 | 2 | 3) => boolean;
  onChangeUncertainty: (value: number) => void;
}

export const ForecastLayout: FC<ForecastLayoutProps> = ({
  forecast,
  shift1Target,
  shift2Target,
  shift3Target,
  shift1Locked,
  shift2Locked,
  shift3Locked,
  dayTarget,
  currentOreRate,
  uncertaintyPercent,
  currentTime,
  onChangeDayTarget,
  onAdjustShiftTarget,
  onToggleShiftLock,
  canLockShift,
  onChangeUncertainty,
}) => {
  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Left column - Controls and Summary */}
      <div className="col-span-12 lg:col-span-4 space-y-3">
        <ProgressSummaryCards
          forecast={forecast}
          shiftTarget={shift1Target}
          dayTarget={dayTarget}
        />

        <TargetControlPanel
          dayTarget={dayTarget}
          shift1Target={shift1Target}
          shift2Target={shift2Target}
          shift3Target={shift3Target}
          forecast={forecast}
          onChangeDayTarget={onChangeDayTarget}
        />

        <UncertaintyControlPanel
          uncertaintyPercent={uncertaintyPercent}
          uncertainty={forecast.uncertainty}
          onChangeUncertainty={onChangeUncertainty}
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
            Прогноза за изпълнение по смени
          </div>
          <ShiftPerformanceChart
            forecast={forecast}
            shift1Target={shift1Target}
            shift2Target={shift2Target}
            shift3Target={shift3Target}
            shift1Locked={shift1Locked}
            shift2Locked={shift2Locked}
            shift3Locked={shift3Locked}
            dayTarget={dayTarget}
            currentOreRate={currentOreRate}
            onAdjustShiftTarget={onAdjustShiftTarget}
            onToggleShiftLock={onToggleShiftLock}
            canLockShift={canLockShift}
          />
        </Card>

        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-slate-900 mb-1">
            Препоръки за подаване на руда по мелници
          </div>
          <PerMillOreSetpointChart data={forecast.perMillSetpoints} />
        </Card>
      </div>
    </div>
  );
};
