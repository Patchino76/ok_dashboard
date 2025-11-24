"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  Forecast,
  ShiftInfo,
  PerMillSetpoint,
  OreFeedTimelinePoint,
  HourlyForecastPoint,
  UseProductionForecastArgs,
} from "../types/forecasting";
import { calculateUncertainty } from "../constants";

const getShiftInfo = (time: Date): ShiftInfo => {
  const hour = time.getHours();
  if (hour >= 6 && hour < 14)
    return { shift: 1, name: "S1", startHour: 6, endHour: 14 };
  if (hour >= 14 && hour < 22)
    return { shift: 2, name: "S2", startHour: 14, endHour: 22 };
  return { shift: 3, name: "S3", startHour: 22, endHour: 6 };
};

const calculateTimeRemaining = (time: Date) => {
  const shiftInfo = getShiftInfo(time);
  const hour = time.getHours();
  const minutes = time.getMinutes();

  let hoursToShiftEnd: number;
  let hoursToEndOfDay: number;

  if (shiftInfo.shift === 3) {
    hoursToShiftEnd =
      hour >= 22 ? 24 - hour + 6 - minutes / 60 : 6 - hour - minutes / 60;
    hoursToEndOfDay = hoursToShiftEnd;
  } else {
    hoursToShiftEnd = shiftInfo.endHour - hour - minutes / 60;
  }

  if (hour >= 6) hoursToEndOfDay = 24 - hour + 6 - minutes / 60;
  else hoursToEndOfDay = 6 - hour - minutes / 60;

  return { hoursToShiftEnd, hoursToEndOfDay, shiftInfo };
};

export const useProductionForecast = (
  args: UseProductionForecastArgs
): {
  currentTime: Date | null;
  forecast: Forecast | null;
} => {
  const {
    shiftTarget,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyPercent,
    mills,
    selectedMills,
    actualShiftProduction,
    actualDayProduction,
    millOreRates,
  } = args;

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentTime(now);
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentTime) return;

    const { hoursToShiftEnd, hoursToEndOfDay, shiftInfo } =
      calculateTimeRemaining(currentTime);

    // Use real-time production data if available, otherwise calculate from ore rate
    const hoursIntoShift = 8 - hoursToShiftEnd;
    const productionSoFar =
      actualShiftProduction !== undefined
        ? actualShiftProduction
        : hoursIntoShift * currentOreRate;

    const hour = currentTime.getHours();
    const hoursIntoDay =
      hour >= 6
        ? hour - 6 + currentTime.getMinutes() / 60
        : 24 - 6 + hour + currentTime.getMinutes() / 60;
    const productionToday =
      actualDayProduction !== undefined
        ? actualDayProduction
        : hoursIntoDay * currentOreRate;

    const uncertainty = calculateUncertainty(uncertaintyPercent);

    const optimisticFactor = 1.0;
    const expectedFactor = uncertainty.factor;
    const pessimisticFactor = uncertainty.factor * 0.85;

    const forecastShiftOptimistic =
      productionSoFar + hoursToShiftEnd * adjustedOreRate * optimisticFactor;
    const forecastShiftExpected =
      productionSoFar + hoursToShiftEnd * adjustedOreRate * expectedFactor;
    const forecastShiftPessimistic =
      productionSoFar + hoursToShiftEnd * adjustedOreRate * pessimisticFactor;

    const forecastDayOptimistic =
      productionToday + hoursToEndOfDay * adjustedOreRate * optimisticFactor;
    const forecastDayExpected =
      productionToday + hoursToEndOfDay * adjustedOreRate * expectedFactor;
    const forecastDayPessimistic =
      productionToday + hoursToEndOfDay * adjustedOreRate * pessimisticFactor;

    const requiredRateShift =
      hoursToShiftEnd > 0
        ? (shiftTarget - productionSoFar) / hoursToShiftEnd
        : 0;
    const requiredRateDay =
      hoursToEndOfDay > 0 ? (dayTarget - productionToday) / hoursToEndOfDay : 0;

    const requiredRateShiftAdjusted =
      expectedFactor > 0
        ? requiredRateShift / expectedFactor
        : requiredRateShift;
    const requiredRateDayAdjusted =
      expectedFactor > 0 ? requiredRateDay / expectedFactor : requiredRateDay;

    const hourlyTonnageForecast: HourlyForecastPoint[] = [];
    const oreFeedTimeline: OreFeedTimelinePoint[] = [];

    // Fixed 24-hour period from 6:00 to 6:00 next day
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();

    // Calculate hours since 6:00 today
    const hoursSince6AM =
      currentHour >= 6
        ? currentHour - 6 + currentMinutes / 60
        : 24 - 6 + currentHour + currentMinutes / 60;

    // Generate 25 data points (6:00, 7:00, ..., 5:00, 6:00) for full 24-hour coverage
    for (let i = 0; i <= 24; i++) {
      const targetHour = (6 + i) % 24;
      const timeLabel = `${String(targetHour).padStart(2, "0")}:00`;

      // Hours from start of day (6:00) to this point
      const hoursFromStart = i;

      // Is this point in the past, present, or future?
      const isPast = hoursFromStart < hoursSince6AM;
      const isFuture = hoursFromStart > hoursSince6AM;
      const isCurrent = Math.abs(hoursFromStart - hoursSince6AM) < 0.5; // Within 30 min

      // For past hours: no forecast lines (null values)
      // For current/future hours: calculate trajectory from NOW to dayTarget at end of day
      let optimistic = null;
      let expected = null;
      let pessimistic = null;

      if (isFuture || isCurrent) {
        // Calculate hours remaining from this point to end of day
        const hoursFromNow = hoursFromStart - hoursSince6AM;
        const hoursRemainingTotal = 24 - hoursSince6AM; // Total hours from now to end of day

        // Linear trajectory: start from current production (productionToday) and reach dayTarget at end
        // Progress ratio: 0 at current time, 1 at end of day (24 hours)
        const progressRatio = hoursFromNow / hoursRemainingTotal;
        const expectedAtThisHour =
          productionToday + (dayTarget - productionToday) * progressRatio;

        // Calculate uncertainty range based on the uncertainty factor
        // Higher uncertainty = wider spread between optimistic and pessimistic
        const uncertaintySpread =
          (dayTarget - productionToday) * (1 - expectedFactor) * 0.3;

        // Expected line: aims directly at dayTarget
        expected = expectedAtThisHour;

        // Optimistic line: above expected (best case - reaches target faster/higher)
        optimistic = expectedAtThisHour + uncertaintySpread * progressRatio;

        // Pessimistic line: below expected (worst case - slower progress)
        pessimistic = expectedAtThisHour - uncertaintySpread * progressRatio;
      }

      // Tonnage forecast over the day (for ProductionForecastChart)
      hourlyTonnageForecast.push({
        time: timeLabel,
        actual: isCurrent ? productionToday : null,
        optimistic,
        expected,
        pessimistic,
        target: dayTarget,
      });

      // Rate-based view (for a future ore-feed timeline chart)
      oreFeedTimeline.push({
        time: timeLabel,
        actualRate: currentOreRate,
        requiredShiftRate: requiredRateShiftAdjusted,
        requiredDayRate: requiredRateDayAdjusted,
      });
    }

    const expectedStoppages = Math.round(
      (hoursToEndOfDay * 60 * uncertainty.stoppageProb) /
        uncertainty.avgStoppage
    );
    const expectedDowntime = expectedStoppages * uncertainty.avgStoppage;

    const perMillSetpoints: PerMillSetpoint[] = [];

    // Use individual mill ore rates if provided, otherwise distribute equally
    const basePerMillRates: Record<string, number> = {};
    if (millOreRates) {
      // Use actual mill ore rates from production data
      console.log("🔍 Forecast hook received millOreRates:", {
        keys: Object.keys(millOreRates),
        values: millOreRates,
      });
      console.log("🔍 Mills array:", mills);

      mills.forEach((millId) => {
        if (millId === "all") return;
        const rate = millOreRates[millId] || 0;
        basePerMillRates[millId] = rate;
        console.log(`  ${millId}: ${rate} t/h`);
      });

      console.log("✅ basePerMillRates populated:", basePerMillRates);
      const total = Object.values(basePerMillRates).reduce(
        (sum, r) => sum + r,
        0
      );
      console.log(`✅ Total of all mill rates: ${total.toFixed(1)} t/h`);
    } else {
      console.warn("⚠️ millOreRates is undefined, using fallback distribution");
      // Fallback: distribute total ore rate equally among mills
      const millCount = mills.filter((m) => m !== "all").length;
      const ratePerMill = millCount > 0 ? currentOreRate / millCount : 0;
      mills.forEach((millId) => {
        if (millId === "all") return;
        basePerMillRates[millId] = ratePerMill;
      });
    }

    // NEW LOGIC: selectedMills are EXCLUDED from adjustment (fixed).
    // If empty, all mills are adjustable.
    const fixedMills =
      selectedMills.length === 0
        ? [] // No mills fixed, all adjustable
        : selectedMills.filter((m) => m in basePerMillRates);

    // Adjustable mills are those NOT in the fixed list
    const adjustableMills = Object.keys(basePerMillRates).filter(
      (m) => !fixedMills.includes(m)
    );

    const fixedContributionShift =
      fixedMills.length > 0
        ? fixedMills.reduce(
            (acc, m) => acc + basePerMillRates[m] * hoursToShiftEnd,
            0
          )
        : 0;

    const fixedContributionDay =
      fixedMills.length > 0
        ? fixedMills.reduce(
            (acc, m) => acc + basePerMillRates[m] * hoursToEndOfDay,
            0
          )
        : 0;

    const remainingShiftTarget =
      shiftTarget - (productionSoFar + fixedContributionShift);
    const remainingDayTarget =
      dayTarget - (productionToday + fixedContributionDay);

    const selectedTotalRate =
      adjustableMills.length > 0
        ? adjustableMills.reduce((acc, m) => acc + basePerMillRates[m], 0)
        : 0;

    const requiredSelectedShiftRate =
      hoursToShiftEnd > 0 ? remainingShiftTarget / hoursToShiftEnd : 0;
    const requiredSelectedDayRate =
      hoursToEndOfDay > 0 ? remainingDayTarget / hoursToEndOfDay : 0;

    // Add adjustable mills with calculated adjustments
    adjustableMills.forEach((millId) => {
      const currentRate = basePerMillRates[millId];

      // Calculate this mill's share based on its current load percentage
      const share = selectedTotalRate > 0 ? currentRate / selectedTotalRate : 0;

      // Calculate the required rate for this mill to meet the target
      // This is the mill's proportional share of the required total rate
      const requiredShiftRate = requiredSelectedShiftRate * share;
      const requiredDayRate = requiredSelectedDayRate * share;

      // Calculate adjustment needed (can be positive or negative)
      const adjustmentNeeded = requiredShiftRate - currentRate;

      perMillSetpoints.push({
        millId,
        currentRate,
        requiredShiftRate,
        requiredDayRate,
        adjustmentNeeded, // Add adjustment to the data
      });
    });

    // Add fixed mills with zero adjustment (excluded from optimization)
    fixedMills.forEach((millId) => {
      const currentRate = basePerMillRates[millId];

      perMillSetpoints.push({
        millId,
        currentRate,
        requiredShiftRate: currentRate, // Keep at current rate
        requiredDayRate: currentRate, // Keep at current rate
        adjustmentNeeded: 0, // No adjustment for fixed mills
      });
    });

    // Debug logging
    if (perMillSetpoints.length > 0) {
      const totalAdjustment = perMillSetpoints.reduce(
        (sum, sp) => sum + sp.adjustmentNeeded,
        0
      );
      console.log("📊 Per-mill setpoints calculated:", {
        adjustableMills: adjustableMills.length,
        fixedMills: fixedMills.length,
        selectedForExclusion:
          selectedMills.length === 0
            ? "NONE (all adjustable)"
            : selectedMills.join(", "),
        totalCurrentRate: selectedTotalRate.toFixed(1) + " t/h",
        requiredTotalRate: requiredSelectedShiftRate.toFixed(1) + " t/h",
        totalAdjustment: totalAdjustment.toFixed(1) + " t/h",
        perMillDetails: perMillSetpoints.map((sp) => ({
          mill: sp.millId,
          current: sp.currentRate.toFixed(1),
          required: sp.requiredShiftRate.toFixed(1),
          adjustment: sp.adjustmentNeeded.toFixed(1),
          share: ((sp.currentRate / selectedTotalRate) * 100).toFixed(1) + "%",
        })),
      });
    }

    const next: Forecast = {
      shiftInfo,
      hoursToShiftEnd,
      hoursToEndOfDay,
      productionSoFar,
      productionToday,
      forecastShiftOptimistic,
      forecastShiftExpected,
      forecastShiftPessimistic,
      forecastDayOptimistic,
      forecastDayExpected,
      forecastDayPessimistic,
      requiredRateShift,
      requiredRateDay,
      requiredRateShiftAdjusted,
      requiredRateDayAdjusted,
      hourlyForecast: hourlyTonnageForecast,
      uncertainty,
      expectedStoppages,
      expectedDowntime,
      canMeetShiftTarget: forecastShiftExpected >= shiftTarget,
      canMeetDayTarget: forecastDayExpected >= dayTarget,
      perMillSetpoints,
      oreFeedTimeline,
    };

    setForecast(next);
  }, [
    currentTime,
    shiftTarget,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyPercent,
    mills,
    selectedMills,
    actualShiftProduction,
    actualDayProduction,
    millOreRates,
  ]);

  return useMemo(() => ({ currentTime, forecast }), [currentTime, forecast]);
};
