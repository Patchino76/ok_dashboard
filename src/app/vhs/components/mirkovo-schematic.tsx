"use client";

import type { Measurement, WaterTone } from "./dashboard-types";
import { LevelGauge } from "./level-gauge";
import { PumpStatus, type Pump } from "./pump-status";
import { cn } from "@/lib/utils";
import {
  Arrow,
  HLine,
  PIPE,
  Pos,
  Readout,
  VLine,
  Valve,
  type KarlievoValve,
} from "./karlievo-schematic";

const Y_HEADER = 30;

function DialReadout({
  name,
  value,
  tag,
  tone,
  max,
  side,
  onSelect,
}: {
  side?: "left" | "right";
  name: string;
  value: number | null;
  tag?: string;
  tone: WaterTone;
  max: number;
  onSelect: (m: Measurement) => void;
}) {
  const color = value === null ? "#64748b" : "#38bdf8";
  const angle = -120 + Math.max(0, Math.min(1, (value ?? 0) / max)) * 240;
  const rad = ((angle - 90) * Math.PI) / 180;
  const chip = (
    <button
      type="button"
      data-tag={tag ?? ""}
      title={name}
      onClick={() => value !== null && onSelect({ name, value, unit: "bar", tone, tag })}
      className="flex items-baseline gap-1 whitespace-nowrap rounded-md border border-white/15 bg-slate-950/80 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-50 hover:border-sky-300/60"
    >
      {value === null ? "—" : value.toFixed(2)}
      <span className="text-[9px] font-normal text-slate-400">bar</span>
    </button>
  );
  const stub = <span className="h-[2px] w-2 shrink-0" style={{ background: color }} />;
  const dial = (
    <svg viewBox="-10 -10 20 20" className="h-5 w-5 shrink-0" aria-hidden>
      <circle r="8.5" fill="#0b1220" stroke={color} strokeWidth="1.5" />
      <circle r="6" fill="none" stroke={color} strokeOpacity=".35" strokeDasharray="1.5 2" />
      <line x2={Math.cos(rad) * 5.5} y2={Math.sin(rad) * 5.5} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle r="1.3" fill={color} />
    </svg>
  );
  return (
    <div className="flex items-center gap-1">
      {side === "left" ? (
        <div className="relative flex items-center gap-1 pr-2">
          <span className="absolute left-2.5 right-0 top-1/2 h-[2px] -translate-y-1/2" style={{ background: color }} />
          <span className="relative">{dial}</span>
          <span className="relative [&>button]:bg-slate-950">{chip}</span>
        </div>
      ) : side === "right" ? (
        <>
          {stub}
          {dial}
          {chip}
        </>
      ) : (
        <>
          {chip}
          {dial}
        </>
      )}
    </div>
  );
}

export function MirkovoSchematic({
  level,
  levelTag,
  inletPressure,
  inletTag,
  pressure,
  pressureTag,
  valves,
  pumps,
  station,
  tone = "fresh",
  hideTop = false,
  dialMax,
  extraPumps,
  onSelect,
}: {
  level?: number | null;
  levelTag?: string;
  inletPressure?: number | null;
  inletTag?: string;
  pressure: number | null;
  pressureTag?: string;
  valves: KarlievoValve[];
  pumps: Pump[];
  station: string;
  tone?: WaterTone;
  hideTop?: boolean;
  dialMax?: number;
  extraPumps?: Pump[];
  onSelect: (m: Measurement) => void;
}) {
  const withPressure = valves.some((v) => v.pressure !== undefined);
  const HEIGHT = withPressure ? 150 : 130;
  const yValve = withPressure ? Y_HEADER + 80 : Y_HEADER + 50;
  const n = valves.length;
  const col = (i: number) => `${((i + 0.5) / n) * 100}%`;

  return (
    <div className="flex flex-col gap-2">
      {!hideTop && <div className="flex items-center justify-center gap-1">
        <div className="flex w-24 shrink-0 flex-col gap-1">
          {inletPressure !== undefined && <Readout name="Входящ тръбопровод" value={inletPressure} unit="bar" tag={inletTag} tone={tone} decimals={3} onSelect={onSelect} />}
          <div className="relative h-[3px]">
            <span className={cn("absolute inset-0", PIPE)} />
            <Arrow left="calc(100% - 8px)" top="50%" dir="right" />
          </div>
          {inletPressure !== undefined && <span className="text-[10px] leading-tight text-slate-400">Входящ тръбопровод</span>}
        </div>
        <LevelGauge name="Ниво" value={level ?? null} tone={tone} tag={levelTag} onSelect={onSelect} />
      </div>}

      <div className="ml-2 mr-2" style={dialMax ? { marginRight: 64 } : undefined}>
        <div className="relative" style={{ height: HEIGHT }}>
          <HLine from={col(0)} to={`calc(100% + ${dialMax ? 64 : 8}px)`} top={Y_HEADER} />
          <Arrow left={dialMax ? "calc(100% + 52px)" : "96%"} top={Y_HEADER} dir="right" />
          <Pos left="50%" top={Y_HEADER - 16}>
            {dialMax ? (
              <DialReadout name="Налягане" value={pressure} tag={pressureTag} tone={tone} max={dialMax} onSelect={onSelect} />
            ) : (
              <Readout name="Налягане" value={pressure} unit="bar" tag={pressureTag} tone={tone} onSelect={onSelect} />
            )}
          </Pos>
          {valves.map((v, i) => (
            <div key={v.name}>
              <VLine left={col(i)} from={Y_HEADER} to={HEIGHT} />
              <Arrow left={col(i)} top={Y_HEADER + 4} dir="up" />
              {v.pressure !== undefined &&
                (dialMax ? (
                  <div
                    className="absolute"
                    style={{
                      left: col(i),
                      top: Y_HEADER + 34,
                      transform: "translate(-1px, -50%)",
                    }}
                  >
                    <DialReadout name={`Налягане ${v.name}`} value={v.pressure ?? null} tag={v.pressureTag} tone={tone} max={dialMax} side="right" onSelect={onSelect} />
                  </div>
                ) : (
                  <Pos left={col(i)} top={Y_HEADER + 34}>
                    <Readout name={`Налягане ${v.name}`} value={v.pressure ?? null} unit="bar" tag={v.pressureTag} tone={tone} onSelect={onSelect} />
                  </Pos>
                ))}
              <Valve valve={v} left={col(i)} top={yValve} vertical tone={tone} onSelect={onSelect} />
            </div>
          ))}
        </div>
        <PumpStatus pumps={pumps} station={station} aligned onSelect={onSelect} />
        {extraPumps && <PumpStatus pumps={extraPumps} station={station} onSelect={onSelect} />}
      </div>
    </div>
  );
}
