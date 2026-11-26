"use client";

import { useId } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { Measurement } from "./dashboard-types";

const pulpColor = "#d6b98c";

type PressurePoint = { tag: string | null; name: string };

const W = "Западна нитка";
const E = "Източна нитка";

const westPoints: PressurePoint[] = [
  { tag: "VHS_LORAWAN_PRESSURE_78D3", name: `${W} · LoRaWAN след ЖП мост` },
  {
    tag: "VHS_LORAWAN_PRESSURE_37AE",
    name: `${W} · LoRaWAN между ЖП мост и шахта 03`,
  },
  { tag: "VHS_LORAWAN_PRESSURE_78CA", name: `${W} · LoRaWAN при шахта 03` },
  { tag: "VHS_HVOSTOPROVOD_PRESUSRE06", name: `${W} · т.06 след шахта 3` },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE07",
    name: `${W} · т.07 между естакада и шахта 3`,
  },
  { tag: "VHS_HVOSTOPROVOD_PRESUSRE03", name: `${W} · т.01 естакада` },
  { tag: "VHS_LORAWAN_PRESSURE_78D1", name: `${W} · LoRaWAN при мост (A1)` },
  {
    tag: "VHS_HVOSTOPROVOD_PRESUSRE01",
    name: `${W} · т.03 между мост и дебитомер`,
  },
  {
    tag: "VHS_LORAWAN_PRESSURE_78C8",
    name: `${W} · LoRaWAN мерителен възел при дебитомер (A1)`,
  },
  { tag: "VHS_HVOSTOPROVOD_PRESUSRE04", name: `${W} · т.04 възел C2` },
];

const eastPoints: PressurePoint[] = [
  { tag: "VHS_LORAWAN_PRESSURE_78CD", name: `${E} · LoRaWAN след ЖП мост` },
  {
    tag: "VHS_LORAWAN_PRESSURE_78C9",
    name: `${E} · LoRaWAN между ЖП мост и шахта 03`,
  },
  { tag: "VHS_LORAWAN_PRESSURE_78D0", name: `${E} · LoRaWAN при шахта 03` },
  { tag: null, name: E },
  { tag: null, name: E },
  { tag: null, name: E },
  { tag: "VHS_LORAWAN_PRESSURE_78D5", name: `${E} · LoRaWAN при мост (A1)` },
  { tag: null, name: E },
  {
    tag: "VHS_LORAWAN_PRESSURE_78D8",
    name: `${E} · LoRaWAN мерителен възел при дебитомер (A1)`,
  },
  { tag: null, name: E },
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
  tag,
}: {
  tag?: string;
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
      data-tag={tag ?? ""}
      onClick={disabled ? undefined : onActivate}
      onKeyDown={
        disabled ? undefined : (event) => activateOnKeyboard(event, onActivate)
      }
      className={disabled ? "group" : "group cursor-pointer outline-none transition-[filter] duration-200 ease-out [&:hover]:[filter:drop-shadow(0_0_6px_rgba(125,211,252,.95))] [&:active]:[filter:drop-shadow(0_0_10px_rgba(125,211,252,1))] focus-visible:[filter:drop-shadow(0_0_6px_rgba(125,211,252,.8))]"}
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

function PressureSensor({
  point,
  rowY,
  side,
  value,
  onSelect,
}: {
  point: PressurePoint;
  rowY: number;
  side: "left" | "right";
  value: number | null;
  onSelect: (measurement: Measurement) => void;
}) {
  const left = side === "left";
  const pipeEdge = left ? 114 : 306;
  const gx = left ? 82 : 338;
  const chipX = left ? 6 : 362;
  const sign = left ? 1 : -1;
  const installed = point.tag !== null;
  const stroke = !installed ? "#334155" : value === null ? "#64748b" : pulpColor;
  const angle = -120 + Math.max(0, Math.min(1, (value ?? 0) / 12)) * 240;
  const rad = ((angle - 90) * Math.PI) / 180;

  const chip = installed && (
    <>
      <line
        x1={left ? chipX + 52 : gx + 8.5}
        x2={left ? gx - 8.5 : chipX}
        y1={rowY}
        y2={rowY}
        stroke="#ffffff30"
      />
      <ValueChip
        x={chipX}
        y={rowY - 10}
        value={value === null ? "—" : value.toFixed(2)}
        dimmed={value === null}
      />
    </>
  );

  const sensor = (
    <>
      <line
        x1={gx + sign * 8.5}
        x2={pipeEdge}
        y1={rowY}
        y2={rowY}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <rect
        x={left ? pipeEdge - 5 : pipeEdge}
        y={rowY - 5}
        width="5"
        height="10"
        rx="1.5"
        fill="#334155"
        stroke={stroke}
      />
      <circle
        cx={gx}
        cy={rowY}
        r="8.5"
        fill="#0b1220"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <circle
        cx={gx}
        cy={rowY}
        r="6"
        fill="none"
        stroke={stroke}
        strokeOpacity=".35"
        strokeDasharray="1.5 2"
      />
      {installed && (
        <line
          x1={gx}
          y1={rowY}
          x2={gx + Math.cos(rad) * 5.5}
          y2={rowY + Math.sin(rad) * 5.5}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      <circle cx={gx} cy={rowY} r="1.3" fill={stroke} />
    </>
  );

  if (!installed) {
    return (
      <g opacity=".6">
        <title>Няма сензор</title>
        {sensor}
      </g>
    );
  }

  return (
    <InteractiveGroup
      label={
        value === null
          ? `${point.name}, няма данни`
          : `Тренд: ${point.name}, ${value.toFixed(2)} bar`
      }
      disabled={value === null}
      tag={point.tag ?? undefined}
      onActivate={() => {
        if (value !== null)
          onSelect({
            name: point.name,
            value,
            unit: "bar",
            tone: "tail",
            tag: point.tag ?? undefined,
          });
      }}
    >
      <rect
        x={left ? 4 : 326}
        y={rowY - 12}
        width={left ? 96 : 90}
        height="24"
        fill="transparent"
      />
      {chip}
      {sensor}
    </InteractiveGroup>
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
      tag={tag}
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
          value === null
            ? "—"
            : new Intl.NumberFormat("bg-BG", {
                maximumFractionDigits: 0,
              }).format(value)
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
  const rowGap = 28;
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

      <rect x="206" y="45" width="8" height="10" fill="url(#metal)" />
      <path d="M198 76H222L262 102H158Z" fill="url(#metal)" />

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
        y={rowStart + 8 * rowGap - 8}
        width="26"
        height="16"
        rx="4"
        fill="#334155"
        stroke="#ffffff30"
      />

      {westPoints.map((point, index) => (
        <PressureSensor
          key={`w${index}`}
          point={point}
          rowY={rowStart + index * rowGap}
          side="left"
          value={point.tag ? num(point.tag) : null}
          onSelect={onSelect}
        />
      ))}
      {eastPoints.map((point, index) => (
        <PressureSensor
          key={`e${index}`}
          point={point}
          rowY={rowStart + index * rowGap}
          side="right"
          value={point.tag ? num(point.tag) : null}
          onSelect={onSelect}
        />
      ))}

      <LevelTank
        x={40}
        y={24}
        width={166}
        height={52}
        value={num("VHS_SHAHTA00")}
        max={1000}
        ticks={[
          [0, "0"],
          [500, "0.5"],
          [1000, "1 m"],
        ]}
        name="Шахта 0"
        nameAlign="left"
        tag="VHS_SHAHTA00"
        onSelect={onSelect}
      />
      <LevelTank
        x={214}
        y={24}
        width={166}
        height={52}
        value={num("VHS_SHAHTA_NOVA")}
        max={2000}
        ticks={[
          [0, "0"],
          [1000, "1"],
          [2000, "2 m"],
        ]}
        name="Нова шахта 3"
        nameAlign="right"
        axisSide="right"
        tag="VHS_SHAHTA_NOVA"
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
        value={num("VHS_SHAHTA_NITKA_IZTOK")}
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
        tag="VHS_SHAHTA_NITKA_IZTOK"
        onSelect={onSelect}
      />
    </svg>
  );
}
