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

const uncertaintyConfig: Record<1 | 2 | 3, Uncertainty> = {
  1: {
    name: "Low",
    color: "#10b981",
    factor: 0.95,
    stoppageProb: 0.05,
    avgStoppage: 5,
  },
  2: {
    name: "Medium",
    color: "#f59e0b",
    factor: 0.9,
    stoppageProb: 0.12,
    avgStoppage: 10,
  },
  3: {
    name: "High",
    color: "#ef4444",
    factor: 0.82,
    stoppageProb: 0.2,
    avgStoppage: 20,
  },
};

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

    const hoursIntoShift = 8 - hoursToShiftEnd;
    const productionSoFar = hoursIntoShift * currentOreRate;

    const hour = currentTime.getHours();
    const hoursIntoDay =
      hour >= 6
        ? hour - 6 + currentTime.getMinutes() / 60
        : 24 - 6 + hour + currentTime.getMinutes() / 60;
    const productionToday = hoursIntoDay * currentOreRate;

    const uncertainty = uncertaintyConfig[uncertaintyLevel];

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
    const currentHour = currentTime.getHours();

    for (let i = 0; i <= Math.ceil(hoursToEndOfDay); i++) {
      const targetHour = (currentHour + i) % 24;
      const timeLabel = `${String(targetHour).padStart(2, "0")}:00`;

      // Tonnage forecast over the day (for ProductionForecastChart)
      hourlyTonnageForecast.push({
        time: timeLabel,
        actual: i === 0 ? productionToday : null,
        optimistic: productionToday + i * adjustedOreRate * optimisticFactor,
        expected: productionToday + i * adjustedOreRate * expectedFactor,
        pessimistic: productionToday + i * adjustedOreRate * pessimisticFactor,
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

    const basePerMillRates: Record<string, number> = {};
    mills.forEach((millId) => {
      if (millId === "all") return;
      basePerMillRates[millId] = currentOreRate;
    });

    // selectedMills are EXCLUDED from adjustment.
    const excludedMills = selectedMills.filter((m) => m in basePerMillRates);
    const adjustableMills = Object.keys(basePerMillRates).filter(
      (m) => !excludedMills.includes(m)
    );

    const fixedMills = excludedMills;

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
      const requiredShiftRate =
        requiredSelectedShiftRate > 0 ? requiredSelectedShiftRate * share : 0;
      const requiredDayRate =
        requiredSelectedDayRate > 0 ? requiredSelectedDayRate * share : 0;

      perMillSetpoints.push({
        millId,
        currentRate,
        requiredShiftRate,
        requiredDayRate,
      });
    });

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
  ]);

  return useMemo(() => ({ currentTime, forecast }), [currentTime, forecast]);
};
