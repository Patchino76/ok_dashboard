import { FC } from "react";
import { Card } from "@/components/ui/card";
import { Target } from "lucide-react";
import { SliderControl } from "../shared/SliderControl";
import { TARGET_RANGES } from "../../constants";

interface TargetControlPanelProps {
  shiftTarget: number;
  dayTarget: number;
  onChangeShiftTarget: (value: number) => void;
  onChangeDayTarget: (value: number) => void;
}

export const TargetControlPanel: FC<TargetControlPanelProps> = ({
  shiftTarget,
  dayTarget,
  onChangeShiftTarget,
  onChangeDayTarget,
}) => {
  return (
    <Card className="p-3 space-y-3">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
        <Target className="h-4 w-4" />
        Production Targets
      </div>
      <div className="space-y-3">
        <SliderControl
          label="Shift Target (8h)"
          value={shiftTarget}
          unit="t"
          min={TARGET_RANGES.shift.min}
          max={TARGET_RANGES.shift.max}
          step={TARGET_RANGES.shift.step}
          onChange={onChangeShiftTarget}
        />
        <SliderControl
          label="Daily Target (24h)"
          value={dayTarget}
          unit="t"
          min={TARGET_RANGES.day.min}
          max={TARGET_RANGES.day.max}
          step={TARGET_RANGES.day.step}
          onChange={onChangeDayTarget}
        />
      </div>
    </Card>
  );
};
