"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { MillsForecastingHeader } from "./components/MillsForecastingHeader";
import { MillsSelector } from "./components/MillsSelector";
import { ForecastLayout } from "./components/ForecastLayout";
import { useProductionForecast } from "./hooks/useProductionForecast";
import { MILLS_LIST, TARGET_RANGES, ORE_RATE_RANGES } from "./constants";

export default function MillsForecastingPage() {
  // selectedMills represents mills included for adjustment.
  // Empty array means all mills are included.
  const [selectedMills, setSelectedMills] = useState<string[]>([]);
  const [shiftTarget, setShiftTarget] = useState<number>(
    TARGET_RANGES.shift.default
  );
  const [dayTarget, setDayTarget] = useState<number>(TARGET_RANGES.day.default);
  const [currentOreRate, setCurrentOreRate] = useState<number>(
    ORE_RATE_RANGES.default
  );
  const [adjustedOreRate, setAdjustedOreRate] = useState<number>(
    ORE_RATE_RANGES.default
  );
  const [uncertaintyLevel, setUncertaintyLevel] = useState<1 | 2 | 3>(2);

  // Memoize mills array to prevent recreating it on every render
  const mills = useMemo(() => Array.from(MILLS_LIST), []);

  const { currentTime, forecast } = useProductionForecast({
    shiftTarget,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyLevel,
    mills,
    selectedMills,
  });

  const handleMillSelection = (mill: string) => {
    if (mill === "all") {
      // "All" button clicked - clear selection (all mills included)
      setSelectedMills([]);
      return;
    }

    setSelectedMills((prev) => {
      if (prev.includes(mill)) {
        // Mill already selected, remove it from selection
        return prev.filter((m) => m !== mill);
      }
      // Add mill to selection
      return [...prev, mill];
    });
  };

  if (!forecast) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="px-4 py-3 text-xs text-slate-600">
          Loading production forecast...
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      <MillsForecastingHeader currentTime={currentTime} forecast={forecast} />

      <Card className="p-2 flex items-center justify-between gap-2">
        <MillsSelector
          mills={mills}
          selectedMills={selectedMills}
          onSelectMill={handleMillSelection}
        />
      </Card>

      <ForecastLayout
        forecast={forecast}
        shiftTarget={shiftTarget}
        dayTarget={dayTarget}
        currentOreRate={currentOreRate}
        adjustedOreRate={adjustedOreRate}
        uncertaintyLevel={uncertaintyLevel}
        onChangeShiftTarget={setShiftTarget}
        onChangeDayTarget={setDayTarget}
        onChangeCurrentOreRate={setCurrentOreRate}
        onChangeAdjustedOreRate={setAdjustedOreRate}
        onChangeUncertaintyLevel={setUncertaintyLevel}
      />
    </div>
  );
}
