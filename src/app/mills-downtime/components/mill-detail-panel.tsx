"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  MillMetrics,
  DowntimeEvent,
  TimeRange,
} from "../lib/downtime-types";
import { MILLS, formatDurationBg } from "../lib/downtime-utils";
import { OreRateChart } from "./ore-rate-chart";
import { EventsTable } from "./events-table";
import { X, Activity, Clock, Wrench, Gauge, AlertTriangle } from "lucide-react";

interface MillDetailPanelProps {
  millId: string;
  metrics: MillMetrics | null;
  events: DowntimeEvent[];
  feedRateData: Array<{ time: string; feedRate: number }>;
  downtimeThreshold: number;
  onClose: () => void;
  isLoading?: boolean;
}

export function MillDetailPanel({
  millId,
  metrics,
  events,
  feedRateData,
  downtimeThreshold,
  onClose,
  isLoading,
}: MillDetailPanelProps) {
  const mill = MILLS.find((m) => m.id === millId);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {mill?.nameBg || millId}
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
              <span className="text-sm">Наличност</span>
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
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Общ престой</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {metrics.totalDowntime.toFixed(1)} часа
            </p>
            <p className="text-sm text-muted-foreground">
              {metrics.totalEvents} събития
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                Незначителни
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
                Значителни
              </Badge>
              <span className="text-sm text-muted-foreground">≥ 60 мин</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {metrics.majorDowntimes} събития
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ore Rate Chart */}
      {feedRateData.length > 0 && (
        <OreRateChart
          data={feedRateData}
          millId={millId}
          downtimeThreshold={downtimeThreshold}
        />
      )}

      {/* Events Table */}
      <EventsTable
        events={events.slice(0, 5)}
        showMill={false}
        title={`Последни престои - ${mill?.nameBg || millId}`}
        description="Последни инциденти с престой на тази мелница"
      />
    </div>
  );
}
