"use client";

import { KPICard } from "./kpi-card";
import type { AggregateMetrics } from "../lib/downtime-types";
import {
  Activity,
  Clock,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Gauge,
} from "lucide-react";

interface OverviewStatsProps {
  metrics: AggregateMetrics;
  isLoading?: boolean;
}

export function OverviewStats({ metrics, isLoading }: OverviewStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 bg-card border border-border rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        title="Средна наличност"
        value={metrics.avgAvailability.toFixed(1)}
        unit="%"
        icon={<Activity className="h-5 w-5" />}
        trendDirection="good"
      />
      <KPICard
        title="Среден MTBF"
        value={metrics.avgMtbf.toFixed(0)}
        unit="h"
        icon={<Clock className="h-5 w-5" />}
        trendDirection="good"
      />
      <KPICard
        title="Среден MTTR"
        value={metrics.avgMttr.toFixed(1)}
        unit="h"
        icon={<Wrench className="h-5 w-5" />}
        trendDirection="neutral"
      />
      <KPICard
        title="Общ престой"
        value={metrics.totalDowntimeHours.toFixed(0)}
        unit="h"
        icon={<AlertTriangle className="h-5 w-5" />}
        trendDirection="neutral"
      />
      <KPICard
        title="Незначителни"
        value={metrics.totalMinorDowntimes}
        icon={<CheckCircle className="h-5 w-5" />}
        trendDirection="neutral"
      />
      <KPICard
        title="Значителни"
        value={metrics.totalMajorDowntimes}
        icon={<Gauge className="h-5 w-5" />}
        trendDirection="neutral"
      />
    </div>
  );
}
