import { FC } from "react";
import { Card } from "@/components/ui/card";
import { Target } from "lucide-react";
import { SliderControl } from "../shared/SliderControl";
import { TARGET_RANGES } from "../../constants";

interface TargetControlPanelProps {
  dayTarget: number;
  onChangeDayTarget: (value: number) => void;
}

export const TargetControlPanel: FC<TargetControlPanelProps> = ({
  dayTarget,
  onChangeDayTarget,
}) => {
  return (
    <Card className="p-3 space-y-3">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
        <Target className="h-4 w-4" />
        Production Target
      </div>
      <div className="space-y-2">
        <SliderControl
          label="Daily Target (24h)"
          value={dayTarget}
          unit="t"
          min={TARGET_RANGES.day.min}
          max={TARGET_RANGES.day.max}
          step={TARGET_RANGES.day.step}
          onChange={onChangeDayTarget}
        />
        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
          💡 Shift targets are calculated automatically and can be adjusted in
          the Shift Performance chart below.
        </div>
      </div>
    </Card>
  );
};
