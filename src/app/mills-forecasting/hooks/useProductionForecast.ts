"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Forecast,
  ShiftInfo,
  Uncertainty,
  UseProductionForecastArgs,
  PerMillSetpoint,
  OreFeedTimelinePoint,
  HourlyForecastPoint,
} from "../types/forecasting";
import { UNCERTAINTY_LEVELS } from "../constants";

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
    uncertaintyLevel,
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

    const uncertainty = UNCERTAINTY_LEVELS[uncertaintyLevel];

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
      const isCurrent = Math.abs(hoursFromStart - hoursSince6AM) < 0.5; // Within 30 min

      // Tonnage forecast over the day (for ProductionForecastChart)
      hourlyTonnageForecast.push({
        time: timeLabel,
        actual: isCurrent ? productionToday : null,
        optimistic:
          productionToday +
          (hoursFromStart - hoursSince6AM) * adjustedOreRate * optimisticFactor,
        expected:
          productionToday +
          (hoursFromStart - hoursSince6AM) * adjustedOreRate * expectedFactor,
        pessimistic:
          productionToday +
          (hoursFromStart - hoursSince6AM) *
            adjustedOreRate *
            pessimisticFactor,
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

    // selectedMills are INCLUDED for adjustment.
    // If empty, all mills are adjustable.
    const adjustableMills =
      selectedMills.length === 0
        ? Object.keys(basePerMillRates)
        : selectedMills.filter((m) => m in basePerMillRates);

    // Fixed mills are those NOT in the adjustable list
    const fixedMills = Object.keys(basePerMillRates).filter(
      (m) => !adjustableMills.includes(m)
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

    adjustableMills.forEach((millId) => {
      const currentRate = basePerMillRates[millId];
      const share = selectedTotalRate > 0 ? currentRate / selectedTotalRate : 0;

      // Calculate the required rate for this mill to meet the target
      // This is the mill's proportional share of the required total rate
      const requiredShiftRate = requiredSelectedShiftRate * share;
      const requiredDayRate = requiredSelectedDayRate * share;

      perMillSetpoints.push({
        millId,
        currentRate,
        requiredShiftRate,
        requiredDayRate,
      });
    });

    // Debug logging
    if (perMillSetpoints.length > 0) {
      console.log("📊 Per-mill setpoints calculated:", {
        adjustableMills: adjustableMills.length,
        totalCurrent: selectedTotalRate.toFixed(1),
        requiredTotal: requiredSelectedShiftRate.toFixed(1),
        sample: perMillSetpoints[0],
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
    uncertaintyLevel,
    mills,
    selectedMills,
    actualShiftProduction,
    actualDayProduction,
    millOreRates,
  ]);

  return useMemo(() => ({ currentTime, forecast }), [currentTime, forecast]);
};
