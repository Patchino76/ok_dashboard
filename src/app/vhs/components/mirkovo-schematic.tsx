"use client";

import type { Measurement, WaterTone } from "./dashboard-types";
import { DialReadout } from "./dial-readout";
import { LevelGauge } from "./level-gauge";
import { PumpStatus, type Pump } from "./pump-status";
import { cn } from "@/lib/utils";
import {
  Arrow,
  HLine,
  PIPE,
  PIPE_GREEN,
  Pos,
  Readout,
  VLine,
  Valve,
  type KarlievoValve,
} from "./karlievo-schematic";

const Y_HEADER = 30;

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
  inletContent,
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
  inletContent?: React.ReactNode;
  dialMax?: number;
  extraPumps?: Pump[];
  onSelect: (m: Measurement) => void;
}) {
  const green = tone === "recycle";
  const withPressure = valves.some((v) => v.pressure !== undefined);
  const HEIGHT = withPressure ? 150 : 130;
  const yValve = withPressure ? Y_HEADER + 80 : Y_HEADER + 50;
  const n = valves.length;
  const col = (i: number) => `${((i + 0.5) / n) * 100}%`;

  return (
    <div className="flex flex-col gap-2">
      {!hideTop && <div className="flex items-center justify-center gap-1">
        <div className="flex w-28 shrink-0 flex-col gap-0">
          {inletContent && <div className="mb-1 flex flex-col gap-1">{inletContent}</div>}
          {inletPressure !== undefined && <DialReadout name="Входящ тръбопровод" value={inletPressure ?? null} tag={inletTag} tone={tone} side="top" onSelect={onSelect} />}
          <div className="relative h-[3px]">
            <span className={cn("absolute inset-0", green ? PIPE_GREEN : PIPE)} />
            <Arrow green={green} left="calc(100% - 8px)" top="50%" dir="right" />
          </div>
          {(inletPressure !== undefined || inletContent) && <span className="mt-1 text-[10px] leading-tight text-slate-400">Входящ тръбопровод</span>}
        </div>
        <LevelGauge name="Ниво" value={level ?? null} tone={tone} tag={levelTag} onSelect={onSelect} />
      </div>}

      <div className="ml-2 mr-2" style={dialMax ? { marginRight: 64 } : undefined}>
        <div className="relative" style={{ height: HEIGHT }}>
          <HLine green={green} from={col(0)} to={`calc(100% + ${dialMax ? 64 : 8}px)`} top={Y_HEADER} />
          <Arrow green={green} left={dialMax ? "calc(100% + 52px)" : "96%"} top={Y_HEADER} dir="right" />
          <div className="absolute right-0" style={{ top: Y_HEADER - 27 }}>
            <DialReadout name="Налягане" value={pressure} tag={pressureTag} tone={tone} side="top" onSelect={onSelect} />
          </div>
          {valves.map((v, i) => (
            <div key={v.name}>
              <VLine green={green} left={col(i)} from={Y_HEADER} to={HEIGHT} />
              <Arrow green={green} left={col(i)} top={Y_HEADER + 4} dir="up" />
              {v.pressure !== undefined && (
                <div
                  className="absolute"
                  style={{ left: col(i), top: Y_HEADER + 34, transform: "translate(-1px, -50%)" }}
                >
                  <DialReadout name={`Налягане ${v.name}`} value={v.pressure ?? null} tag={v.pressureTag} tone={tone} side="right" onSelect={onSelect} />
                </div>
              )}
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
