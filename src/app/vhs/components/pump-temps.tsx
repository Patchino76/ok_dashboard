"use client";

import { cn } from "@/lib/utils";

export type PumpTemp = {
  name: string;
  tag: string;
  value: number | null;
  color: string;
};

const MIN = 0;
const MAX = 60;
const DANGER = 45;
const GRID = [15, 30, DANGER];

const pct = (v: number) =>
  ((Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN)) * 100;

const tempTone = (v: number | null) =>
  v === null
    ? "text-slate-500"
    : v >= DANGER
      ? "text-red-400"
      : v >= 35
        ? "text-amber-300"
        : "text-emerald-300";

export function PumpTemps({
  temps,
  running,
}: {
  temps: PumpTemp[];
  running: boolean;
}) {
  const valid = temps.filter(
    (t): t is PumpTemp & { value: number } => t.value !== null,
  );
  const max = valid.length ? Math.max(...valid.map((t) => t.value)) : null;
  const avg = valid.length
    ? valid.reduce((s, t) => s + t.value, 0) / valid.length
    : null;
  const n = temps.length;

  return (
    <div className="flex flex-col items-center gap-1" role="group" aria-label="Температури">
      <span
        className={cn(
          "text-sm font-semibold leading-none tabular-nums",
          tempTone(max),
        )}
      >
        <span className="mr-0.5 text-[10px] font-normal text-slate-400">max</span>
        {max === null ? "—" : `${Math.round(max)}°`}
      </span>
      <div
        className={cn(
          "relative h-28 w-11 overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/70 shadow-inner",
          !running && "opacity-70",
        )}
      >
        <div
          className="absolute inset-x-0 top-0 bg-red-500/20"
          style={{ height: `${100 - pct(DANGER)}%` }}
        />
        {GRID.map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 border-t border-slate-600/50"
            style={{ bottom: `${pct(g)}%` }}
          />
        ))}
        {avg !== null && (
          <div
            className="absolute inset-x-0 border-t border-dashed border-slate-200/80"
            style={{ bottom: `${pct(avg)}%` }}
          />
        )}
        {temps.map((t, i) =>
          t.value === null ? null : (
            <span
              key={t.tag}
              data-tag={t.tag}
              title={`${t.name}: ${t.value.toFixed(0)} °C`}
              className="absolute size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-1 ring-slate-950/60 transition-all duration-500"
              style={{
                left: `${n > 1 ? 16 + (i / (n - 1)) * 68 : 50}%`,
                bottom: `${pct(t.value)}%`,
                backgroundColor: t.color,
                boxShadow: `0 0 6px ${t.color}`,
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

export function PumpAvg({ temps }: { temps: PumpTemp[] }) {
  const v = temps.map((t) => t.value).filter((x): x is number => x !== null);
  const avg = v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  return (
    <span className="text-[10px] leading-none tabular-nums text-slate-400">
      avg {avg === null ? "—" : `${Math.round(avg)}°`}
    </span>
  );
}
