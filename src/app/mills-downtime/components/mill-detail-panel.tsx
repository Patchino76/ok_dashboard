"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  MillMetrics,
  DowntimeEvent,
  AggregateMetrics,
  TimeRange,
} from "../lib/downtime-types";
import { MILLS } from "../lib/downtime-utils";
import { TIME_RANGE_OPTIONS } from "../lib/downtime-types";
import { OreRateChart } from "./ore-rate-chart";
import { DowntimeTimelineChart } from "./downtime-timeline-chart";
import { MillComparisonCard } from "./mill-comparison-card";
import { EventsTable } from "./events-table";
import { X, Activity, Clock, Wrench, Gauge, AlertTriangle } from "lucide-react";

interface MillDetailPanelProps {
  millId: string;
  metrics: MillMetrics | null;
  events: DowntimeEvent[];
  feedRateData: Array<{ time: string; feedRate: number }>;
  downtimeThreshold: number;
  aggregateMetrics: AggregateMetrics;
  timeRange: TimeRange;
  onClose: () => void;
  isLoading?: boolean;
}

export function MillDetailPanel({
  millId,
  metrics,
  events,
  feedRateData,
  downtimeThreshold,
  aggregateMetrics,
  timeRange,
  onClose,
  isLoading,
}: MillDetailPanelProps) {
  const mill = MILLS.find((m) => m.id === millId);
  const days =
    TIME_RANGE_OPTIONS.find((t) => t.value === timeRange)?.days || 30;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-card border border-border rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Няма данни за избраната мелница
      </div>
    );
  }

  const millDisplayId = millId.replace("Mill", "MA");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Мелница {millDisplayId}
          </h2>
          <p className="text-muted-foreground">
            {mill?.section} • Капацитет: {mill?.normalFeedRate || 160} t/h
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Коеф. движение</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {metrics.availability.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">MTBF</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {metrics.mtbf.toFixed(1)}h
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wrench className="h-4 w-4" />
              <span className="text-sm">MTTR</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {metrics.mttr.toFixed(1)}h
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Gauge className="h-4 w-4" />
              <span className="text-sm">Ефективност</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {metrics.feedEfficiency.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Downtime Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Общ престой</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {metrics.totalDowntime.toFixed(1)} часа
            </p>
            <p className="text-sm text-muted-foreground">
              {metrics.totalEvents} събития за {days} дни
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">
                Кратки
              </Badge>
              <span className="text-sm text-muted-foreground">
                {"<"} 60 мин
              </span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {metrics.minorDowntimes} събития
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                ППР
              </Badge>
              <span className="text-sm text-muted-foreground">≥ 60 мин</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {metrics.majorDowntimes} събития
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Downtime Timeline Chart */}
      <DowntimeTimelineChart events={events} millId={millId} days={days} />

      {/* Ore Rate Chart */}
      {feedRateData.length > 0 && (
        <OreRateChart
          data={feedRateData}
          millId={millId}
          downtimeThreshold={downtimeThreshold}
          days={days}
        />
      )}

      {/* Comparison with Average */}
      <MillComparisonCard
        millMetrics={metrics}
        aggregateMetrics={aggregateMetrics}
      />

      {/* Events Table */}
      <EventsTable
        events={events.slice(0, 5)}
        showMill={false}
        title={`Последни събития - ${millDisplayId}`}
        description="Последни инциденти с престой на тази мелница"
      />
    </div>
  );
}
