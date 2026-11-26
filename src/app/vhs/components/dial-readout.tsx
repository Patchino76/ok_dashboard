"use client";

import type { Measurement, WaterTone } from "./dashboard-types";

export function DialReadout({
  name,
  value,
  tag,
  tone,
  max = 10,
  side,
  onSelect,
}: {
  side?: "left" | "right" | "top";
  name: string;
  value: number | null;
  tag?: string;
  tone: WaterTone;
  max?: number;
  onSelect: (m: Measurement) => void;
}) {
  const color = value === null ? "#64748b" : tone === "recycle" ? "#34d399" : "#38bdf8";
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
  const dial = (
    <svg viewBox="-10 -10 20 20" className="h-5 w-5 shrink-0" aria-hidden>
      <circle r="8.5" fill="#0b1220" stroke={color} strokeWidth="1.5" />
      <circle r="6" fill="none" stroke={color} strokeOpacity=".35" strokeDasharray="1.5 2" />
      <line x2={Math.cos(rad) * 5.5} y2={Math.sin(rad) * 5.5} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle r="1.3" fill={color} />
    </svg>
  );
  const stub = <span className="h-[2px] w-2 shrink-0" style={{ background: color }} />;

  if (side === "top")
    return (
      <div className="flex items-start gap-1">
        <div className="flex flex-col items-center">
          {dial}
          <span className="h-1.5 w-[2px]" style={{ background: color }} />
        </div>
        <div className="flex h-5 items-center">{chip}</div>
      </div>
    );
  return (
    <div className="flex items-center gap-1">
      {side === "right" ? (
        <>
          {stub}
          {dial}
          {chip}
        </>
      ) : (
        <>
          {dial}
          {chip}
        </>
      )}
    </div>
  );
}
