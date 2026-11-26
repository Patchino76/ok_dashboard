"use client";

import { Button } from "@/components/ui/button";
import type { Measurement } from "./dashboard-types";
import { cn } from "@/lib/utils";

export type Pump = {
  id: string;
  running: boolean;
  tag?: string;
  small?: boolean;
};

export function PumpStatus({
  pumps,
  station,
  aligned = false,
  onSelect,
}: {
  pumps: Pump[];
  station: string;
  aligned?: boolean;
  onSelect: (measurement: Measurement) => void;
}) {
  const grouped = pumps.some((pump) => pump.small);
  const renderPump = (pump: Pump) => (
        <Button
          key={pump.id}
          type="button"
          variant="ghost"
          data-tag={pump.tag ?? ""}
          className="h-auto min-w-0 shrink flex-col gap-1 rounded-md px-1 py-1.5 ring-1 ring-transparent transition-all duration-200 ease-out hover:bg-sky-400/20 hover:bg-sky-400/15 hover:ring-sky-300/70 hover:shadow-md hover:shadow-sky-400/20 active:bg-sky-400/25 active:ring-sky-300"
          aria-label={`${station}, помпа ${pump.id}: ${pump.running ? "работи" : "спряна"}. Покажи тренд.`}
          onClick={() =>
            onSelect({
              name: `Помпа ${pump.id}`,
              value: pump.running ? "Работи" : "Спряна",
              unit: "",
              kind: "pump",
              on: pump.running,
              tone: "pump",
              tag: pump.tag,
            })
          }
        >
          <svg
            viewBox="0 0 44 36"
            className={cn(
              "h-auto max-w-full",
              pump.running && "drop-shadow-[0_0_8px_rgba(52,211,153,.65)]",
            )}
            fill="none"
            stroke={pump.running ? "#34d399" : "#64748b"}
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              color: pump.running ? "#34d399" : "#64748b",
              width: pump.small ? 40 : 74.67,
            }}
            aria-hidden="true"
          >
            <rect
              x="4"
              y="32"
              width="36"
              height="3"
              rx="1"
              fill="currentColor"
              fillOpacity=".25"
            />
            <rect
              x="2"
              y="14"
              width="11"
              height="14"
              rx="2.5"
              fill="currentColor"
              fillOpacity=".18"
            />
            <path
              d="M5.5 16v10M8 16v10M10.5 16v10M13 21h4M30 11V4M26.5 4h7M26.5 6.5h7"
              strokeWidth="1.3"
            />
            <circle
              cx="25"
              cy="21"
              r="10"
              fill="currentColor"
              fillOpacity=".15"
            />
            <path d="M17 29l-3 3M33 29l3 3" />
            <g
              className={cn(
                pump.running &&
                  "motion-safe:animate-spin [animation-duration:1.2s]",
              )}
              style={{ transformOrigin: "25px 21px" }}
              strokeWidth="1.4"
            >
              <path d="M25 21c0-4 1-6 3-7M25 21c4 0 6 1 7 3M25 21c0 4-1 6-3 7M25 21c-4 0-6-1-7-3" />
            </g>
            <circle cx="25" cy="21" r="1.6" fill="currentColor" />
          </svg>
          <span
            className={cn(
              "text-[11px] font-medium leading-none tabular-nums",
              pump.running ? "text-emerald-300" : "text-slate-500",
            )}
          >
            {pump.id}
          </span>
        </Button>
  );

  return (
    <div
      className={cn(
        aligned
          ? "grid items-end justify-items-center gap-x-1.5"
          : grouped
          ? "grid grid-cols-4 items-end justify-items-center gap-x-1.5"
          : "flex flex-nowrap items-end justify-center gap-x-1",
      )}
      style={
        aligned
          ? { gridTemplateColumns: `repeat(${pumps.length}, minmax(0, 1fr))` }
          : undefined
      }
      role="group"
      aria-label="Помпи"
    >
      {grouped ? (
        <>
          {pumps.filter((pump) => !pump.small).map(renderPump)}
          <div className="flex min-w-0 items-end justify-center gap-x-1">
            {pumps.filter((pump) => pump.small).map(renderPump)}
          </div>
        </>
      ) : (
        pumps.map(renderPump)
      )}
    </div>
  );
}
