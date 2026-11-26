"use client";

import type { Measurement } from "./dashboard-types";
import { LevelGauge } from "./level-gauge";
import { DialReadout } from "./dial-readout";
import { PumpStatus, type Pump } from "./pump-status";
import { cn } from "@/lib/utils";

export type KarlievoValve = {
  name: string;
  tag?: string;
  value?: number | null;
  pressure?: number | null;
  pressureTag?: string;
};

export const PIPE_GREEN = "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]";
export const PIPE = "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]";
const L = "16.667%";
const C = "50%";
const R = "83.333%";
const Y_HEADER = 30;
const Y_MANIFOLD = 138;

function valveColor(p: number | null | undefined) {
  if (p == null) return "#64748b";
  if (p <= 1) return "#94a3b8";
  return "#34d399";
}

function ValveIcon({ color, vertical }: { color: string; vertical: boolean }) {
  return (
    <svg
      viewBox="0 -3 32 44"
      className="h-[33px] w-6 max-w-none shrink-0 overflow-visible"
      style={vertical ? { transform: "rotate(90deg)" } : undefined}
      aria-hidden
    >
      <path d="M9 9 A7 7 0 0 1 23 9 Z" fill={color} stroke="#e2e8f0" strokeWidth="1" />
      <path d="M16 9 V13" stroke="#e2e8f0" strokeWidth="1.5" />
      <path
        d="M3 13 L16 19 L3 25 Z M29 13 L16 19 L29 25 Z"
        fill={color}
        stroke="#e2e8f0"
        strokeWidth="1"
      />
    </svg>
  );
}

function Pct({ value }: { value: number | null | undefined }) {
  return (
    <span className="rounded border border-white/15 bg-slate-950/80 px-1 text-[10px] font-semibold tabular-nums text-slate-50">
      {value == null ? "—" : `${Math.round(value)}%`}
    </span>
  );
}

export function Pos({
  left,
  top,
  children,
}: {
  left: string;
  top: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left, top }}
    >
      {children}
    </div>
  );
}

export function Valve({
  valve,
  left,
  top,
  vertical,
  tone,
  onSelect,
}: {
  valve: KarlievoValve;
  left: string;
  top: number;
  vertical: boolean;
  tone: Measurement["tone"];
  onSelect: (m: Measurement) => void;
}) {
  const v = valve.value ?? null;
  return (
    <Pos left={left} top={top}>
      <button
        type="button"
        data-tag={valve.tag ?? ""}
        title={`Клапа ${valve.name}`}
        className="relative flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/10"
        onClick={() =>
          v != null &&
          onSelect({ name: `Клапа ${valve.name}`, value: Math.round(v), unit: "%", tone, tag: valve.tag })
        }
      >
        <ValveIcon color={valveColor(v)} vertical={vertical} />
        <span
          className={cn(
            "absolute",
            vertical ? "left-full ml-1 top-1/2 -translate-y-1/2" : "bottom-full mb-1 left-1/2 -translate-x-1/2",
          )}
        >
          <Pct value={v} />
        </span>
      </button>
    </Pos>
  );
}

export function HLine({ from, to, top, green }: { from: string; to: string; top: number; green?: boolean }) {
  return (
    <span
      className={cn("absolute h-[3px]", green ? PIPE_GREEN : PIPE)}
      style={{ left: from, width: `calc(${to} - ${from})`, top: top - 1.5 }}
    />
  );
}

export function VLine({ left, from, to, green }: { left: string; from: number; to: number; green?: boolean }) {
  return (
    <span
      className={cn("absolute w-[3px] -translate-x-1/2", green ? PIPE_GREEN : PIPE)}
      style={{ left, top: from, height: to - from }}
    />
  );
}

export function Arrow({ left, top, dir, green }: { left: string; top: number | string; dir: "up" | "down" | "right"; green?: boolean }) {
  const cls = {
    up: cn("-translate-x-1/2 border-x-[5px] border-b-[8px] border-x-transparent", green ? "border-b-emerald-400" : "border-b-sky-300"),
    down: cn("-translate-x-1/2 border-x-[5px] border-t-[8px] border-x-transparent", green ? "border-t-emerald-400" : "border-t-sky-300"),
    right: cn("-translate-y-1/2 border-y-[5px] border-l-[8px] border-y-transparent", green ? "border-l-emerald-400" : "border-l-sky-300"),
  }[dir];
  return <span className={cn("absolute h-0 w-0", cls)} style={{ left, top }} />;
}

export function Readout({
  value,
  unit,
  tag,
  name,
  tone,
  decimals = 2,
  onSelect,
}: {
  value: number | null;
  unit: string;
  tag?: string;
  name: string;
  tone: Measurement["tone"];
  decimals?: number;
  onSelect: (m: Measurement) => void;
}) {
  return (
    <button
      type="button"
      data-tag={tag ?? ""}
      onClick={() => value != null && onSelect({ name, value, unit, tone, tag })}
      className="flex items-baseline gap-1 rounded-md border border-white/15 bg-slate-950/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-50 hover:border-sky-300/60"
    >
      {value == null ? "—" : value.toFixed(decimals)}
      <span className="text-[9px] font-normal text-slate-400">{unit}</span>
    </button>
  );
}

export function KarlievoSchematic({
  level,
  levelTag,
  inletPressure,
  inletTag,
  outletPressure,
  outletTag,
  risers,
  manifold,
  pumpValves,
  pumps,
  station,
  onSelect,
}: {
  level: number | null;
  levelTag?: string;
  inletPressure: number | null;
  inletTag?: string;
  outletPressure: number | null;
  outletTag?: string;
  risers: [KarlievoValve, KarlievoValve];
  manifold: [KarlievoValve, KarlievoValve];
  pumpValves: [KarlievoValve, KarlievoValve, KarlievoValve];
  pumps: Pump[];
  station: string;
  onSelect: (m: Measurement) => void;
}) {
  const tone: Measurement["tone"] = "fresh";
  const yPumpValve = 182;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-1">
        <div className="flex w-28 shrink-0 flex-col gap-0">
          <DialReadout name="Входящ тръбопровод" value={inletPressure} tag={inletTag} tone={tone} side="top" onSelect={onSelect} />
          <div className="relative h-[3px]">
            <span className={cn("absolute inset-0", PIPE)} />
            <Arrow left="calc(100% - 8px)" top="50%" dir="right" />
          </div>
          <span className="mt-1 text-[10px] leading-tight text-slate-400">Входящ тръбопровод</span>
        </div>
        <LevelGauge name="Ниво" value={level} tone="fresh" tag={levelTag} onSelect={onSelect} />
      </div>

      <div className="relative mx-2" style={{ height: 206 }}>
        <HLine from={L} to="calc(100% + 8px)" top={Y_HEADER} />
        <VLine left={L} from={Y_HEADER} to={Y_MANIFOLD} />
        <VLine left={R} from={Y_HEADER} to={Y_MANIFOLD} />
        <Arrow left={L} top={Y_HEADER + 4} dir="up" />
        <Arrow left="92%" top={Y_HEADER} dir="right" />
        <Arrow left={R} top={Y_HEADER + 4} dir="up" />

        <HLine from={L} to={R} top={Y_MANIFOLD} />
        <VLine left={L} from={Y_MANIFOLD} to={206} />
        <VLine left={C} from={Y_MANIFOLD} to={206} />
        <VLine left={R} from={Y_MANIFOLD} to={206} />
        <Arrow left={L} top={Y_MANIFOLD + 6} dir="up" />
        <Arrow left={C} top={Y_MANIFOLD + 6} dir="up" />
        <Arrow left={R} top={Y_MANIFOLD + 6} dir="up" />

        <div className="absolute right-0" style={{ top: Y_HEADER - 27 }}>
          <DialReadout name="Налягане" value={outletPressure} tag={outletTag} tone={tone} side="top" onSelect={onSelect} />
        </div>

        <Valve valve={risers[0]} left={L} top={Y_HEADER + 40} vertical tone={tone} onSelect={onSelect} />
        <Valve valve={risers[1]} left={R} top={Y_HEADER + 40} vertical tone={tone} onSelect={onSelect} />
        <Valve valve={manifold[0]} left="33.333%" top={Y_MANIFOLD} vertical={false} tone={tone} onSelect={onSelect} />
        <Valve valve={manifold[1]} left="66.667%" top={Y_MANIFOLD} vertical={false} tone={tone} onSelect={onSelect} />
        <Valve valve={pumpValves[0]} left={L} top={yPumpValve} vertical tone={tone} onSelect={onSelect} />
        <Valve valve={pumpValves[1]} left={C} top={yPumpValve} vertical tone={tone} onSelect={onSelect} />
        <Valve valve={pumpValves[2]} left={R} top={yPumpValve} vertical tone={tone} onSelect={onSelect} />
      </div>

      <div className="mx-2">
        <PumpStatus pumps={pumps} station={station} aligned onSelect={onSelect} />
      </div>
    </div>
  );
}
