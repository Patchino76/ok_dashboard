import { FC } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { Uncertainty } from "../../types/forecasting";
import { UNCERTAINTY_LEVELS } from "../../constants";

interface UncertaintyControlPanelProps {
  uncertaintyLevel: 1 | 2 | 3;
  uncertainty: Uncertainty;
  onChangeUncertaintyLevel: (value: 1 | 2 | 3) => void;
  expectedStoppages: number;
  expectedDowntime: number;
}

export const UncertaintyControlPanel: FC<UncertaintyControlPanelProps> = ({
  uncertaintyLevel,
  uncertainty,
  onChangeUncertaintyLevel,
  expectedStoppages,
  expectedDowntime,
}) => {
  return (
    <Card className="p-3 space-y-2">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
        <AlertTriangle className="h-4 w-4" />
        Operating Uncertainty
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((level) => {
          const levelConfig = UNCERTAINTY_LEVELS[level as 1 | 2 | 3];
          const isActive = uncertaintyLevel === level;

          return (
            <button
              key={level}
              onClick={() => onChangeUncertaintyLevel(level as 1 | 2 | 3)}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                isActive
                  ? "text-white border-transparent"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              style={
                isActive ? { backgroundColor: levelConfig.color } : undefined
              }
            >
              {levelConfig.name}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-50 p-2 rounded text-[11px] space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-600">Availability:</span>
          <span className="font-semibold">
            {(uncertainty.factor * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Expected Stoppages:</span>
          <span className="font-semibold">{expectedStoppages} events</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Expected Downtime:</span>
          <span className="font-semibold">
            {expectedDowntime.toFixed(0)} min
          </span>
        </div>
      </div>
    </Card>
  );
};
