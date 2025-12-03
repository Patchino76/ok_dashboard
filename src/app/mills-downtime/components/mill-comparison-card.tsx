"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MillMetrics, AggregateMetrics } from "../lib/downtime-types";

interface MillComparisonCardProps {
  millMetrics: MillMetrics;
  aggregateMetrics: AggregateMetrics;
}

interface ComparisonItem {
  label: string;
  millValue: number;
  avgValue: number;
  unit: string;
  higherIsBetter: boolean;
}

export function MillComparisonCard({
  millMetrics,
  aggregateMetrics,
}: MillComparisonCardProps) {
  const millDisplayId = millMetrics.millId.replace("Mill", "MA");

  const comparisons: ComparisonItem[] = [
    {
      label: "Коеф. движение",
      millValue: millMetrics.availability,
      avgValue: aggregateMetrics.avgAvailability,
      unit: "%",
      higherIsBetter: true,
    },
    {
      label: "MTBF",
      millValue: millMetrics.mtbf,
      avgValue: aggregateMetrics.avgMtbf,
      unit: "h",
      higherIsBetter: true,
    },
    {
      label: "MTTR",
      millValue: millMetrics.mttr,
      avgValue: aggregateMetrics.avgMttr,
      unit: "h",
      higherIsBetter: false,
    },
    {
      label: "Общ престой",
      millValue: millMetrics.totalDowntime,
      avgValue:
        aggregateMetrics.totalDowntimeHours / aggregateMetrics.totalMillsCount,
      unit: "h",
      higherIsBetter: false,
    },
    {
      label: "Брой събития",
      millValue: millMetrics.totalEvents,
      avgValue: aggregateMetrics.totalEvents / aggregateMetrics.totalMillsCount,
      unit: "",
      higherIsBetter: false,
    },
  ];

  const getComparisonStatus = (item: ComparisonItem) => {
    const diff = item.millValue - item.avgValue;
    const percentDiff =
      item.avgValue !== 0
        ? (diff / item.avgValue) * 100
        : diff > 0
        ? 100
        : diff < 0
        ? -100
        : 0;

    // Determine if this is good or bad
    const isGood = item.higherIsBetter ? diff >= 0 : diff <= 0;
    const isBetter = item.higherIsBetter ? diff > 0 : diff < 0;
    const isWorse = item.higherIsBetter ? diff < 0 : diff > 0;

    return {
      diff,
      percentDiff,
      isGood,
      isBetter,
      isWorse,
      isNeutral: Math.abs(percentDiff) < 5,
    };
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">
          Сравнение със средното - {millDisplayId}
        </CardTitle>
        <CardDescription>
          Как се представя тази мелница спрямо средното за всички мелници
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {comparisons.map((item, index) => {
            const status = getComparisonStatus(item);

            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="text-xs text-muted-foreground">
                      <span className="text-foreground font-semibold">
                        {item.millValue.toFixed(1)}
                        {item.unit}
                      </span>{" "}
                      (тази мелница)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-muted-foreground">
                        {item.avgValue.toFixed(1)}
                        {item.unit}
                      </span>{" "}
                      (средно)
                    </div>
                  </div>
                </div>

                {/* Comparison indicator */}
                <div className="flex items-center gap-2">
                  {status.isNeutral ? (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Minus className="h-4 w-4" />
                      <span className="text-sm">≈ средно</span>
                    </div>
                  ) : status.isBetter ? (
                    <div className="flex items-center gap-1 text-green-500">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        +{Math.abs(status.percentDiff).toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-500">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        -{Math.abs(status.percentDiff).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall assessment */}
        <div className="mt-4 p-3 rounded-lg border border-border bg-secondary/10">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Обща оценка: </span>
            {(() => {
              const betterCount = comparisons.filter(
                (item) => getComparisonStatus(item).isBetter
              ).length;
              const worseCount = comparisons.filter(
                (item) => getComparisonStatus(item).isWorse
              ).length;

              if (betterCount > worseCount + 1) {
                return (
                  <span className="text-green-500">
                    Над средното ниво - мелницата се представя добре
                  </span>
                );
              } else if (worseCount > betterCount + 1) {
                return (
                  <span className="text-red-500">
                    Под средното ниво - нужно е внимание
                  </span>
                );
              } else {
                return (
                  <span className="text-yellow-500">Около средното ниво</span>
                );
              }
            })()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
