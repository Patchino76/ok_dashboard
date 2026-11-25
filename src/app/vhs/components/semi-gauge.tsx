"use client";

import { useId } from "react";
import type { Measurement, WaterTone } from "./dashboard-types";
import { Button } from "@/components/ui/button";

export function SemiGauge({
  name,
  value,
  min = 0,
  max = 1,
  ticks,
  unit,
  tone = "fresh",
  decimals = 2,
  tag,
  onSelect,
}: {
  name: string;
  value: number | null;
  min?: number;
  max?: number;
  ticks?: number[];
  unit: string;
  tone: WaterTone;
  decimals?: number;
  tag?: string;
  onSelect: (measurement: Measurement) => void;
}) {
  const gradId = useId();
  const fraction =
    value === null || max === min
      ? 0
      : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 40;
  const cx = 50;
  const cy = 48;
  const arc = Math.PI * r;
  const pointAt = (f: number, radius: number) => {
    const a = Math.PI * (1 - f);
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
  };
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const [nx, ny] = pointAt(fraction, r - 8);
  const measurement: Measurement = {
    name,
    value: value ?? 0,
    unit,
    tone,
    tag,
  };

  return (
    <Button
      type="button"
      variant="ghost"
      data-tag={tag ?? ""}
      className="h-auto w-full flex-col gap-0 rounded-lg px-1.5 py-1 text-slate-100 ring-1 ring-transparent transition-all duration-200 ease-out hover:bg-sky-400/20 hover:bg-sky-400/15 hover:ring-sky-300/70 hover:shadow-md hover:shadow-sky-400/20 active:bg-sky-400/25 active:ring-sky-300"
      aria-label={`Покажи тренд: ${name}`}
      onClick={() => onSelect(measurement)}
    >
      <span className="text-[10px] text-slate-400">{name}</span>
      <svg viewBox="0 -6 100 62" className="h-20 w-full max-w-40">
        <path
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={8}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1={cx - r}
            y1={0}
            x2={cx + r}
            y2={0}
          >
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="35%" stopColor="#7dd3a8" />
            <stop offset="65%" stopColor="#ca9a4a" />
            <stop offset="100%" stopColor="#78502a" />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${arc * fraction} ${arc}`}
          style={{ transition: "stroke-dasharray 700ms" }}
        />
        {(ticks ?? [min, max]).map((tick) => {
          const f = max === min ? 0 : (tick - min) / (max - min);
          const [x, y] = pointAt(f, r + 8);
          return (
            <text
              key={tick}
              x={x}
              y={y + 2}
              textAnchor="middle"
              fontSize={7}
              fill="#94a3b8"
            >
              {tick}
            </text>
          );
        })}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#f1f5f9"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={2.5} fill="#f1f5f9" />
      </svg>
      <span className="text-lg leading-tight font-bold text-slate-50 tabular-nums">
        {value === null ? "—" : value.toFixed(decimals)}{" "}
        <span className="text-xs font-normal text-slate-300">{unit}</span>
      </span>
    </Button>
  );
}
