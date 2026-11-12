"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { X } from "lucide-react";
import type { Measurement } from "./dashboard-types";
import { useVhsTrend } from "../hooks/useVhsTrend";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ranges = [
  { label: "1 ч", hours: 1 },
  { label: "8 ч", hours: 8 },
  { label: "24 ч", hours: 24 },
  { label: "7 дни", hours: 168 },
] as const;

const colors: Record<string, string> = {
  fresh: "#38bdf8",
  recycle: "#34d399",
  drain: "#fb923c",
  power: "#facc15",
  mine: "#a78bfa",
  pump: "#e879f9",
  tail: "#d6b98c",
};

function formatValue(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat("bg-BG", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 1 : 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TrendDialog({
  measurement,
  open,
  onOpenChange,
}: {
  measurement: Measurement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [range, setRange] = useState<(typeof ranges)[number]["label"]>("1 ч");
  const selectedRange = ranges.find((item) => item.label === range) ?? ranges[0];
  const { data: trend, loading } = useVhsTrend(
    measurement?.tag,
    selectedRange.hours,
  );

  const data = useMemo(
    () =>
      trend.map((point, index) => ({
        index,
        value: point.value,
        timestamp: point.timestamp,
      })),
    [trend],
  );

  const stats = useMemo(() => {
    const values = data
      .map((item) => item.value)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) {
      return { low: 0, high: 0, average: 0, switches: 0 };
    }
    const low = Math.min(...values);
    const high = Math.max(...values);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const switches = values.filter(
      (value, index) => index > 0 && value !== values[index - 1],
    ).length;
    return { low, high, average, switches };
  }, [data]);

  const color = colors[measurement?.tone ?? "fresh"] ?? colors.fresh;
  const tickIndexes =
    data.length > 0 ? [0, Math.floor(data.length / 2), data.length - 1] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/10 bg-slate-900 text-slate-100">
        <DialogClose className="absolute right-3 top-3 rounded-sm text-slate-400 opacity-70 transition-opacity hover:opacity-100">
          <X className="size-4" />
          <span className="sr-only">Затвори</span>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>{measurement?.name ?? "Тренд"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {measurement?.tag
              ? `Историческа серия · ${measurement.tag}`
              : "Няма свързан таг"}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={range}
          onValueChange={(value) => {
            if (ranges.some((item) => item.label === value)) {
              setRange(value as (typeof ranges)[number]["label"]);
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-4">
            {ranges.map((item) => (
              <TabsTrigger key={item.label} value={item.label}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {measurement && (
          <>
            <div className="h-[240px] w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Зареждане...
                </div>
              ) : data.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Няма данни за избрания период
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data}
                    margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="vhsTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,.09)" />
                    <XAxis
                      dataKey="index"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      ticks={tickIndexes}
                      tickFormatter={(value: number) => {
                        const point = data[value];
                        return point ? formatTime(point.timestamp) : "";
                      }}
                    />
                    <YAxis
                      width={54}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      tickFormatter={(value: number) =>
                        measurement.kind === "pump"
                          ? value >= 0.5
                            ? "Работи"
                            : "Спряна"
                          : formatValue(value, measurement.unit)
                      }
                    />
                    <Tooltip
                      cursor={{
                        stroke: "rgba(255,255,255,.3)",
                        strokeDasharray: "3 3",
                      }}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid rgba(255,255,255,.15)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      labelFormatter={(value: any) => {
                        const point = data[Number(value)];
                        return point ? formatTime(point.timestamp) : "";
                      }}
                      formatter={(value: any) =>
                        measurement.kind === "pump"
                          ? [
                              Number(value) >= 0.5 ? "Работи" : "Спряна",
                              measurement.name,
                            ]
                          : [formatValue(Number(value), measurement.unit), measurement.name]
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={2}
                      fill="url(#vhsTrendFill)"
                      isAnimationActive={false}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div
              className={`grid gap-2 ${
                measurement.kind === "pump" ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
              {(measurement.kind === "pump"
                ? [
                    ["Време в работа", `${(stats.average * 100).toFixed(0)} %`],
                    ["Превключвания", String(stats.switches)],
                  ]
                : [
                    ["Мин", formatValue(stats.low, measurement.unit)],
                    ["Средно", formatValue(stats.average, measurement.unit)],
                    ["Макс", formatValue(stats.high, measurement.unit)],
                  ]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <p className="text-[10px] text-slate-400">{label}</p>
                  <p className="text-sm font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
