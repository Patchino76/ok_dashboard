"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { MillsForecastingHeader } from "./components/MillsForecastingHeader";
import { MillsSelector } from "./components/MillsSelector";
import { ForecastLayout } from "./components/ForecastLayout";
import { useProductionForecast } from "./hooks/useProductionForecast";

const mills = [
  "all",
  "Mill_1",
  "Mill_2",
  "Mill_3",
  "Mill_4",
  "Mill_5",
  "Mill_6",
  "Mill_7",
  "Mill_8",
  "Mill_9",
  "Mill_10",
];

export default function MillsForecastingPage() {
  // selectedMills now represents mills that are EXCLUDED from adjustment.
  // When the list is empty, "All" is considered active and all mills participate.
  const [selectedMills, setSelectedMills] = useState<string[]>([]);
  const [shiftTarget, setShiftTarget] = useState<number>(1400);
  const [dayTarget, setDayTarget] = useState<number>(4000);
  const [currentOreRate, setCurrentOreRate] = useState<number>(169.67);
  const [adjustedOreRate, setAdjustedOreRate] = useState<number>(169.67);
  const [uncertaintyLevel, setUncertaintyLevel] = useState<1 | 2 | 3>(2);

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
      // Clear all exclusions
      setSelectedMills([]);
      return;
    }

    setSelectedMills((prev) => {
      if (prev.includes(mill)) {
        // Un-exclude this mill
        return prev.filter((m) => m !== mill);
      }
      // Exclude this mill from adjustment
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
