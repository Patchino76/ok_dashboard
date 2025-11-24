import { FC } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle } from "lucide-react";
import type { Uncertainty } from "../../types/forecasting";
import { UNCERTAINTY_RANGES } from "../../constants";

interface UncertaintyControlPanelProps {
  uncertaintyPercent: number;
  uncertainty: Uncertainty;
  onChangeUncertainty: (value: number) => void;
  expectedStoppages: number;
  expectedDowntime: number;
}

export const UncertaintyControlPanel: FC<UncertaintyControlPanelProps> = ({
  uncertaintyPercent,
  uncertainty,
  onChangeUncertainty,
  expectedStoppages,
  expectedDowntime,
}) => {
  return (
    <Card className="p-3 space-y-3">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
        <AlertTriangle className="h-4 w-4" />
        Оперативна несигурност
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600">Ниво на несигурност:</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{
              backgroundColor: uncertainty.color,
              color: "white",
            }}
          >
            {uncertaintyPercent}% ({uncertainty.name})
          </span>
        </div>

        <Slider
          value={[uncertaintyPercent]}
          onValueChange={(values) => onChangeUncertainty(values[0])}
          min={UNCERTAINTY_RANGES.min}
          max={UNCERTAINTY_RANGES.max}
          step={UNCERTAINTY_RANGES.step}
          className="w-full"
        />

        <div className="flex justify-between text-[10px] text-slate-500">
          <span>0% (Най-добро)</span>
          <span>30% (Най-лошо)</span>
        </div>
      </div>

      <div className="bg-slate-50 p-2 rounded text-[11px] space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-600">Готовност:</span>
          <span className="font-semibold">
            {(uncertainty.factor * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Очаквани спирания:</span>
          <span className="font-semibold">{expectedStoppages} събития</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Очакван престой:</span>
          <span className="font-semibold">
            {expectedDowntime.toFixed(0)} мин
          </span>
        </div>
      </div>
    </Card>
  );
};
