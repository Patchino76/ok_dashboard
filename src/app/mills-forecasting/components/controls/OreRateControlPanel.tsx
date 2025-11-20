import { FC } from "react";
import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { SliderControl } from "../shared/SliderControl";
import { ORE_RATE_RANGES } from "../../constants";

interface OreRateControlPanelProps {
  currentOreRate: number;
  adjustedOreRate: number;
  onChangeCurrentOreRate: (value: number) => void;
  onChangeAdjustedOreRate: (value: number) => void;
}

export const OreRateControlPanel: FC<OreRateControlPanelProps> = ({
  currentOreRate,
  adjustedOreRate,
  onChangeCurrentOreRate,
  onChangeAdjustedOreRate,
}) => {
  return (
    <Card className="p-3 space-y-3">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
        <Activity className="h-4 w-4" />
        Ore Feeding Rates
      </div>
      <div className="space-y-3">
        <SliderControl
          label="Current Rate"
          value={currentOreRate}
          unit=" t/h"
          min={ORE_RATE_RANGES.min}
          max={ORE_RATE_RANGES.max}
          step={ORE_RATE_RANGES.step}
          onChange={onChangeCurrentOreRate}
          valueColor="text-blue-600"
        />
        <SliderControl
          label="Adjusted Rate (Rest of Period)"
          value={adjustedOreRate}
          unit=" t/h"
          min={ORE_RATE_RANGES.min}
          max={ORE_RATE_RANGES.max}
          step={ORE_RATE_RANGES.step}
          onChange={onChangeAdjustedOreRate}
          valueColor="text-emerald-600"
          helpText="Change rate for remaining time"
        />
      </div>
    </Card>
  );
};
