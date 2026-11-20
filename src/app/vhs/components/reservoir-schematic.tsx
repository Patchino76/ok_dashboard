"use client";

import type { Measurement } from "./dashboard-types";
import { cn } from "@/lib/utils";

export type ReservoirTank = {
  name: string;
  tag?: string;
  value: number | null;
  ph?: number | null;
  phTag?: string;
  temp?: number | null;
  tempTag?: string;
};

const TICKS = [0, 1, 2, 3, 4];
const MAX = 4;

const PIPE = "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]";

function Valve() {
  return (
    <svg viewBox="0 0 32 26" className="h-5 w-6 shrink-0" aria-hidden>
      <path
        d="M9 9 A7 7 0 0 1 23 9 Z"
        className="fill-slate-400"
        stroke="#e2e8f0"
        strokeWidth="1"
      />
      <path d="M16 9 V13" stroke="#e2e8f0" strokeWidth="1.5" />
      <path
        d="M3 13 L16 19 L3 25 Z M29 13 L16 19 L29 25 Z"
        className="fill-slate-400"
        stroke="#e2e8f0"
        strokeWidth="1"
      />
    </svg>
  );
}

function ArrowUp() {
  return (
    <span className="absolute -top-0.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[8px] border-x-transparent border-b-emerald-400" />
  );
}

function UConnector({ left, width }: { left: string; width: string }) {
  return (
    <div className="absolute bottom-0 h-7" style={{ left, width }}>
      <span className={cn("absolute bottom-0 inset-x-0 h-[3px]", PIPE)} />
      <span className={cn("absolute bottom-0 left-0 top-0 w-[3px]", PIPE)}>
        <ArrowUp />
      </span>
      <span className={cn("absolute bottom-0 right-0 top-0 w-[3px]", PIPE)}>
        <ArrowUp />
      </span>
      <span className="absolute bottom-[-4px] left-1/2 -translate-x-1/2">
        <Valve />
      </span>
    </div>
  );
}

function Readout({
  value,
  unit,
  decimals = 2,
  tag,
  onClick,
}: {
  value: number | null | undefined;
  unit: string;
  decimals?: number;
  tag?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      data-tag={tag ?? ""}
      onClick={onClick}
      className="flex items-baseline justify-between gap-1 rounded-md border border-white/15 bg-slate-950/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-50 backdrop-blur hover:border-emerald-300/60"
    >
      {value == null ? "—" : value.toFixed(decimals)}
      <span className="text-[9px] font-normal text-slate-400">{unit}</span>
    </button>
  );
}

function Tank({
  tank,
  onSelect,
}: {
  tank: ReservoirTank;
  onSelect: (m: Measurement) => void;
}) {
  const pct =
    tank.value == null ? 0 : Math.max(0, Math.min(100, (tank.value / MAX) * 100));
  const select = (name: string, value: number | null | undefined, unit: string, tag?: string) =>
    value != null && onSelect({ name, value, unit, tone: "recycle", tag });

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="text-[10px] text-slate-400">{tank.name}</span>
      <div className="flex w-full items-stretch gap-1">
        <div className="flex h-28 w-5 shrink-0 flex-col justify-between py-0.5 text-right text-[9px] leading-none text-slate-400">
          {TICKS.slice()
            .reverse()
            .map((t) => (
              <span key={t}>{t}</span>
            ))}
        </div>
        <div className="relative h-28 min-w-0 flex-1 overflow-hidden rounded-b-lg rounded-t-sm border border-white/25 bg-slate-950/70 shadow-inner">
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-700 via-emerald-500 to-lime-300/90 transition-[height] duration-700"
            style={{ height: `${pct}%` }}
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-white/60 blur-[1px]" />
          </div>
          {TICKS.map((t) => (
            <span
              key={t}
              className="absolute left-0 h-px w-2 bg-white/50"
              style={{ bottom: `${(t / MAX) * 100}%` }}
            />
          ))}
          <div className="absolute inset-x-1 top-1 flex flex-col gap-1">
            <Readout
              value={tank.value}
              unit="m"
              tag={tank.tag}
              onClick={() => select(tank.name, tank.value, "m", tank.tag)}
            />
            {tank.ph !== undefined && (
              <Readout
                value={tank.ph}
                unit="pH"
                decimals={3}
                tag={tank.phTag}
                onClick={() => select("pH", tank.ph, "", tank.phTag)}
              />
            )}
            {tank.temp !== undefined && (
              <Readout
                value={tank.temp}
                unit="°C"
                decimals={1}
                tag={tank.tempTag}
                onClick={() => select("Температура", tank.temp, "°C", tank.tempTag)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReservoirSchematic({
  top,
  bottom,
  onSelect,
}: {
  top: [ReservoirTank, ReservoirTank];
  bottom: ReservoirTank[];
  onSelect: (m: Measurement) => void;
}) {
  const n = bottom.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-stretch gap-1">
        <Tank tank={top[0]} onSelect={onSelect} />
        <div className="relative w-20 shrink-0">
          <span
            className={cn("absolute inset-x-0 bottom-12 h-[3px]", PIPE)}
          />
          <span className="absolute bottom-12 right-0 h-0 w-0 translate-y-[3.5px] border-y-[5px] border-l-[8px] border-y-transparent border-l-emerald-400" />
          <span className="absolute bottom-[44px] left-1/2 -translate-x-1/2">
            <Valve />
          </span>
        </div>
        <Tank tank={top[1]} onSelect={onSelect} />
      </div>
      <div className="relative pb-9">
        <div className="flex items-start gap-2">
          {bottom.map((t) => (
            <Tank key={t.name} tank={t} onSelect={onSelect} />
          ))}
        </div>
        {bottom.slice(0, -1).map((t, i) => (
          <UConnector
            key={t.name}
            left={`${((i + 0.62) / n) * 100}%`}
            width={`${(0.76 / n) * 100}%`}
          />
        ))}
      </div>
    </div>
  );
}
