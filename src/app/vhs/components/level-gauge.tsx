"use client";

import type { Measurement, WaterTone } from "./dashboard-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fills: Record<WaterTone, string> = {
  fresh: "from-blue-600 to-sky-300",
  recycle: "from-emerald-600 to-lime-300",
  drain: "from-orange-600 to-amber-300",
  power: "from-yellow-600 to-yellow-300",
  tail: "from-stone-500 to-stone-200",
};

export function LevelGauge({
  name,
  value,
  min = 0,
  max = 4,
  ticks = [0, 1, 2, 3, 4],
  unit = "m",
  tone = "fresh",
  decimals = 2,
  centered = false,
  tag,
  onSelect,
}: {
  name: string;
  value: number | null;
  min?: number;
  max?: number;
  ticks?: number[];
  unit?: string;
  tone: WaterTone;
  decimals?: number;
  centered?: boolean;
  tag?: string;
  onSelect: (measurement: Measurement) => void;
}) {
  const numericValue = value ?? 0;
  const percentage =
    max === min
      ? 0
      : Math.max(0, Math.min(100, ((numericValue - min) / (max - min)) * 100));
  const measurement: Measurement = {
    name,
    value: numericValue,
    unit,
    tone,
    tag,
  };

  return (
    <Button
      type="button"
      variant="ghost"
      data-tag={tag ?? ""}
      className="h-auto shrink-0 flex-col gap-1 rounded-lg px-1.5 py-1 text-slate-100 ring-1 ring-transparent transition-all duration-200 ease-out hover:bg-sky-400/20 hover:bg-sky-400/15 hover:ring-sky-300/70 hover:shadow-md hover:shadow-sky-400/20 active:bg-sky-400/25 active:ring-sky-300"
      aria-label={`Покажи тренд: ${name}`}
      onClick={() => onSelect(measurement)}
    >
      <span className="text-[10px] text-slate-400">{name}</span>
      <span className="relative flex items-end gap-1.5">
        <span
          className={cn(
            "relative flex h-24 w-7 flex-col justify-between py-0.5 text-right text-[9px] leading-none text-slate-400",
            centered && "absolute right-full mr-1.5",
          )}
        >
          {ticks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
        </span>
        <span className="relative h-24 w-8 overflow-hidden rounded-md border border-white/20 bg-slate-950/80">
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 bg-gradient-to-t opacity-90 transition-[height] duration-700",
              fills[tone],
            )}
            style={{ height: `${percentage}%` }}
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-white/70" />
          </span>
          {ticks.map((tick) => {
            const position =
              max === min
                ? 0
                : Math.max(
                    0,
                    Math.min(100, ((tick - min) / (max - min)) * 100),
                  );
            return (
              <span
                key={tick}
                className="absolute inset-x-0 h-px bg-white/25"
                style={{ bottom: `${position}%` }}
              />
            );
          })}
        </span>
      </span>
      <span className="text-xs font-semibold tabular-nums">
        {value === null ? "—" : value.toFixed(decimals)}{" "}
        <span className="font-normal text-slate-400">{unit}</span>
      </span>
    </Button>
  );
}
