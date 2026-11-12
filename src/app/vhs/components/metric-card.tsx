"use client";

import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Measurement } from "./dashboard-types";
import { cn } from "@/lib/utils";

export function MetricCard({
  measurement,
  onSelect,
  alarm = false,
  className,
}: {
  measurement: Measurement;
  onSelect: (measurement: Measurement) => void;
  alarm?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "group relative gap-1 border-white/10 bg-white/[0.035] p-2 transition-colors hover:border-sky-300/40 hover:bg-white/[0.07]",
        alarm && "border-red-500/50 bg-red-500/10",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 z-10 size-full rounded-xl p-0 hover:bg-transparent"
        aria-label={`Покажи тренд: ${measurement.name}`}
        title="Покажи тренд"
        onClick={() => onSelect(measurement)}
      />
      <span className="truncate text-[10px] leading-tight text-slate-400">
        {measurement.name}
      </span>
      <span
        className={cn(
          "flex items-baseline gap-1 text-[13px] font-semibold leading-tight tabular-nums",
          alarm ? "text-red-300" : "text-slate-50",
        )}
      >
        {measurement.value}
        {measurement.unit && (
          <span className="text-[10px] font-normal text-slate-400">
            {measurement.unit}
          </span>
        )}
      </span>
      <Activity
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1.5 z-20 size-3 text-sky-300 opacity-0 transition-opacity group-hover:opacity-80"
      />
    </Card>
  );
}
