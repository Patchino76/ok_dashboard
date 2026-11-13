"use client";

import { useMemo, useState } from "react";
import { Activity, Gauge } from "lucide-react";
import type { Measurement, WaterTone } from "./dashboard-types";
import { LevelGauge } from "./level-gauge";
import { MetricCard } from "./metric-card";
import { PumpStatus } from "./pump-status";
import { SectionHeading } from "./section-heading";
import { StationCard, PumpCountBadge } from "./station-card";
import { TailingsSchematic } from "./tailings-schematic";
import { TrendDialog } from "./trend-dialog";
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

  const fmt = (tag: string, decimals = 2): string => {
    const v = num(tag);
    if (v === null) return "—";
    return new Intl.NumberFormat("bg-BG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v);
  };

  const pump = (id: string, tag: string) => ({ id, running: bool(tag), tag });
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
    "VHS_PM111_ON",
    "VHS_PM112_ON",
    "VHS_PM113_ON",
    "VHS_PM114_ON",
  ];
  const ayderePumps = ["VHS_PM321_ON", "VHS_PM322_ON", "VHS_PM323_ON"];
  const suldjaderePumps = ["VHS_PM421_ON", "VHS_PM422_ON", "VHS_PM423_ON"];
  const novaDrainPumps = ["VHS_PM551_ON", "VHS_PM552_ON", "VHS_PM553_ON"];
  const staraDrainPumps = ["VHS_PM521_ON", "VHS_PM522_ON", "VHS_PM523_ON"];
  const ulamaPumps = ["VHS_ULAMA_P1", "VHS_ULAMA_P2", "VHS_ULAMA_P3"];

  return (
    <main className="-m-4 min-h-dvh bg-slate-950 bg-[radial-gradient(1000px_500px_at_5%_-10%,rgba(37,99,235,.18),transparent),radial-gradient(800px_400px_at_100%_0%,rgba(16,185,129,.1),transparent)] px-3 py-5 text-slate-100 sm:px-6 md:-m-6">
      <div className="mx-auto max-w-[1900px] space-y-7">
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

        <section className="space-y-3">
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
                    value: fmt("VHS_KARLIEVO_TR_JIT201_APOWER", 0),
                    unit: "kW",
                    tag: "VHS_KARLIEVO_TR_JIT201_APOWER",
                  },
                  {
                    name: "Помпени 1",
                    value: fmt("VHS_MIRKOVO_TR1_JIT101_APOWER", 3),
                    unit: "MW",
                    tag: "VHS_MIRKOVO_TR1_JIT101_APOWER",
                  },
                  {
                    name: "Помпени 2",
                    value: fmt("VHS_MIRKOVO_TR2_JIT102_APOWER", 3),
                    unit: "MW",
                    tag: "VHS_MIRKOVO_TR2_JIT102_APOWER",
                  },
                ]}
              />
              <StatGrid
                tone="power"
                onSelect={selectMeasurement}
                columns={3}
                items={[
                  { name: "ВХС 1.1", value: "—", unit: "kV" },
                  { name: "ВХС 1.2", value: "—", unit: "kV" },
                  { name: "ВХС 2.1", value: "—", unit: "kV" },
                  { name: "ВХС 2.2", value: "—", unit: "kV" },
                  { name: "ВХС 3.1", value: "—", unit: "kV" },
                  { name: "ВХС 3.2", value: "—", unit: "kV" },
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
              <GaugeAndStats
                name="Ниво"
                value={num("VHS_LIT200")}
                tone="fresh"
                tag="VHS_LIT200"
                onSelect={selectMeasurement}
                stats={[
                  {
                    name: "Налягане",
                    value: fmt("VHS_PIT225"),
                    unit: "bar",
                    tag: "VHS_PIT225",
                  },
                  {
                    name: "Входящ тръбопровод",
                    value: fmt("VHS_KARLIEVO_PIT201_PROCESSVALUE"),
                    unit: "bar",
                    tag: "VHS_KARLIEVO_PIT201_PROCESSVALUE",
                  },
                ]}
              />
              <PumpStatus
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
              <GaugeAndStats
                name="Ниво"
                value={num("VHS_LIT110")}
                tone="fresh"
                tag="VHS_LIT110"
                onSelect={selectMeasurement}
                stats={[
                  {
                    name: "Налягане",
                    value: fmt("VHS_PIT116"),
                    unit: "bar",
                    tag: "VHS_PIT116",
                  },
                ]}
              />
              <PumpStatus
                pumps={[
                  pump("P6", "VHS_PM121_ON"),
                  pump("P7", "VHS_PM122_ON"),
                  pump("P8", "VHS_PM123_ON"),
                  pump("P9", "VHS_PM124_ON"),
                  pump("P10", "VHS_PM125_ON"),
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
              <GaugeAndStats
                name="Ниво"
                value={num("VHS_LIT600")}
                tone="fresh"
                tag="VHS_LIT600"
                onSelect={selectMeasurement}
                stats={[
                  {
                    name: "Налягане",
                    value: fmt("VHS_PIT614"),
                    unit: "bar",
                    tag: "VHS_PIT614",
                  },
                ]}
              />
              <PumpStatus
                pumps={[
                  pump("P1", "VHS_PM611_ON"),
                  pump("P2", "VHS_PM612_ON"),
                  pump("P3", "VHS_PM613_ON"),
                ]}
                station="ПС Радин извор"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard title="Водонапорна кула" tone="fresh">
              <GaugeAndStats
                name="Ниво"
                value={num("VHS_LIT620")}
                min={843.66}
                max={863.66}
                ticks={[843.66, 848.66, 853.66, 858.66, 863.66]}
                tone="fresh"
                tag="VHS_LIT620"
                onSelect={selectMeasurement}
                stats={[{ name: "Налягане", value: "—", unit: "bar" }]}
              />
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

        <section className="space-y-3">
          <SectionHeading
            title="Оборотна вода"
            subtitle="Помпени станции и резервоари"
            tone="recycle"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <GaugeAndStats
                name="Ниво"
                value={num("VHS_LIT120")}
                tone="recycle"
                tag="VHS_LIT120"
                onSelect={selectMeasurement}
                stats={[
                  {
                    name: "Дебит",
                    value: fmt("VHS9_HVOSTOPROVOD_SONARTRAC03", 1),
                    unit: "l/s",
                    tag: "VHS9_HVOSTOPROVOD_SONARTRAC03",
                  },
                ]}
              />
              <PumpStatus
                pumps={[
                  pump("P1", "VHS_PM111_ON"),
                  pump("P2", "VHS_PM112_ON"),
                  pump("P3", "VHS_PM113_ON"),
                  pump("P4", "VHS_PM114_ON"),
                ]}
                station="ПС Мирково · оборотна"
                onSelect={selectMeasurement}
              />
            </StationCard>
            <StationCard title="Резервоар оборотна вода" tone="recycle">
              <div className="flex items-center justify-around">
                <LevelGauge
                  name="Камера 1"
                  value={num("VHS_LIT701_1_PV")}
                  max={4}
                  tone="recycle"
                  tag="VHS_LIT701_1_PV"
                  onSelect={selectMeasurement}
                />
                <LevelGauge
                  name="Камера 2"
                  value={num("VHS_LIT702_PV")}
                  max={4}
                  tone="recycle"
                  tag="VHS_LIT702_PV"
                  onSelect={selectMeasurement}
                />
                <StatGrid
                  items={[
                    {
                      name: "Ниво A",
                      value: fmt("VHS_LIT701"),
                      unit: "m",
                      tag: "VHS_LIT701",
                    },
                    {
                      name: "Ниво B",
                      value: fmt("VHS_LIT702_1_PV"),
                      unit: "m",
                      tag: "VHS_LIT702_1_PV",
                    },
                    {
                      name: "Налягане",
                      value: fmt("VHS_PIT126"),
                      unit: "bar",
                      tag: "VHS_PIT126",
                    },
                  ]}
                  tone="recycle"
                  onSelect={selectMeasurement}
                  columns={1}
                />
              </div>
            </StationCard>
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
                  decimals={3}
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
            <StationCard
              title="Плаваща ПС „Сулуджа дере“"
              tone="recycle"
              status={
                bool("VHS_OA4") ? (
                  <Badge variant="destructive">Аларма</Badge>
                ) : (
                  <PumpCountBadge
                    total={suldjaderePumps.length}
                    running={pumpCount(suldjaderePumps)}
                  />
                )
              }
            >
              <div className="flex items-center gap-2">
                <LevelGauge
                  name="Мътност"
                  value={num("VHS_LIT420")}
                  max={0.5}
                  ticks={[0, 0.25, 0.5]}
                  unit="g/l"
                  decimals={3}
                  tone="recycle"
                  tag="VHS_LIT420"
                  onSelect={selectMeasurement}
                />
                <StatGrid
                  items={[
                    {
                      name: "Ниво A",
                      value: fmt("VHS_LIT426"),
                      unit: "m",
                      tag: "VHS_LIT426",
                    },
                    {
                      name: "Ниво B",
                      value: fmt("VHS_LIT427"),
                      unit: "m",
                      tag: "VHS_LIT427",
                    },
                    {
                      name: "Ниво C",
                      value: fmt("VHS_LIT428"),
                      unit: "m",
                      tag: "VHS_LIT428",
                    },
                    {
                      name: "Ниво D",
                      value: fmt("VHS_LIT429"),
                      unit: "m",
                      tag: "VHS_LIT429",
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
                    name: "Напр. 1",
                    value: fmt("VHS_PIT421"),
                    unit: "bar",
                    tag: "VHS_PIT421",
                  },
                  {
                    name: "Напр. 2",
                    value: fmt("VHS_PIT422"),
                    unit: "bar",
                    tag: "VHS_PIT422",
                  },
                  {
                    name: "Напр. 3",
                    value: fmt("VHS_PIT423"),
                    unit: "bar",
                    tag: "VHS_PIT423",
                  },
                  {
                    name: "Напр. 4",
                    value: fmt("VHS_SULDJADERE_TOTAL_PRESURE"),
                    unit: "bar",
                    tag: "VHS_SULDJADERE_TOTAL_PRESURE",
                  },
                ]}
                tone="recycle"
                onSelect={selectMeasurement}
                columns={4}
              />
              <PumpStatus
                pumps={[
                  pump("P1", "VHS_PM421_ON"),
                  pump("P2", "VHS_PM422_ON"),
                  pump("P3", "VHS_PM423_ON"),
                ]}
                station="Плаваща ПС Сулуджа дере"
                onSelect={selectMeasurement}
              />
            </StationCard>
          </div>
        </section>

        <section className="space-y-3">
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
                <StatGrid
                  items={[
                    {
                      name: "Налягане 1",
                      value: fmt("VHS_PIT563"),
                      unit: "bar",
                      tag: "VHS_PIT563",
                    },
                    {
                      name: "Налягане 2",
                      value: fmt("VHS_PIT554"),
                      unit: "bar",
                      tag: "VHS_PIT554",
                    },
                  ]}
                  tone="drain"
                  onSelect={selectMeasurement}
                  columns={1}
                />
              </div>
              <PumpStatus
                pumps={[
                  pump("P1", "VHS_PM551_ON"),
                  pump("P2", "VHS_PM552_ON"),
                  pump("P3", "VHS_PM553_ON"),
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
                      value: fmt("VHS_FIT512", 1),
                      unit: "l/s",
                      tag: "VHS_FIT512",
                    },
                    {
                      name: "Дебит 2",
                      value: fmt("VHS_FIT513", 1),
                      unit: "l/s",
                      tag: "VHS_FIT513",
                    },
                    {
                      name: "Дебит 3",
                      value: fmt("VHS_FIT514", 1),
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
                    name: "Напр. 1",
                    value: fmt("VHS_PIT521"),
                    unit: "bar",
                    tag: "VHS_PIT521",
                  },
                  {
                    name: "Напр. 2",
                    value: fmt("VHS_PIT522"),
                    unit: "bar",
                    tag: "VHS_PIT522",
                  },
                  {
                    name: "Напр. 3",
                    value: fmt("VHS_PIT523"),
                    unit: "bar",
                    tag: "VHS_PIT523",
                  },
                  { name: "Напр. 4", value: "—", unit: "bar" },
                ]}
                tone="drain"
                onSelect={selectMeasurement}
                columns={4}
              />
              <PumpStatus
                pumps={[
                  pump("P1", "VHS_PM521_ON"),
                  pump("P2", "VHS_PM522_ON"),
                  pump("P3", "VHS_PM523_ON"),
                ]}
                station="Стара дренажна ПС"
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

        <section className="space-y-3">
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
                (num("VHS_SHAHTA03") ?? 0) > 1500 ? (
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
                      value: fmt("VHS_HVOSTOPROVOD_VOLUME_FLOW", 0),
                      unit: "m³/h",
                      tag: "VHS_HVOSTOPROVOD_VOLUME_FLOW",
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
                      value: fmt("VHS9_HVOST_CORRECTED_FLOW_TOTAL", 0),
                      unit: "m³/h",
                      tag: "VHS9_HVOST_CORRECTED_FLOW_TOTAL",
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
        open={selectedMeasurement !== null}
        onOpenChange={closeTrend}
      />
    </main>
  );
}
