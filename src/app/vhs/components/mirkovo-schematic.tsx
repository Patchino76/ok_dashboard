"use client";

import type { Measurement } from "./dashboard-types";
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
const HEIGHT = 130;

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
  onSelect,
}: {
  level: number | null;
  levelTag?: string;
  inletPressure?: number | null;
  inletTag?: string;
  pressure: number | null;
  pressureTag?: string;
  valves: KarlievoValve[];
  pumps: Pump[];
  station: string;
  onSelect: (m: Measurement) => void;
}) {
  const tone: Measurement["tone"] = "fresh";
  const n = valves.length;
  const col = (i: number) => `${((i + 0.5) / n) * 100}%`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-1">
        <div className="flex w-24 shrink-0 flex-col gap-1">
          {inletPressure !== undefined && <Readout name="Входящ тръбопровод" value={inletPressure} unit="bar" tag={inletTag} tone={tone} decimals={3} onSelect={onSelect} />}
          <div className="relative h-[3px]">
            <span className={cn("absolute inset-0", PIPE)} />
            <Arrow left="calc(100% - 8px)" top="50%" dir="right" />
          </div>
          {inletPressure !== undefined && <span className="text-[10px] leading-tight text-slate-400">Входящ тръбопровод</span>}
        </div>
        <LevelGauge name="Ниво" value={level} tone={tone} tag={levelTag} onSelect={onSelect} />
      </div>

      <div className="mx-2">
        <div className="relative" style={{ height: HEIGHT }}>
          <HLine from={col(0)} to="calc(100% + 8px)" top={Y_HEADER} />
          <Arrow left="96%" top={Y_HEADER} dir="right" />
          <Pos left="50%" top={Y_HEADER - 16}>
            <Readout name="Налягане" value={pressure} unit="bar" tag={pressureTag} tone={tone} onSelect={onSelect} />
          </Pos>
          {valves.map((v, i) => (
            <div key={v.name}>
              <VLine left={col(i)} from={Y_HEADER} to={HEIGHT} />
              <Arrow left={col(i)} top={Y_HEADER + 4} dir="up" />
              <Valve valve={v} left={col(i)} top={Y_HEADER + 50} vertical tone={tone} onSelect={onSelect} />
            </div>
          ))}
        </div>
        <PumpStatus pumps={pumps} station={station} aligned onSelect={onSelect} />
      </div>
    </div>
  );
}
