"use client";

import { useId } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { Measurement } from "./dashboard-types";

const pulpColor = "#d6b98c";

type PressurePoint = { tag: string; label: string; name: string };

const westPoints: PressurePoint[] = [
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE03",
    label: "т.01",
    name: "Западна нитка · т.01 естакада",
  },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE02",
    label: "т.02",
    name: "Западна нитка · т.02 при мост",
  },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE01",
    label: "т.03",
    name: "Западна нитка · т.03 между мост и дебитомер",
  },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE04",
    label: "т.04",
    name: "Западна нитка · т.04 възел C2",
  },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE05",
    label: "т.05",
    name: "Западна нитка · т.05 възел D",
  },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE06",
    label: "т.06",
    name: "Западна нитка · т.06 след шахта 3",
  },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE07",
    label: "т.07",
    name: "Западна нитка · т.07 между естакада и шахта 3",
  },
  {
    tag: "VHS9_HVOSTOPROVOD_PT201",
    label: "PT201",
    name: "Западна нитка · PT201",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_37AE",
    label: "LoRa 1",
    name: "Западна нитка · LoRaWAN между ЖП мост и шахта 03",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78CA",
    label: "LoRa 2",
    name: "Западна нитка · LoRaWAN при шахта 03",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78D3",
    label: "LoRa 3",
    name: "Западна нитка · LoRaWAN след ЖП мост",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78D1",
    label: "LoRa 4",
    name: "Западна нитка · LoRaWAN при мост (A1)",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78C8",
    label: "LoRa 5",
    name: "Западна нитка · LoRaWAN мерителен възел при дебитомер (A1)",
  },
];

const eastPoints: PressurePoint[] = [
  {
    tag: "VHS_LORAWAN_PRESSURE_78C9",
    label: "LoRa 1",
    name: "Източна нитка · LoRaWAN между ЖП мост и шахта 03",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78D0",
    label: "LoRa 2",
    name: "Източна нитка · LoRaWAN при шахта 03",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78CD",
    label: "LoRa 3",
    name: "Източна нитка · LoRaWAN след ЖП мост",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78D5",
    label: "LoRa 4",
    name: "Източна нитка · LoRaWAN при мост (A1)",
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78D8",
    label: "LoRa 5",
    name: "Източна нитка · LoRaWAN мерителен възел при дебитомер (A1)",
  },
];

function activateOnKeyboard(
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

function InteractiveGroup({
  label,
  onActivate,
  children,
  disabled = false,
}: {
  label: string;
  onActivate: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <g
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onActivate}
      onKeyDown={
        disabled ? undefined : (event) => activateOnKeyboard(event, onActivate)
      }
      className={disabled ? "group" : "group cursor-pointer outline-none"}
    >
      {children}
    </g>
  );
}

function ValueChip({
  x,
  y,
  value,
  width = 52,
  warning = false,
  dimmed = false,
}: {
  x: number;
  y: number;
  value: string;
  width?: number;
  warning?: boolean;
  dimmed?: boolean;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={20}
        rx={6}
        fill={warning ? "#fb923c" : "#0b1220"}
        stroke={dimmed ? "#ffffff22" : "#ffffff45"}
        strokeDasharray={dimmed ? "3 3" : undefined}
        className={dimmed ? "" : "transition group-hover:stroke-sky-300"}
      />
      <text
        x={x + width / 2}
        y={y + 14.5}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill={warning ? "#1c1917" : dimmed ? "#64748b" : "#f8fafc"}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </text>
    </>
  );
}

function LevelTank({
  x,
  y,
  width,
  height,
  value,
  max,
  ticks,
  name,
  unit = "mm",
  warning = false,
  axisSide = "left",
  nameAlign = "center",
  tag,
  onSelect,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number | null;
  max: number;
  ticks: [number, string][];
  name: string;
  unit?: string;
  warning?: boolean;
  axisSide?: "left" | "right";
  nameAlign?: "left" | "center" | "right";
  tag?: string;
  onSelect: (measurement: Measurement) => void;
}) {
  const clipId = `tank-${useId().replaceAll(":", "")}`;
  const numericValue = value ?? 0;
  const percentage = Math.max(0, Math.min(1, numericValue / max));
  const fillY = y + height - height * percentage;
  const leftAxis = axisSide === "left";
  const nameX =
    nameAlign === "left"
      ? x
      : nameAlign === "right"
        ? x + width
        : x + width / 2;
  const nameAnchor =
    nameAlign === "left" ? "start" : nameAlign === "right" ? "end" : "middle";

  return (
    <InteractiveGroup
      label={`Тренд: ${name}, ${value ?? "—"} ${unit}`}
      onActivate={() =>
        onSelect({ name, value: numericValue, unit, tone: "tail", tag })
      }
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={7} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={7} fill="#0b1220" />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={x}
          y={fillY}
          width={width}
          height={height * percentage}
          fill="url(#pulp)"
          opacity=".9"
        />
        <rect
          x={x}
          y={fillY}
          width={width}
          height="2"
          fill="#fff"
          opacity=".7"
        />
        {ticks.map(([tick]) => (
          <line
            key={tick}
            x1={x}
            x2={x + width}
            y1={y + height - (tick / max) * height}
            y2={y + height - (tick / max) * height}
            stroke="#fff"
            strokeOpacity=".2"
          />
        ))}
      </g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={7}
        fill="none"
        stroke="#ffffff55"
        className="transition group-hover:stroke-sky-300"
      />
      {ticks.map(([tick, label]) => {
        const tickY = y + height - (tick / max) * height;
        const tickStart = leftAxis ? x : x + width;
        const tickEnd = leftAxis ? x - 5 : x + width + 5;
        const labelX = leftAxis ? x - 8 : x + width + 8;
        return (
          <g key={label}>
            <line
              x1={tickStart}
              x2={tickEnd}
              y1={tickY}
              y2={tickY}
              stroke="#94a3b8"
            />
            <text
              x={labelX}
              y={tickY + 3.5}
              textAnchor={leftAxis ? "end" : "start"}
              fontSize="9.5"
              fill="#cbd5e1"
            >
              {label}
            </text>
          </g>
        );
      })}
      <text
        x={nameX}
        y={y - 6}
        textAnchor={nameAnchor}
        fontSize="11"
        fill="#e2e8f0"
      >
        {name}
      </text>
      <ValueChip
        x={x + width / 2 - 28}
        y={y + height / 2 - 10}
        width={56}
        value={
          value === null ? "—" : new Intl.NumberFormat("bg-BG").format(value)
        }
        warning={warning}
        dimmed={value === null}
      />
    </InteractiveGroup>
  );
}

export function TailingsSchematic({
  values,
  onSelect,
}: {
  values: Record<string, number | null>;
  onSelect: (measurement: Measurement) => void;
}) {
  const rowStart = 186;
  const rowGap = 24;
  const westPipeX = 123;
  const eastPipeX = 297;
  const pipeBottom = rowStart + (westPoints.length - 1) * rowGap + 16;
  const viewHeight = pipeBottom + 30;

  const num = (tag: string): number | null => {
    const v = values[tag];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  return (
    <svg
      viewBox={`0 0 420 ${viewHeight}`}
      className="mx-auto block h-auto w-full max-w-[660px]"
      role="group"
      aria-label="Схема на хвостови шахти и нитки"
    >
      <style>{`
        @keyframes tailings-flow { to { stroke-dashoffset: -20; } }
        @media (prefers-reduced-motion: no-preference) {
          .tailings-flow { animation: tailings-flow 1s linear infinite; }
        }
      `}</style>
      <defs>
        <linearGradient id="pulp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pulpColor} />
          <stop offset="1" stopColor="#78613f" />
        </linearGradient>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset=".45" stopColor="#64748b" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>

      <rect x="124" y="41" width="44" height="10" fill="url(#metal)" />
      <line
        x1="128"
        x2="164"
        y1="46"
        y2="46"
        stroke={pulpColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="8 12"
        className="tailings-flow"
      />
      <path d="M198 68H222L262 102H158Z" fill="url(#metal)" />

      {[westPipeX, eastPipeX].map((centerX) => (
        <g key={centerX}>
          <rect
            x={centerX - 9}
            y="150"
            width="18"
            height={pipeBottom - 150}
            rx="9"
            fill="url(#metal)"
            stroke="#ffffff22"
          />
          <line
            x1={centerX}
            x2={centerX}
            y1="162"
            y2={pipeBottom - 10}
            stroke={pulpColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="8 12"
            className="tailings-flow"
          />
        </g>
      ))}

      <rect
        x={westPipeX - 13}
        y={pipeBottom - 44}
        width="26"
        height="16"
        rx="4"
        fill="#334155"
        stroke="#ffffff30"
      />

      {westPoints.map((point, index) => {
        const rowY = rowStart + index * rowGap;
        const value = num(point.tag);
        return (
          <g key={point.tag}>
            <line
              x1="58"
              x2={westPipeX - 9}
              y1={rowY}
              y2={rowY}
              stroke="#ffffff30"
            />
            <circle
              cx={westPipeX - 9}
              cy={rowY}
              r="3"
              fill={value === null ? "#475569" : pulpColor}
            />
            <InteractiveGroup
              label={
                value === null
                  ? `${point.name}, няма данни`
                  : `Тренд: ${point.name}, ${value.toFixed(2)} bar`
              }
              disabled={value === null}
              onActivate={() => {
                if (value !== null) {
                  onSelect({
                    name: point.name,
                    value,
                    unit: "bar",
                    tone: "tail",
                    tag: point.tag,
                  });
                }
              }}
            >
              <rect
                x="4"
                y={rowY - 12}
                width="56"
                height="24"
                fill="transparent"
              />
              <ValueChip
                x={6}
                y={rowY - 10}
                value={value === null ? "—" : value.toFixed(2)}
                dimmed={value === null}
              />
            </InteractiveGroup>
            <text x="66" y={rowY - 4} fontSize="9" fill="#94a3b8">
              {point.label}
            </text>
          </g>
        );
      })}

      {eastPoints.map((point, index) => {
        const rowY = rowStart + index * rowGap;
        const value = num(point.tag);
        return (
          <g key={point.tag}>
            <line
              x1={eastPipeX + 9}
              x2="362"
              y1={rowY}
              y2={rowY}
              stroke="#ffffff30"
            />
            <circle
              cx={eastPipeX + 9}
              cy={rowY}
              r="3"
              fill={value === null ? "#475569" : pulpColor}
            />
            <InteractiveGroup
              label={
                value === null
                  ? `${point.name}, няма данни`
                  : `Тренд: ${point.name}, ${value.toFixed(2)} bar`
              }
              disabled={value === null}
              onActivate={() => {
                if (value !== null) {
                  onSelect({
                    name: point.name,
                    value,
                    unit: "bar",
                    tone: "tail",
                    tag: point.tag,
                  });
                }
              }}
            >
              <rect
                x="360"
                y={rowY - 12}
                width="56"
                height="24"
                fill="transparent"
              />
              <ValueChip
                x={362}
                y={rowY - 10}
                value={value === null ? "—" : value.toFixed(2)}
                dimmed={value === null}
              />
            </InteractiveGroup>
            <text
              x="356"
              y={rowY - 4}
              textAnchor="end"
              fontSize="9"
              fill="#94a3b8"
            >
              {point.label}
            </text>
          </g>
        );
      })}

      <LevelTank
        x={40}
        y={24}
        width={84}
        height={44}
        value={num("VHS_SHAHTA00")}
        max={1000}
        ticks={[
          [0, "0"],
          [500, "0.5"],
          [1000, "1 m"],
        ]}
        name="Шахта 0"
        tag="VHS_SHAHTA00"
        onSelect={onSelect}
      />
      <LevelTank
        x={168}
        y={24}
        width={84}
        height={44}
        value={num("VHS_SHAHTA03")}
        max={2000}
        ticks={[
          [0, "0"],
          [1000, "1"],
          [2000, "2 m"],
        ]}
        name="Нова шахта 3"
        warning
        axisSide="right"
        tag="VHS_SHAHTA03"
        onSelect={onSelect}
      />
      <LevelTank
        x={40}
        y={102}
        width={166}
        height={52}
        value={num("VHS_ZAPADNANITKA")}
        max={3000}
        ticks={[
          [0, "0"],
          [1000, "1"],
          [2000, "2"],
          [3000, "3 m"],
        ]}
        name="Западна нитка"
        nameAlign="left"
        tag="VHS_ZAPADNANITKA"
        onSelect={onSelect}
      />
      <LevelTank
        x={214}
        y={102}
        width={166}
        height={52}
        value={num("VHS_IZTOCHNANITKA")}
        max={3000}
        ticks={[
          [0, "0"],
          [1000, "1"],
          [2000, "2"],
          [3000, "3 m"],
        ]}
        name="Източна нитка"
        nameAlign="right"
        axisSide="right"
        tag="VHS_IZTOCHNANITKA"
        onSelect={onSelect}
      />

      <g>
        <rect
          x="316"
          y="26"
          width="76"
          height="40"
          rx="8"
          fill="#0f172a"
          stroke="#ffffff40"
        />
        <text x="354" y="41" textAnchor="middle" fontSize="10" fill="#94a3b8">
          Кота
        </text>
        <text
          x="354"
          y="58"
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="#64748b"
        >
          —
        </text>
      </g>
    </svg>
  );
}
