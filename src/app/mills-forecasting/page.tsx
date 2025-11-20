"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { MillsForecastingHeader } from "./components/MillsForecastingHeader";
import { MillsSelector } from "./components/MillsSelector";
import { ForecastLayout } from "./components/ForecastLayout";
import { useProductionForecast } from "./hooks/useProductionForecast";
import { useMillsProductionData } from "./hooks/useMillsProductionData";
import { useForecastingStore } from "./stores/forecastingStore";
import { MILLS_LIST, TARGET_RANGES, ORE_RATE_RANGES } from "./constants";
import { millsNames } from "@/lib/tags/mills-tags";

export default function MillsForecastingPage() {
  // Get settings and data from Zustand store
  const {
    shiftTarget,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyLevel,
    selectedMills,
    actualShiftProduction,
    actualDayProduction,
    isRealTimeMode,
    setShiftTarget,
    setDayTarget,
    setAdjustedOreRate,
    setUncertaintyLevel,
    setSelectedMills,
    updateRealTimeData,
  } = useForecastingStore();

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

  // Calculate forecast using real-time data
  const { currentTime, forecast } = useProductionForecast({
    shiftTarget,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyLevel,
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
      </Card>

      <ForecastLayout
        forecast={forecast}
        shiftTarget={shiftTarget}
        dayTarget={dayTarget}
        currentOreRate={currentOreRate}
        adjustedOreRate={adjustedOreRate}
        uncertaintyLevel={uncertaintyLevel}
        currentTime={currentTime}
        onChangeShiftTarget={setShiftTarget}
        onChangeDayTarget={setDayTarget}
        onChangeCurrentOreRate={(rate) => {
          // In manual mode, allow changing current ore rate
          // This is handled by the store
        }}
        onChangeAdjustedOreRate={setAdjustedOreRate}
        onChangeUncertaintyLevel={setUncertaintyLevel}
      />
    </div>
  );
}
