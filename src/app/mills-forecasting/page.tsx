"use client";

import { useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { MillsForecastingHeader } from "./components/MillsForecastingHeader";
import { MillsSelector } from "./components/MillsSelector";
import { ForecastLayout } from "./components/ForecastLayout";
import { useProductionForecast } from "./hooks/useProductionForecast";
import { useMillsProductionData } from "./hooks/useMillsProductionData";
import { useForecastingStore } from "./stores/forecastingStore";
import { MILLS_LIST, TARGET_RANGES } from "./constants";
import { millsNames } from "@/lib/tags/mills-tags";

export default function MillsForecastingPage() {
  // Get settings and data from Zustand store
  const {
    shift1Target,
    shift2Target,
    shift3Target,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyPercent,
    selectedMills,
    actualShiftProduction,
    actualDayProduction,
    isRealTimeMode,
    setDayTarget,
    recalculateShiftTargets,
    setUncertaintyPercent,
    setSelectedMills,
    updateRealTimeData,
  } = useForecastingStore();

  const hourNow = new Date().getHours();
  const shiftTargetForForecast =
    hourNow >= 6 && hourNow < 14
      ? shift1Target
      : hourNow >= 14 && hourNow < 22
      ? shift2Target
      : shift3Target;

  // Fetch real-time production data from API (refreshes every 20 seconds)
  const { data: productionData, isLoading: isLoadingProduction } =
    useMillsProductionData(20);

  // Update store when real-time data arrives
  useEffect(() => {
    if (productionData && isRealTimeMode) {
      console.log("📊 Real-time production data received:", {
        totalOreRate: productionData.totalOreRate,
        shiftProduction: productionData.shiftProduction.current,
        dayProduction: productionData.dayProduction,
        activeMillsCount: productionData.activeMillsCount,
      });

      updateRealTimeData({
        currentOreRate: productionData.totalOreRate,
        actualShiftProduction: productionData.shiftProduction.current,
        actualDayProduction: productionData.dayProduction,
        activeMillsCount: productionData.activeMillsCount,
      });
    }
  }, [productionData, isRealTimeMode, updateRealTimeData]);

  // Memoize mills array to prevent recreating it on every render
  const mills = useMemo(() => Array.from(MILLS_LIST), []);

  // Create mill ore rates map from production data
  const millOreRates = useMemo(() => {
    if (!productionData?.mills) return undefined;

    console.log("🔧 Creating mill ore rates map from production data:", {
      millCount: productionData.mills.length,
      firstMill: productionData.mills[0],
    });

    const rates: Record<string, number> = {};
    // Map using English mill names (Mill01, Mill02, etc.)
    productionData.mills.forEach((mill, index) => {
      const englishName = millsNames[index]?.en; // Get English name from millsNames
      if (englishName) {
        const oreValue = mill.ore || 0;
        rates[englishName] = oreValue;
        console.log(
          `  Mapping ${mill.title} → ${englishName}: ${oreValue} t/h`
        );
      }
    });

    console.log("🔧 Final mill ore rates map:", rates);

    return rates;
  }, [productionData]);

  // Initialize shift targets on mount
  useEffect(() => {
    recalculateShiftTargets();
  }, [recalculateShiftTargets]);

  // Calculate forecast using real-time data
  const { currentTime, forecast } = useProductionForecast({
    shiftTarget: shiftTargetForForecast,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyPercent,
    mills,
    selectedMills,
    actualShiftProduction, // Real-time data from API
    actualDayProduction, // Real-time data from API
    millOreRates, // Individual mill ore rates from API
  });

  const handleMillSelection = (mill: string) => {
    if (mill === "all") {
      // "All" button clicked - clear selection (all mills included)
      setSelectedMills([]);
      return;
    }

    // Toggle mill selection
    const newSelection = selectedMills.includes(mill)
      ? selectedMills.filter((m) => m !== mill)
      : [...selectedMills, mill];

    setSelectedMills(newSelection);
  };

  const handleReset = () => {
    // Simply reset to defaults - shift targets will auto-calculate
    setDayTarget(TARGET_RANGES.day.default);
    setUncertaintyPercent(0);
    setSelectedMills([]);
  };

  if (isLoadingProduction || !forecast) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="px-4 py-3 text-xs text-slate-600">
          {isLoadingProduction
            ? "Loading production data..."
            : "Calculating forecast..."}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      <MillsForecastingHeader
        currentTime={currentTime}
        forecast={forecast}
        isRealTimeMode={isRealTimeMode}
        activeMillsCount={productionData?.activeMillsCount || 0}
        lastDataUpdate={productionData?.timestamp}
      />

      <Card className="p-2 flex items-center justify-between gap-2">
        <MillsSelector
          mills={mills}
          selectedMills={selectedMills}
          onSelectMill={handleMillSelection}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 text-xs text-slate-500 hover:text-slate-900"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </Card>

      <ForecastLayout
        forecast={forecast}
        shift1Target={shift1Target}
        shift2Target={shift2Target}
        shift3Target={shift3Target}
        dayTarget={dayTarget}
        currentOreRate={currentOreRate}
        uncertaintyPercent={uncertaintyPercent}
        currentTime={currentTime}
        onChangeDayTarget={setDayTarget}
        onChangeUncertainty={setUncertaintyPercent}
      />
    </div>
  );
}
