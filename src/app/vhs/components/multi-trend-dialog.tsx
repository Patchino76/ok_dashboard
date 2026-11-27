"use client";

import { useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, List, X } from "lucide-react";
import type { Measurement } from "./dashboard-types";
import { vhsTagByName } from "@/lib/tags/vhs-tags";
import type { TagTrendPoint } from "@/lib/tags/types";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const ranges = [
  { label: "8 ч", hours: 8 },
  { label: "24 ч", hours: 24 },
  { label: "7 дни", hours: 168 },
  { label: "30 дни", hours: 720 },
] as const;

async function fetchTrend(tagName: string, hours: number): Promise<TagTrendPoint[]> {
  const tag = vhsTagByName[tagName];
  if (!tag) return [];
  try {
    const res = await fetch(`/api/tag-trend/${tag.id}?hours=${hours}&points=600`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await res.json();
    if (data?.timestamps && data?.values)
      return data.timestamps.map((timestamp: string, i: number) => ({
        timestamp,
        value: data.values[i],
      }));
  } catch (error) {
    console.error(`Error fetching VHS trend for ${tagName}:`, error);
  }
  return [];
}

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
const fmt = (v: number | null | undefined) =>
  typeof v === "number" ? v.toFixed(1) : "—";

export function MultiTrendDialog({
  measurement,
  open,
  onOpenChange,
}: {
  measurement: Measurement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [hours, setHours] = useState<number>(24);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<number | null>(null);
  const [view, setView] = useState<"detail" | "overview">("detail");
  const plotRef = useRef<HTMLDivElement>(null);
  const series = useMemo(() => measurement?.series ?? [], [measurement]);

  const results = useQueries({
    queries: series.map((s) => ({
      queryKey: ["vhsTrend", s.tag, hours],
      queryFn: () => fetchTrend(s.tag, hours),
      staleTime: 0,
      enabled: open,
    })),
  });
  const loading = results.some((r) => r.isLoading);

  const rows = useMemo(() => {
    const map = new Map<number, Record<string, number | null>>();
    series.forEach((s, i) => {
      (results[i]?.data ?? []).forEach((p) => {
        const t = new Date(p.timestamp).getTime();
        if (Number.isNaN(t) || typeof p.value !== "number") return;
        const row = map.get(t) ?? { t };
        row[s.tag] = p.value;
        map.set(t, row);
      });
    });
    return [...map.values()].sort((a, b) => (a.t as number) - (b.t as number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(","), series]);

  const chart = useMemo(
    () => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickFormatter={fmtTime}
        />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          domain={["auto", "auto"]}
        />
        {series.map((s) =>
          hidden.has(s.tag) ? null : (
            <Line
              key={s.tag}
              dataKey={s.tag}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ),
        )}
      </LineChart>
    </ResponsiveContainer>
    ),
    [rows, series, hidden],
  );

  const idx = rows.length
    ? Math.min(cursor ?? rows.length - 1, rows.length - 1)
    : 0;
  const current = rows[idx];
  const t0 = (rows[0]?.t as number) ?? 0;
  const t1 = (rows[rows.length - 1]?.t as number) ?? 1;
  // Plot area inside the container: p-2 (8px) + YAxis width 36 on the left, 12px right margin.
  const PLOT_L = 44;
  const PLOT_R = 20;
  const scrub = (clientX: number) => {
    const el = plotRef.current;
    if (!el || rows.length < 2) return;
    const box = el.getBoundingClientRect();
    const frac = Math.min(
      1,
      Math.max(0, (clientX - box.left - PLOT_L) / (box.width - PLOT_L - PLOT_R)),
    );
    const target = t0 + frac * (t1 - t0);
    let best = 0;
    for (let i = 1; i < rows.length; i++)
      if (Math.abs((rows[i].t as number) - target) < Math.abs((rows[best].t as number) - target))
        best = i;
    setCursor(best);
  };

  const stats = (tag: string) => {
    const v = rows.map((r) => r[tag]).filter((x): x is number => typeof x === "number");
    if (!v.length) return null;
    return {
      min: Math.min(...v),
      max: Math.max(...v),
      avg: v.reduce((a, b) => a + b, 0) / v.length,
    };
  };
  // Value at the cursor, falling back to the nearest earlier sample.
  const valueAt = (tag: string) => {
    for (let i = idx; i >= 0; i--) {
      const v = rows[i]?.[tag];
      if (typeof v === "number") return v;
    }
    return null;
  };
  const sparkline = (tag: string) => {
    const pts = rows
      .map((r) => [r.t as number, r[tag]] as const)
      .filter((p): p is readonly [number, number] => typeof p[1] === "number");
    if (pts.length < 2) return null;
    const lo = Math.min(...pts.map((p) => p[1]));
    const hi = Math.max(...pts.map((p) => p[1]));
    const span = hi - lo || 1;
    return pts
      .map(
        ([t, v]) =>
          `${(((t - t0) / (t1 - t0 || 1)) * 300).toFixed(1)},${(36 - ((v - lo) / span) * 32).toFixed(1)}`,
      )
      .join(" ");
  };
  const latest = series.map((s) => {
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = rows[i][s.tag];
      if (typeof v === "number") return v;
    }
    return null;
  });
  const toggle = (tag: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setHours(24);
          setHidden(new Set());
          setCursor(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl gap-3 overflow-y-auto border-white/10 bg-slate-900 p-3 text-slate-100 sm:gap-4 sm:p-6">
        <DialogClose className="absolute right-3 top-3 rounded-sm text-slate-400 opacity-70 hover:opacity-100">
          <X className="size-4" />
          <span className="sr-only">Затвори</span>
        </DialogClose>
        <button
          type="button"
          onClick={() => setView((v) => (v === "detail" ? "overview" : "detail"))}
          aria-label={view === "detail" ? "Всички тенденции" : "Детайлен изглед"}
          title={view === "detail" ? "Всички тенденции" : "Детайлен изглед"}
          className="absolute right-9 top-3 flex size-6 items-center justify-center rounded-full border border-sky-400/40 text-sky-300 transition-colors hover:bg-sky-400/10"
        >
          {view === "detail" ? <List className="size-3.5" /> : <Activity className="size-3.5" />}
        </button>
        <DialogHeader className="pr-14 text-left">
          <DialogTitle className="text-base sm:text-lg leading-tight">
            {[measurement?.station, measurement?.name].filter(Boolean).join(" · ")}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {rows.length
              ? `${fmtTime(rows[0].t as number)} – ${fmtTime(rows[rows.length - 1].t as number)}`
              : "Температури"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2">
          <Tabs value={`${hours}`} onValueChange={(v) => { setHours(Number(v)); setCursor(null); }}>
            <TabsList className="grid w-full grid-cols-4">
              {ranges.map((r) => (
                <TabsTrigger key={r.hours} value={`${r.hours}`}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {view === "detail" && (
            <span className="hidden text-xs text-slate-400 sm:inline">
              Натиснете ред, за да покажете/скриете сензор
            </span>
          )}
        </div>
        {view === "overview" ? (
          <div>
            {loading ? (
              <div className="py-10 text-center text-xs text-slate-400">Зареждане...</div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">Няма данни за избрания период</div>
            ) : (
              series.map((s, i) => {
                const points = sparkline(s.tag);
                const st = stats(s.tag);
                return (
                  <div
                    key={s.tag}
                    className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-2 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-3 border-t border-white/5 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      <div className="min-w-0">
                        <div className="text-sm leading-tight text-slate-300 sm:truncate">{s.name}</div>
                        <div className="text-[11px] tabular-nums text-slate-500">
                          avg <b className="font-semibold text-slate-300">{st ? `${Math.round(st.avg)}°` : "—"}</b>
                          <span className="ml-2">max</span>{" "}
                          <b className="font-semibold text-slate-300">{st ? `${Math.round(st.max)}°` : "—"}</b>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="h-9 min-w-0 flex-1">
                        {points && (
                          <polyline
                            points={points}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={2}
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </svg>
                      <span
                        className="w-10 shrink-0 text-right text-lg font-semibold tabular-nums sm:w-12 sm:text-left sm:text-xl"
                        style={{ color: s.color }}
                      >
                        {latest[i] === null ? "—" : `${Math.round(latest[i] as number)}°`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
        <>
        <div
          ref={plotRef}
          className="relative h-[220px] w-full sm:h-[260px] rounded-lg border border-white/10 bg-slate-950/60 p-2"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              Зареждане...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              Няма данни за избрания период
            </div>
          ) : (
            chart
          )}
          {rows.length > 1 && !loading && current && (
            <>
              <div
                className="pointer-events-none absolute w-px bg-white/50"
                style={{
                  top: 16,
                  bottom: 30,
                  left: `calc(${PLOT_L}px + (100% - ${PLOT_L + PLOT_R}px) * ${t1 > t0 ? ((current.t as number) - t0) / (t1 - t0) : 0})`,
                }}
              />
              <div
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  scrub(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (e.pointerType === "mouse" || e.buttons) scrub(e.clientX);
                }}
              />
            </>
          )}
        </div>
        {rows.length > 1 && (
          <Slider
            min={0}
            max={rows.length - 1}
            step={1}
            value={[idx]}
            onValueChange={([v]) => setCursor(v)}
            aria-label="Времева позиция"
            trackClassName="h-1.5 bg-slate-700"
            rangeClassName="bg-sky-400"
            thumbClassName="h-4 w-4 border-sky-300 bg-slate-900"
          />
        )}
        <table className="w-full text-xs tabular-nums sm:text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="py-1 text-left font-normal">Сензор</th>
              <th className="text-right font-normal">{current ? fmtTime(current.t as number) : ""}</th>
              <th className="text-right font-normal">Мин</th>
              <th className="text-right font-normal">Средно</th>
              <th className="text-right font-normal">Макс</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => {
              const st = stats(s.tag);
              const off = hidden.has(s.tag);
              return (
                <tr
                  key={s.tag}
                  onClick={() => toggle(s.tag)}
                  className={cn(
                    "cursor-pointer border-t border-white/5 hover:bg-white/5",
                    off && "opacity-40",
                  )}
                >
                  <td className="py-1.5">
                    <span
                      className="mr-2 inline-block size-3 rounded-sm align-middle"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </td>
                  <td className="text-right font-semibold">{fmt(valueAt(s.tag))}°</td>
                  <td className="text-right text-slate-300">{fmt(st?.min)}</td>
                  <td className="text-right text-slate-300">{fmt(st?.avg)}</td>
                  <td className="text-right text-slate-300">{fmt(st?.max)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
