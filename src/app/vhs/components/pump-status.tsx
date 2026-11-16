"use client";

import { Button } from "@/components/ui/button";
import type { Measurement } from "./dashboard-types";
import { cn } from "@/lib/utils";

export type Pump = { id: string; running: boolean; tag?: string };

export function PumpStatus({
  pumps,
  station,
  onSelect,
}: {
  pumps: Pump[];
  station: string;
  onSelect: (measurement: Measurement) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-end gap-x-3 gap-y-2"
      role="group"
      aria-label="Помпи"
    >
      {pumps.map((pump) => (
        <Button
          key={pump.id}
          type="button"
          variant="ghost"
          data-tag={pump.tag ?? ""}
          className="h-auto flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-white/10"
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
              "size-4",
              pump.running && "drop-shadow-[0_0_8px_rgba(52,211,153,.65)]",
            )}
            fill="none"
            stroke={pump.running ? "#34d399" : "#64748b"}
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              color: pump.running ? "#34d399" : "#64748b",
              width: 74.67,
              height: 58.67,
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
      ))}
    </div>
  );
}
