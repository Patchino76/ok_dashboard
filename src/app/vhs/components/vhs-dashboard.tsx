"use client";
import { Inspector, gotoVSCode } from "react-dev-inspector";

import { useEffect, useMemo, useState } from "react";
import { Activity, Gauge } from "lucide-react";
import type { Measurement, WaterTone } from "./dashboard-types";
import { LevelGauge } from "./level-gauge";
import { MetricCard } from "./metric-card";
import { SemiGauge } from "./semi-gauge";
import { ReservoirSchematic } from "./reservoir-schematic";
import { KarlievoSchematic } from "./karlievo-schematic";
import { MirkovoSchematic } from "./mirkovo-schematic";
import { DialReadout } from "./dial-readout";
import { Arrow, PIPE, Readout } from "./karlievo-schematic";
import { PumpStatus } from "./pump-status";
import { ValvePositions } from "./valve-positions";
import { SectionHeading } from "./section-heading";
import { StationCard, PumpCountBadge } from "./station-card";
import { TailingsSchematic } from "./tailings-schematic";
import { TagTooltip } from "./tag-tooltip";
import { TrendDialog } from "./trend-dialog";
import { MultiTrendDialog } from "./multi-trend-dialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useVhsValues } from "../hooks/useVhsValues";
import { vhsTagNames } from "@/lib/tags/vhs-tags";

type Stat = {
  name: string;
  value: string | number;
  unit?: string;
  alarm?: boolean;
  tag?: string;
};
const SHOW_AYDERE_SECTION: boolean = false;
export function DevInspector() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Inspector onInspectElement={gotoVSCode} />;
}

function copyText(text: string) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  };
  if (window.isSecureContext && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(fallback);
  } else {
    fallback();
  }
}

function DevTagPicker() {
  const [picked, setPicked] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const onClick = (e: MouseEvent) => {
      if (!e.altKey) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tag]");
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const tag = el.dataset.tag || "";
      setPicked(tag || "no tag");
      setCopied(false);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (process.env.NODE_ENV !== "development" || picked === null) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md border border-amber-400/50 bg-slate-900 px-3 py-2 font-mono text-sm text-amber-300 shadow-lg">
      <span>{picked}</span>
      {picked !== "no tag" && (
        <button
          type="button"
          className="rounded border border-amber-400/50 px-2 py-0.5 text-xs hover:bg-amber-400/20"
          onClick={() => {
            copyText(picked);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
      <button type="button" onClick={() => setPicked(null)}>
        x
      </button>
    </div>
  );
}

function StatGrid({
  items,
  tone,
  onSelect,
  columns = 2,
}: {
  items: Stat[];
  tone: WaterTone | "mine";
  onSelect: (measurement: Measurement) => void;
  columns?: 1 | 2 | 3 | 4;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => (
        <MetricCard
          key={`${item.name}-${index}`}
          measurement={{ ...item, tone }}
          onSelect={onSelect}
          alarm={item.alarm}
        />
      ))}
    </div>
  );
}

function GaugeAndStats({
  name,
  value,
  max = 4,
  tone,
  stats,
  onSelect,
  min = 0,
  ticks,
  tag,
}: {
  name: string;
  value: number | null;
  max?: number;
  min?: number;
  ticks?: number[];
  tone: WaterTone;
  stats: Stat[];
  tag?: string;
  onSelect: (measurement: Measurement) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <LevelGauge
        name={name}
        value={value}
        min={min}
        max={max}
        ticks={ticks}
        tone={tone}
        tag={tag}
        onSelect={onSelect}
      />
      <StatGrid items={stats} tone={tone} onSelect={onSelect} columns={1} />
    </div>
  );
}

export function VhsDashboard() {
  const [selectedMeasurement, setSelectedMeasurement] =
    useState<Measurement | null>(null);
  const { data: values, loading } = useVhsValues(vhsTagNames);

  const selectMeasurement = (measurement: Measurement) =>
    setSelectedMeasurement(measurement);
  const closeTrend = (open: boolean) => {
    if (!open) setSelectedMeasurement(null);
  };

  const num = (tag: string): number | null => {
    const v = values[tag]?.value;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const bool = (tag: string): boolean => {
    const v = values[tag]?.value;
    return v === true || v === 1;
  };

  const fmtDiv = (tag: string, divisor: number, decimals = 2): string => {
    const v = num(tag);
    if (v === null) return "—";
    return new Intl.NumberFormat("bg-BG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v / divisor);
  };

  const fmt = (tag: string, decimals = 2): string => {
    const v = num(tag);
    if (v === null) return "—";
    return new Intl.NumberFormat("bg-BG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v);
  };

  const pump = (id: string, tag: string) => ({ id, running: bool(tag), tag });
  const pumpTemps = (prefix: string) =>
    (
      [
        ["Мотор, лагер 1", "TMB1", "#fb7185"],
        ["Мотор, лагер 2", "TMB2", "#fb923c"],
        ["Помпа, лагер 1", "TPB1", "#38bdf8"],
        ["Помпа, лагер 2", "TPB2", "#a78bfa"],
        ["Мотор, намотка 1", "TMF1", "#fbbf24"],
        ["Мотор, намотка 2", "TMF2", "#a3e635"],
        ["Мотор, намотка 3", "TMF3", "#2dd4bf"],
      ] as const
    ).map(([name, sfx, color]) => ({
      name,
      color,
      tag: `${prefix}_${sfx}`,
      value: num(`${prefix}_${sfx}`),
    }));
  const pumpCount = (tags: string[]) => tags.filter((tag) => bool(tag)).length;

  const numericValues = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const [name, tagValue] of Object.entries(values)) {
      result[name] =
        typeof tagValue.value === "number" && Number.isFinite(tagValue.value)
          ? tagValue.value
          : null;
    }
    return result;
  }, [values]);

  const karlievoPumps = ["VHS_PM211_ON", "VHS_PM212_ON", "VHS_PM213_ON"];
  const mirkovoFreshPumps = [
    "VHS_PM121_ON",
    "VHS_PM122_ON",
    "VHS_PM123_ON",
    "VHS_PM124_ON",
    "VHS_PM125_ON",
  ];
  const radinPumps = ["VHS_PM611_ON", "VHS_PM612_ON", "VHS_PM613_ON"];
  const mirkovoRecyclePumps = [
    "VHS_PM121_ON",
    "VHS_PM122_ON",
    "VHS_PM123_ON",
    "VHS_PM124_ON",
  ];
  const ayderePumps = ["VHS_PM321_ON", "VHS_PM322_ON", "VHS_PM323_ON"];
  const suldjaderePumps = ["VHS_PM421_ON", "VHS_PM422_ON", "VHS_PM423_ON"];
  const novaDrainPumps = ["VHS_PM551_ON", "VHS_PM552_ON", "VHS_PM553_ON"];
  const staraDrainPumps = ["VHS_PM521_ON", "VHS_PM522_ON", "VHS_PM523_ON"];
  const ulamaPumps = ["VHS_ULAMA_P1", "VHS_ULAMA_P2", "VHS_ULAMA_P3"];

  return (
    <main className="-m-4 min-h-dvh bg-slate-950 bg-[radial-gradient(1000px_500px_at_5%_-10%,rgba(37,99,235,.18),transparent),radial-gradient(800px_400px_at_100%_0%,rgba(16,185,129,.1),transparent)] px-3 py-5 text-slate-100 sm:px-6 md:-m-6">
      <DevTagPicker />
      <TagTooltip />
      <div className="mx-auto max-w-[1900px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              <Gauge className="size-3.5 text-sky-300" />
              Оперативен мониторинг
            </div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Водно и хвостово стопанство
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Обогатителна фабрика · медна руда · VHS тагове
            </p>
          </div>
          <Badge
            variant="outline"
            className="h-7 gap-1.5 border-emerald-400/30 bg-emerald-500/10 px-2.5 text-emerald-300"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            {loading ? "Зареждане..." : "Реални данни"}
          </Badge>
        </header>

        <section className="group/section space-y-3 rounded-2xl p-2 ring-1 ring-transparent transition-all duration-300 ease-out hover:bg-white/[0.08] hover:ring-white/30 hover:shadow-lg hover:shadow-black/30 active:bg-white/[0.09] active:ring-white/25">
          <SectionHeading
            title="Свежа вода"
            subtitle="Захранване, подаване и налягане"
            tone="fresh"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <StationCard
              title="Електрозахранване · ВХС подстанция"
              tone="power"
              className="sm:col-span-2"
            >
              <StatGrid
                tone="power"
                onSelect={selectMeasurement}
                columns={2}
                items={[
                  {
                    name: "Сума",
                    value: fmt("VHS_SUM_POWER", 3),
                    unit: "MW",
                    tag: "VHS_SUM_POWER",
                  },
                  {
                    name: "ПС Карлиево",
                    value: fmt("OK_E3_P_PS_KARLIEVO", 3),
                    unit: "MW",
                    tag: "OK_E3_P_PS_KARLIEVO",
                  },
                  {
                    name: "Помпени 1",
                    value: fmt("OK_E4_P_PS1", 3),
                    unit: "MW",
                    tag: "OK_E4_P_PS1",
                  },
                  {
                    name: "Помпени 2",
                    value: fmt("OK_E5_P_PS2", 3),
                    unit: "MW",
                    tag: "OK_E5_P_PS2",
                  },
                ]}
              />
              <StatGrid
                tone="power"
                onSelect={selectMeasurement}
                columns={3}
                items={[
                  {
                    name: "ВХС 1.1",
                    value: fmt("OK_E4_PS1_V1", 2),
                    unit: "kV",
                    tag: "OK_E4_PS1_V1",
                  },
                  {
                    name: "ВХС 1.2",
                    value: fmt("OK_E5_PS2_V1", 2),
                    unit: "kV",
                    tag: "OK_E5_PS2_V1",
                  },
                  {
                    name: "ВХС 2.1",
                    value: fmt("OK_E4_PS1_V2", 2),
                    unit: "kV",
                    tag: "OK_E4_PS1_V2",
                  },
                  {
                    name: "ВХС 2.2",
                    value: fmt("OK_E5_PS2_V2", 2),
                    unit: "kV",
                    tag: "OK_E5_PS2_V2",
                  },
                  {
                    name: "ВХС 3.1",
                    value: fmt("OK_E4_PS1_V3", 2),
                    unit: "kV",
                    tag: "OK_E4_PS1_V3",
                  },
                  {
                    name: "ВХС 3.2",
                    value: fmt("OK_E5_PS2_V3", 2),
                    unit: "kV",
                    tag: "OK_E5_PS2_V3",
                  },
                ]}
              />
            </StationCard>
            <StationCard
              title="ПС Карлиево"
              tone="fresh"
              status={
                <PumpCountBadge
                  total={karlievoPumps.length}
                  running={pumpCount(karlievoPumps)}
                />
              }
            >
              <KarlievoSchematic
                level={num("VHS_LIT200")}
                levelTag="VHS_LIT200"
                inletPressure={num("VHS_KARLIEVO_PIT201_PROCESSVALUE")}
                inletTag="VHS_KARLIEVO_PIT201_PROCESSVALUE"
                outletPressure={num("VHS_PIT225")}
                outletTag="VHS_PIT225"
                risers={[
                  { name: "V223", tag: "VHS_KARLIEVO_VALVE_V223", value: num("VHS_KARLIEVO_VALVE_V223") },
                  { name: "V224", tag: "VHS_KARLIEVO_VALVE_V224", value: num("VHS_KARLIEVO_VALVE_V224") },
                ]}
                manifold={[
                  { name: "V221", tag: "VHS_KARLIEVO_VALVE_V221", value: num("VHS_KARLIEVO_VALVE_V221") },
                  { name: "V222", tag: "VHS_KARLIEVO_VALVE_V222", value: num("VHS_KARLIEVO_VALVE_V222") },
                ]}
                pumpValves={[
                  { name: "V211", tag: "VHS_KARLIEVO_VALVE_V211", value: num("VHS_KARLIEVO_VALVE_V211") },
                  { name: "V212", tag: "VHS_KARLIEVO_VALVE_V212", value: num("VHS_KARLIEVO_VALVE_V212") },
                  { name: "V213", tag: "VHS_KARLIEVO_VALVE_V213", value: num("VHS_KARLIEVO_VALVE_V213") },
                ]}
                pumps={[
                  pump("P1", "VHS_PM211_ON"),
                  pump("P2", "VHS_PM212_ON"),
                  pump("P3", "VHS_PM213_ON"),
                ]}
                station="ПС Карлиево"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard
              title="ПС Мирково"
              tone="fresh"
              status={
                <PumpCountBadge
                  total={mirkovoFreshPumps.length}
                  running={pumpCount(mirkovoFreshPumps)}
                />
              }
            >
              <MirkovoSchematic
                level={num("VHS_LIT110")}
                levelTag="VHS_LIT110"
                inletPressure={num("VHS_PIT225")}
                inletTag="VHS_PIT225"
                pressure={num("VHS_PIT116")}
                pressureTag="VHS_PIT116"
                valves={["V111", "V112", "V113", "V114", "V115"].map((n) => ({
                  name: n,
                  tag: `VHS_MIRKOVO_VALVE_${n}`,
                  value: num(`VHS_MIRKOVO_VALVE_${n}`),
                }))}
                pumps={[
                  { ...pump("P6", "VHS_PM111_ON"), temps: pumpTemps("VHS_PM111") },
                  { ...pump("P7", "VHS_PM112_ON"), temps: pumpTemps("VHS_PM112") },
                  { ...pump("P8", "VHS_PM113_ON"), temps: pumpTemps("VHS_PM113") },
                  { ...pump("P9", "VHS_PM114_ON"), temps: pumpTemps("VHS_PM114") },
                  { ...pump("P10", "VHS_PM115_ON"), temps: pumpTemps("VHS_PM115") },
                ]}
                station="ПС Мирково"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard
              title="ПС Радин извор"
              tone="fresh"
              status={
                <PumpCountBadge
                  total={radinPumps.length}
                  running={pumpCount(radinPumps)}
                />
              }
            >
              <MirkovoSchematic
                level={num("VHS_LIT600")}
                levelTag="VHS_LIT600"
                inletPressure={num("VHS_PIT116")}
                inletTag="VHS_PIT116"
                pressure={num("VHS_PIT614")}
                pressureTag="VHS_PIT614"
                valves={["V611", "V612", "V613"].map((n) => ({
                  name: n,
                  tag: `VHS_RADINIZVOR_VALVE_${n}`,
                  value: num(`VHS_RADINIZVOR_VALVE_${n}`),
                }))}
                pumps={[
                  { ...pump("P1", "VHS_PM611_ON"), temps: pumpTemps("VHS_PM611") },
                  { ...pump("P2", "VHS_PM612_ON"), temps: pumpTemps("VHS_PM612") },
                  { ...pump("P3", "VHS_PM613_ON"), temps: pumpTemps("VHS_PM613") },
                ]}
                station="ПС Радин извор"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard title="Водонапорна кула" tone="fresh">
              <div className="flex items-center justify-center gap-1">
                <div className="flex w-28 shrink-0 flex-col">
                  <DialReadout
                    name="Входящ тръбопровод"
                    value={num("VHS_PIT614")}
                    tag="VHS_PIT614"
                    tone="fresh"
                    side="top"
                    onSelect={selectMeasurement}
                  />
                  <div className="relative h-[3px]">
                    <span className={cn("absolute inset-0", PIPE)} />
                    <Arrow left="calc(100% - 8px)" top="50%" dir="right" />
                  </div>
                  <span className="mt-1 text-[10px] leading-tight text-slate-400">
                    Входящ тръбопровод
                  </span>
                </div>
                <LevelGauge
                  name="Ниво"
                  value={num("VHS_LIT620")}
                  min={843.66}
                  max={863.66}
                  ticks={[843.66, 848.66, 853.66, 858.66, 863.66]}
                  tone="fresh"
                  tag="VHS_LIT620"
                  onSelect={selectMeasurement}
                />
              </div>
            </StationCard>
            <StationCard
              title="Баланс на водата"
              tone="fresh"
              className="sm:col-span-2"
            >
              <StatGrid
                tone="fresh"
                onSelect={selectMeasurement}
                columns={4}
                items={[
                  {
                    name: "Обем оборотна (общо)",
                    value: fmt("VHS_OBOROTNA_VODA", 0),
                    unit: "m³",
                    tag: "VHS_OBOROTNA_VODA",
                  },
                  {
                    name: "Оборотна 2",
                    value: fmt("VHS9_HVOSTOPROVOD_SONARTRAC03", 1),
                    unit: "l/s",
                    tag: "VHS9_HVOSTOPROVOD_SONARTRAC03",
                  },
                  {
                    name: "Обем",
                    value: fmt("VHS9_HVOSTOPROVOD_SONARTRAC03_TOT", 0),
                    unit: "m³",
                    tag: "VHS9_HVOSTOPROVOD_SONARTRAC03_TOT",
                  },
                  { name: "Обем 2", value: "—", unit: "m³" },
                  {
                    name: "Температура",
                    value: fmt("VHS_RECYCLEDWATER_TEMPERATURE", 1),
                    unit: "°C",
                    tag: "VHS_RECYCLEDWATER_TEMPERATURE",
                  },
                  {
                    name: "pH",
                    value: fmt("VHS_RECYCLEDWATER_PH702"),
                    tag: "VHS_RECYCLEDWATER_PH702",
                  },
                  {
                    name: "Руднична вода",
                    value: fmt("VHS8_KISELA_VODA_FT801", 1),
                    unit: "l/s",
                    tag: "VHS8_KISELA_VODA_FT801",
                  },
                  {
                    name: "pH руднична",
                    value: fmt("VHS8_KISELA_VODA_PH800"),
                    tag: "VHS8_KISELA_VODA_PH800",
                  },
                  {
                    name: "Обем руднична",
                    value: fmt("VHS8_KISELA_VODA_FTQ801", 0),
                    unit: "m³",
                    tag: "VHS8_KISELA_VODA_FTQ801",
                  },
                  {
                    name: "Разход",
                    value: fmt("VHS8_KISELA_VODA_FE"),
                    unit: "l/min",
                    tag: "VHS8_KISELA_VODA_FE",
                  },
                  {
                    name: "Свежа вода",
                    value: fmt("VHS_RADIN_IZVOR_FT601", 1),
                    unit: "l/s",
                    tag: "VHS_RADIN_IZVOR_FT601",
                  },
                  {
                    name: "Обем свежа",
                    value: fmt("VHS_RADIN_IZVOR_FTQ601", 0),
                    unit: "m³",
                    tag: "VHS_RADIN_IZVOR_FTQ601",
                  },
                ]}
              />
            </StationCard>
          </div>
        </section>

        <section className="group/section space-y-3 rounded-2xl p-2 ring-1 ring-transparent transition-all duration-300 ease-out hover:bg-white/[0.08] hover:ring-white/30 hover:shadow-lg hover:shadow-black/30 active:bg-white/[0.09] active:ring-white/25">
          <SectionHeading
            title="Оборотна вода"
            subtitle="Помпени станции и резервоари"
            tone="recycle"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StationCard
              title="Плаваща ПС „Сулуджа дере“"
              tone="recycle"
              status={
                <PumpCountBadge
                  total={suldjaderePumps.length}
                  running={pumpCount(suldjaderePumps)}
                />
              }
            >
              <SemiGauge
                name="Мътност"
                value={num("VHS_LIT420")}
                max={0.5}
                ticks={[0, 0.25, 0.5]}
                unit="g/l"
                decimals={2}
                tone="recycle"
                tag="VHS_LIT420"
                onSelect={selectMeasurement}
              />
              <div className="grid grid-cols-4 gap-1.5 justify-items-center">
                <LevelGauge
                  name="Понтон 1"
                  value={num("VHS_LIT426")}
                  tone="recycle"
                  centered
                  tag="VHS_LIT426"
                  onSelect={selectMeasurement}
                />
                <LevelGauge
                  name="Понтон 2"
                  value={num("VHS_LIT427")}
                  tone="recycle"
                  centered
                  tag="VHS_LIT427"
                  onSelect={selectMeasurement}
                />
                <LevelGauge
                  name="Понтон 3"
                  value={num("VHS_LIT428")}
                  tone="recycle"
                  centered
                  tag="VHS_LIT428"
                  onSelect={selectMeasurement}
                />
                <LevelGauge
                  name="Понтон 4"
                  value={num("VHS_LIT429")}
                  tone="recycle"
                  centered
                  tag="VHS_LIT429"
                  onSelect={selectMeasurement}
                />
              </div>
              <MirkovoSchematic
                tone="recycle"
                hideTop
                dialMax={10}
                pressure={num("VHS_SULDJADERE_TOTAL_PRESURE")}
                pressureTag="VHS_SULDJADERE_TOTAL_PRESURE"
                valves={[
                  ["V421", "VHS_PIT421"],
                  ["V422", "VHS_PIT422"],
                  ["V423", "VHS_PIT423"],
                ].map(([n, pt]) => ({
                  name: n,
                  tag: `VHS_SULDJADERE_VALVE_${n}`,
                  value: num(`VHS_SULDJADERE_VALVE_${n}`),
                  pressure: num(pt),
                  pressureTag: pt,
                }))}
                pumps={[
                  { ...pump("P1", "VHS_PM421_ON"), temps: pumpTemps("VHS_PM421") },
                  { ...pump("P2", "VHS_PM422_ON"), temps: pumpTemps("VHS_PM422") },
                  { ...pump("P3", "VHS_PM423_ON"), temps: pumpTemps("VHS_PM423") },
                ]}
                extraPumps={[
                  { ...pump("PV424", "VHS_PV424_ON"), small: true },
                  { ...pump("PV425", "VHS_PV425_ON"), small: true },
                ]}
                station="Плаваща ПС Сулуджа дере"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard
              title="ПС Мирково · оборотна"
              tone="recycle"
              status={
                <PumpCountBadge
                  total={mirkovoRecyclePumps.length}
                  running={pumpCount(mirkovoRecyclePumps)}
                />
              }
            >
              <SemiGauge
                name="Мътност"
                value={num("VHS_LORAWAN_NTU_66B0")}
                max={15}
                ticks={[0, 7.5, 15]}
                unit="g/l"
                decimals={2}
                tone="recycle"
                tag="VHS_LORAWAN_NTU_66B0"
                onSelect={selectMeasurement}
              />
              <MirkovoSchematic
                tone="recycle"
                level={num("VHS_LIT120")}
                levelTag="VHS_LIT120"
                inletContent={
                  <>
                    <Readout
                      name="Дебит"
                      value={num("VHS9_HVOSTOPROVOD_SONARTRAC03")}
                      unit="l/s"
                      tag="VHS9_HVOSTOPROVOD_SONARTRAC03"
                      tone="recycle"
                      decimals={1}
                      onSelect={selectMeasurement}
                    />
                    <Readout
                      name="Обем"
                      value={num("VHS9_HVOSTOPROVOD_SONARTRAC03_TOT")}
                      unit="m³"
                      tag="VHS9_HVOSTOPROVOD_SONARTRAC03_TOT"
                      tone="recycle"
                      decimals={0}
                      onSelect={selectMeasurement}
                    />
                  </>
                }
                pressure={num("VHS_PIT126")}
                pressureTag="VHS_PIT126"
                valves={["V121", "V122", "V123", "V124"].map((n) => ({
                  name: n,
                  tag: `VHS_MIRKOVO_VALVE_${n}`,
                  value: num(`VHS_MIRKOVO_VALVE_${n}`),
                }))}
                pumps={[
                  { ...pump("P1", "VHS_PM121_ON"), temps: pumpTemps("VHS_PM121") },
                  { ...pump("P2", "VHS_PM122_ON"), temps: pumpTemps("VHS_PM122") },
                  { ...pump("P3", "VHS_PM123_ON"), temps: pumpTemps("VHS_PM123") },
                  { ...pump("P4", "VHS_PM124_ON"), temps: pumpTemps("VHS_PM124") },
                ]}
                extraPumps={[
                  { ...pump("PD131", "VHS_PD131_ON"), small: true },
                  { ...pump("PD561", "VHS_PD561_ON"), small: true },
                ]}
                station="ПС Мирково · оборотна"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard title="Резервоар оборотна вода" tone="recycle">
              <ReservoirSchematic
                onSelect={selectMeasurement}
                top={[
                  {
                    name: "Резервоар 1",
                    tag: "VHS_LIT701_1_PV",
                    value: num("VHS_LIT701_1_PV"),
                  },
                  {
                    name: "Резервоар 2",
                    tag: "VHS_LIT702_PV",
                    value: num("VHS_LIT702_PV"),
                  },
                ]}
                bottom={[
                  {
                    name: "Резервоар 3",
                    tag: "VHS_LIT702_1_PV",
                    value: num("VHS_LIT702_1_PV"),
                  },
                  {
                    name: "Резервоар 4",
                    tag: "VHS_LIT701",
                    value: num("VHS_LIT701"),
                    ph: num("VHS_RECYCLEDWATER_PH702"),
                    phTag: "VHS_RECYCLEDWATER_PH702",
                    temp: num("VHS_RECYCLEDWATER_TEMPERATURE"),
                    tempTag: "VHS_RECYCLEDWATER_TEMPERATURE",
                  },
                  {
                    name: "Резервоар 5",
                    tag: "VHS_LIT701",
                    value: num("VHS_LIT701"),
                  },
                  { name: "Резервоар 6", value: null },
                ]}
              />
            </StationCard>
            {SHOW_AYDERE_SECTION && (
              <StationCard
                title="Плаваща ПС „Ай дере“"
                tone="recycle"
                status={
                  bool("VHS_OA3") ? (
                    <Badge variant="destructive">Аларма</Badge>
                  ) : (
                    <PumpCountBadge
                      total={ayderePumps.length}
                      running={pumpCount(ayderePumps)}
                    />
                  )
                }
              >
                <div className="flex items-center gap-2">
                  <LevelGauge
                    name="Мътност"
                    value={num("VHS_LIT320")}
                    max={0.5}
                    ticks={[0, 0.25, 0.5]}
                    unit="g/l"
                    decimals={2}
                    tone="recycle"
                    tag="VHS_LIT320"
                    onSelect={selectMeasurement}
                  />
                  <StatGrid
                    items={[
                      {
                        name: "Ниво A",
                        value: fmt("VHS_LIT326"),
                        unit: "m",
                        tag: "VHS_LIT326",
                      },
                      {
                        name: "Ниво B",
                        value: fmt("VHS_LIT327"),
                        unit: "m",
                        tag: "VHS_LIT327",
                      },
                      {
                        name: "Ниво C",
                        value: fmt("VHS_LIT328"),
                        unit: "m",
                        tag: "VHS_LIT328",
                      },
                      {
                        name: "Ниво D",
                        value: fmt("VHS_LIT329"),
                        unit: "m",
                        tag: "VHS_LIT329",
                      },
                    ]}
                    tone="recycle"
                    onSelect={selectMeasurement}
                    columns={2}
                  />
                </div>
                <StatGrid
                  items={[
                    {
                      name: "Налягане 1",
                      value: fmt("VHS_PIT321"),
                      unit: "bar",
                      tag: "VHS_PIT321",
                    },
                    {
                      name: "Налягане 2",
                      value: fmt("VHS_PIT322"),
                      unit: "bar",
                      tag: "VHS_PIT322",
                    },
                    {
                      name: "Налягане 3",
                      value: fmt("VHS_PIT323"),
                      unit: "bar",
                      tag: "VHS_PIT323",
                    },
                  ]}
                  tone="recycle"
                  onSelect={selectMeasurement}
                  columns={3}
                />
                <PumpStatus
                  pumps={[
                    pump("P1", "VHS_PM321_ON"),
                    pump("P2", "VHS_PM322_ON"),
                    pump("P3", "VHS_PM323_ON"),
                  ]}
                  station="Плаваща ПС Ай дере"
                  onSelect={selectMeasurement}
                />
              </StationCard>
            )}
          </div>
        </section>

        <section className="group/section space-y-3 rounded-2xl p-2 ring-1 ring-transparent transition-all duration-300 ease-out hover:bg-white/[0.08] hover:ring-white/30 hover:shadow-lg hover:shadow-black/30 active:bg-white/[0.09] active:ring-white/25">
          <SectionHeading
            title="Дренажни води"
            subtitle="Дренажни помпени станции"
            tone="drain"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StationCard
              title="Нова дренажна ПС"
              tone="drain"
              status={
                <PumpCountBadge
                  total={novaDrainPumps.length}
                  running={pumpCount(novaDrainPumps)}
                />
              }
            >
              <div className="flex items-center gap-1">
                <LevelGauge
                  name="Яма 1"
                  value={num("VHS_LIT540")}
                  tone="drain"
                  tag="VHS_LIT540"
                  onSelect={selectMeasurement}
                />
                <LevelGauge
                  name="Яма 2"
                  value={num("VHS_LIT541")}
                  tone="drain"
                  tag="VHS_LIT541"
                  onSelect={selectMeasurement}
                />
              </div>
              <StatGrid
                items={[
                  {
                    name: "Напор 1",
                    value: fmt("VHS_PIT563"),
                    unit: "bar",
                    tag: "VHS_PIT563",
                  },
                  {
                    name: "Напор 2",
                    value: fmt("VHS_PIT554"),
                    unit: "bar",
                    tag: "VHS_PIT554",
                  },
                ]}
                tone="drain"
                onSelect={selectMeasurement}
                columns={2}
              />
              <PumpStatus
                pumps={[
                  pump("P1", "VHS_PM551_ON"),
                  pump("P2", "VHS_PM552_ON"),
                  pump("P3", "VHS_PM553_ON"),
                  { ...pump("PD561", "VHS_PD561_ON"), small: true },
                ]}
                station="Нова дренажна ПС"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard
              title="Стара дренажна ПС"
              tone="drain"
              status={
                <PumpCountBadge
                  total={staraDrainPumps.length}
                  running={pumpCount(staraDrainPumps)}
                />
              }
            >
              <div className="flex items-center gap-1">
                <LevelGauge
                  name="Яма 1"
                  value={num("VHS_LIT510")}
                  tone="drain"
                  tag="VHS_LIT510"
                  onSelect={selectMeasurement}
                />
                <LevelGauge
                  name="Яма 2"
                  value={num("VHS_LIT511")}
                  tone="drain"
                  tag="VHS_LIT511"
                  onSelect={selectMeasurement}
                />
                <StatGrid
                  items={[
                    {
                      name: "Дебит 1",
                      value: fmt("VHS_FIT512", 2),
                      unit: "l/s",
                      tag: "VHS_FIT512",
                    },
                    {
                      name: "Дебит 2",
                      value: fmt("VHS_FIT513", 2),
                      unit: "l/s",
                      tag: "VHS_FIT513",
                    },
                    {
                      name: "Дебит 3",
                      value: fmt("VHS_FIT514", 2),
                      unit: "l/s",
                      tag: "VHS_FIT514",
                    },
                  ]}
                  tone="drain"
                  onSelect={selectMeasurement}
                  columns={1}
                />
              </div>
              <StatGrid
                items={[
                  {
                    name: "Напор 1",
                    value: fmt("VHS_PIT521"),
                    unit: "bar",
                    tag: "VHS_PIT521",
                  },
                  {
                    name: "Напор 2",
                    value: fmt("VHS_PIT522"),
                    unit: "bar",
                    tag: "VHS_PIT522",
                  },
                  {
                    name: "Напор 3",
                    value: fmt("VHS_PIT523"),
                    unit: "bar",
                    tag: "VHS_PIT523",
                  },
                ]}
                tone="drain"
                onSelect={selectMeasurement}
                columns={3}
              />
              <PumpStatus
                pumps={[
                  { ...pump("P1", "VHS_PM521_ON"), temps: pumpTemps("VHS_PM521") },
                  { ...pump("P2", "VHS_PM522_ON"), temps: pumpTemps("VHS_PM522") },
                  { ...pump("P3", "VHS_PM523_ON"), temps: pumpTemps("VHS_PM523") },
                  { ...pump("PD531", "VHS_PD531_ON"), small: true },
                ]}
                station="Стара дренажна ПС"
                aligned
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard
              title="Дренажна ПС „Улама“"
              tone="drain"
              status={
                <PumpCountBadge
                  total={ulamaPumps.length}
                  running={pumpCount(ulamaPumps)}
                />
              }
            >
              <div className="flex items-center gap-2">
                <LevelGauge
                  name="Ниво"
                  value={num("VHS_ULAMA_LT001")}
                  tone="drain"
                  tag="VHS_ULAMA_LT001"
                  onSelect={selectMeasurement}
                />
                <StatGrid
                  items={[
                    { name: "П1", value: "—", unit: "м.ч." },
                    { name: "П2", value: "—", unit: "м.ч." },
                    { name: "П3", value: "—", unit: "м.ч." },
                    {
                      name: "Дебит",
                      value: fmt("VHS_ULAMA_FT001", 0),
                      unit: "m³/h",
                      tag: "VHS_ULAMA_FT001",
                    },
                    {
                      name: "Обем",
                      value: fmt("VHS_ULAMA_TOTALWATER", 0),
                      unit: "m³",
                      tag: "VHS_ULAMA_TOTALWATER",
                    },
                  ]}
                  tone="drain"
                  onSelect={selectMeasurement}
                  columns={2}
                />
              </div>
              <PumpStatus
                pumps={[
                  pump("P1", "VHS_ULAMA_P1"),
                  pump("P2", "VHS_ULAMA_P2"),
                  pump("P3", "VHS_ULAMA_P3"),
                ]}
                station="Дренажна ПС Улама"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard
              title="Сулуджа дере · дренажно Бибо"
              tone="drain"
              status={
                bool("VHS_SULDJADERE_BIBO_ERROR") ? (
                  <Badge variant="destructive">Авария</Badge>
                ) : undefined
              }
            >
              <StatGrid
                items={[
                  {
                    name: "Дебит",
                    value: fmt("VHS_SULDJADERE_BIBO_WATER_FLOW", 0),
                    unit: "m³/h",
                    tag: "VHS_SULDJADERE_BIBO_WATER_FLOW",
                  },
                  {
                    name: "Обем",
                    value: fmt("VHS_SULDJADERE_BIBO_WATER_TOTAL", 0),
                    unit: "m³",
                    tag: "VHS_SULDJADERE_BIBO_WATER_TOTAL",
                  },
                  {
                    name: "Мощност",
                    value: fmt("VHS_SULDJADERE_BIBO_POWER", 0),
                    unit: "kW",
                    tag: "VHS_SULDJADERE_BIBO_POWER",
                  },
                  {
                    name: "Моточасове",
                    value: fmt("VHS_SULDJADERE_BIBO_WORKHOURS", 0),
                    unit: "м.ч.",
                    tag: "VHS_SULDJADERE_BIBO_WORKHOURS",
                  },
                ]}
                tone="drain"
                onSelect={selectMeasurement}
                columns={2}
              />
              <PumpStatus
                pumps={[pump("Бибо", "VHS_SULDJADERE_BIBO_ON")]}
                station="Сулуджа дере · Бибо"
                onSelect={selectMeasurement}
              />
            </StationCard>
          </div>
        </section>

        <section className="group/section space-y-3 rounded-2xl p-2 ring-1 ring-transparent transition-all duration-300 ease-out hover:bg-white/[0.08] hover:ring-white/30 hover:shadow-lg hover:shadow-black/30 active:bg-white/[0.09] active:ring-white/25">
          <SectionHeading
            title="Хвостово стопанство"
            subtitle="Шахти, нитки и измерителен възел"
            tone="tail"
          />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,660px)_1fr]">
            <StationCard
              title="Хвостови шахти и нитки"
              tone="tail"
              status={
                (num("VHS_SHAHTA_NOVA") ?? 0) > 1500 ? (
                  <Badge
                    variant="destructive"
                    className="bg-orange-500/15 text-orange-300"
                  >
                    Нова шахта 3 · внимание
                  </Badge>
                ) : undefined
              }
            >
              <TailingsSchematic
                values={numericValues}
                onSelect={selectMeasurement}
              />
            </StationCard>
            <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StationCard title="Измерителен възел" tone="tail">
                <StatGrid
                  items={[
                    {
                      name: "Дебит",
                      value: fmtDiv("VHS9_HVOSTOPROVOD_FT201_H", 3600, 3),
                      unit: "m³/s",
                      tag: "VHS9_HVOSTOPROVOD_FT201_H",
                    },
                    {
                      name: "Дебит",
                      value: fmt("VHS9_HVOSTOPROVOD_FT201_H", 0),
                      unit: "m³/h",
                      tag: "VHS9_HVOSTOPROVOD_FT201_H",
                    },
                    {
                      name: "Плътност",
                      value: fmt("VHS9_HVOSTOPROVOD_DT201", 3),
                      unit: "kg/l",
                      tag: "VHS9_HVOSTOPROVOD_DT201",
                    },
                    {
                      name: "Твърдо",
                      value: fmt("VHS_HVOSTOPROVOD_SOL"),
                      unit: "% sol",
                      tag: "VHS_HVOSTOPROVOD_SOL",
                    },
                  ]}
                  tone="tail"
                  onSelect={selectMeasurement}
                  columns={2}
                />
              </StationCard>
              <StationCard title="Общи данни хвостопровод" tone="tail">
                <StatGrid
                  items={[
                    {
                      name: "Твърдо",
                      value: fmt("VHS9_HVOST_SOLID_MATERIAL_T", 0),
                      unit: "t/h",
                      tag: "VHS9_HVOST_SOLID_MATERIAL_T",
                    },
                    {
                      name: "Дебит",
                      value: fmt("VHS_HVOSTOPROVOD_VOLUME_FLOW", 0),
                      unit: "m³/h",
                      tag: "VHS_HVOSTOPROVOD_VOLUME_FLOW",
                    },
                    {
                      name: "Плътност",
                      value: fmt("VHS9_HVOST_CORRECTED_DENSITY", 3),
                      unit: "kg/l",
                      tag: "VHS9_HVOST_CORRECTED_DENSITY",
                    },
                    {
                      name: "Твърдо",
                      value: fmt("VHS_HVOSTOPROVOD_SOLID"),
                      unit: "% sol",
                      tag: "VHS_HVOSTOPROVOD_SOLID",
                    },
                  ]}
                  tone="tail"
                  onSelect={selectMeasurement}
                  columns={2}
                />
              </StationCard>
              <StationCard title="Количество вода / руда" tone="tail">
                <StatGrid
                  items={[
                    {
                      name: "Вода",
                      value: fmt("VHS9_HVOSTOPROVOD_WATER", 0),
                      unit: "m³/h",
                      tag: "VHS9_HVOSTOPROVOD_WATER",
                    },
                    {
                      name: "Руда",
                      value: fmt("VHS_HVOSTOPROVOD_MAS_FLOW", 0),
                      unit: "t/h",
                      tag: "VHS_HVOSTOPROVOD_MAS_FLOW",
                    },
                  ]}
                  tone="tail"
                  onSelect={selectMeasurement}
                  columns={2}
                />
              </StationCard>
              <StationCard title="Хвостови стени и диги" tone="tail">
                <StatGrid
                  items={[
                    {
                      name: "Основна хвостова стена",
                      value: fmt("VHS_LORAWAN_PRESSURE_37D3"),
                      unit: "bar",
                      tag: "VHS_LORAWAN_PRESSURE_37D3",
                    },
                    { name: "Улама", value: "—", unit: "bar" },
                    {
                      name: "Оградна дига Чавдар",
                      value: fmt("VHS_LORAWAN_PRESSURE_78D9"),
                      unit: "bar",
                      tag: "VHS_LORAWAN_PRESSURE_78D9",
                    },
                  ]}
                  tone="tail"
                  onSelect={selectMeasurement}
                  columns={1}
                />
              </StationCard>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="size-3" />
            Стойностите се зареждат от VHS тагове
          </span>
          <span>VHS · Dashboard</span>
        </footer>
      </div>
      <TrendDialog
        measurement={selectedMeasurement}
        open={selectedMeasurement !== null && !selectedMeasurement.series}
        onOpenChange={closeTrend}
      />
      <MultiTrendDialog
        measurement={selectedMeasurement?.series ? selectedMeasurement : null}
        open={!!selectedMeasurement?.series}
        onOpenChange={closeTrend}
      />
    </main>
  );
}
