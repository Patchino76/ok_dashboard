"use client";

import React from "react";
import { BarChart3, ImageIcon } from "lucide-react";
import type { ProgressMessage } from "../stores/chat-store";

const STRUCTURED_PREFIX = "STRUCTURED:";

export interface DataTile {
  /** Stage/owner that produced the skill output (e.g. "analyst"). */
  stage: string;
  /** Fully-qualified skill name, e.g. "eda.descriptive_stats". */
  skill: string;
  /** Scalar metrics extracted from the skill's `stats` payload. */
  stats: Record<string, unknown>;
  /** Figure filenames produced by the skill. */
  figures: string[];
}

interface StructuredPayload {
  skill?: string;
  stats?: Record<string, unknown>;
  figures?: string[];
}

/**
 * Parse the `STRUCTURED:{json}` progress events emitted by the backend
 * (graph._stream_structured_outputs) into structured data tiles.
 */
export function extractDataTiles(messages: ProgressMessage[]): DataTile[] {
  const tiles: DataTile[] = [];
  for (const pm of messages || []) {
    if (!pm.message || !pm.message.startsWith(STRUCTURED_PREFIX)) continue;
    const raw = pm.message.slice(STRUCTURED_PREFIX.length).trim();
    try {
      const parsed = JSON.parse(raw) as StructuredPayload;
      tiles.push({
        stage: pm.stage || "specialist",
        skill: parsed.skill || "skill",
        stats:
          parsed.stats && typeof parsed.stats === "object" ? parsed.stats : {},
        figures: Array.isArray(parsed.figures) ? parsed.figures : [],
      });
    } catch {
      // Skip malformed payloads silently.
    }
  }
  return tiles;
}

/** Progress messages with the STRUCTURED data events removed, so the textual
 * feed never shows raw JSON. */
export function stripStructured(messages: ProgressMessage[]): ProgressMessage[] {
  return (messages || []).filter(
    (pm) => !(pm.message && pm.message.startsWith(STRUCTURED_PREFIX)),
  );
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function prettySkill(skill: string): string {
  const fn = skill.includes(".") ? skill.split(".").pop()! : skill;
  return fn
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v);
    if (Number.isInteger(v)) return v.toLocaleString("bg-BG");
    return v.toLocaleString("bg-BG", { maximumFractionDigits: 3 });
  }
  if (typeof v === "boolean") return v ? "да" : "не";
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
  if (Array.isArray(v)) return `${v.length} елем.`;
  if (typeof v === "object") {
    const n = Object.keys(v as Record<string, unknown>).length;
    return `${n} полета`;
  }
  return null;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[11px] text-slate-500 truncate">
        {label.replace(/_/g, " ")}
      </span>
      <span className="text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
        {value}
      </span>
    </div>
  );
}

function Tile({ tile }: { tile: DataTile }) {
  const entries = Object.entries(tile.stats)
    .map(([k, v]) => [k, formatValue(v)] as const)
    .filter((e): e is readonly [string, string] => e[1] !== null)
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
          <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
            {prettySkill(tile.skill)}
          </p>
          <p className="text-[10px] text-slate-400 truncate leading-tight">
            {tile.stage}
          </p>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="divide-y divide-indigo-50">
          {entries.map(([k, v]) => (
            <MetricRow key={k} label={k} value={v} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">Без метрики</p>
      )}

      {tile.figures.length > 0 && (
        <div className="mt-2 pt-2 border-t border-indigo-50 flex items-center gap-1 text-[10px] text-indigo-500">
          <ImageIcon className="w-3 h-3" />
          {tile.figures.length}{" "}
          {tile.figures.length === 1 ? "графика" : "графики"}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a responsive grid of live "data tiles" parsed from the analysis
 * progress stream. Returns null when there is no structured data yet.
 */
export default function DataTiles({
  messages,
}: {
  messages: ProgressMessage[];
}) {
  const tiles = React.useMemo(() => extractDataTiles(messages), [messages]);
  if (tiles.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-indigo-600">
        <BarChart3 className="w-3.5 h-3.5" />
        <span>Метрики на живо ({tiles.length})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tiles.map((tile, i) => (
          <Tile key={`${tile.skill}-${i}`} tile={tile} />
        ))}
      </div>
    </div>
  );
}
