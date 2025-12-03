"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MillMetrics } from "../lib/downtime-types";
import { getStatusColor } from "../lib/downtime-utils";
import { Activity, Clock, Wrench } from "lucide-react";

interface MillGridProps {
  millMetrics: MillMetrics[];
  onSelectMill: (millId: string) => void;
  selectedMill?: string;
  isLoading?: boolean;
}

export function MillGrid({
  millMetrics,
  onSelectMill,
  selectedMill,
  isLoading,
}: MillGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-40 bg-card border border-border rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {millMetrics.map((metrics) => {
        const isSelected = selectedMill === metrics.millId;

        return (
          <Card
            key={metrics.millId}
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:border-primary/50",
              isSelected && "border-primary ring-1 ring-primary"
            )}
            onClick={() => onSelectMill(metrics.millId)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg text-foreground">
                  {metrics.millId.replace("Mill", "MA")}
                </span>
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    metrics.isRunning
                      ? getStatusColor(metrics.availability)
                      : "bg-gray-500"
                  )}
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Наличност
                  </span>
                  <span className="font-mono text-foreground">
                    {metrics.availability.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    MTBF
                  </span>
                  <span className="font-mono text-foreground">
                    {metrics.mtbf.toFixed(0)}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    MTTR
                  </span>
                  <span className="font-mono text-foreground">
                    {metrics.mttr.toFixed(1)}h
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-1">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-500 border-orange-500/30"
                >
                  Кратки: {metrics.minorDowntimes}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-500 border-red-500/30"
                >
                  ППР: {metrics.majorDowntimes}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
