import { FC } from "react";
import { MetricCard } from "../shared/MetricCard";
import type { Forecast } from "../../types/forecasting";

interface ProgressSummaryCardsProps {
  forecast: Forecast;
  shiftTarget: number;
  dayTarget: number;
}

export const ProgressSummaryCards: FC<ProgressSummaryCardsProps> = ({
  forecast,
  shiftTarget,
  dayTarget,
}) => {
  const shiftProgress = (
    (forecast.productionSoFar / shiftTarget) *
    100
  ).toFixed(0);
  const dayProgress = ((forecast.productionToday / dayTarget) * 100).toFixed(0);

  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard
        title="Напредък на смяната"
        value={`${forecast.productionSoFar.toFixed(0)}t`}
        subtitle={`${shiftProgress}% от целта`}
      />
      <MetricCard
        title="Дневен напредък"
        value={`${forecast.productionToday.toFixed(0)}t`}
        subtitle={`${dayProgress}% от целта`}
      />
    </div>
  );
};
