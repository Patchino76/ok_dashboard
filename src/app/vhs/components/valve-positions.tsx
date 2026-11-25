import type { Measurement } from "./dashboard-types";

export type Valve = { name: string; tag: string; value: number | null };

function state(p: number | null) {
  if (p === null) return { label: "—", color: "#64748b" };
  if (p <= 1) return { label: "ЗАТВОРЕНО", color: "#94a3b8" };
  if (p >= 99) return { label: "ОТВОРЕНО", color: "#34d399" };
  return { label: "ЧАСТИЧНО", color: "#38bdf8" };
}

export function ValvePositions({
  valves,
  onSelect,
  tone = "recycle",
  columns = 3,
}: {
  columns?: number;
  tone?: Measurement["tone"];
  valves: Valve[];
  onSelect: (measurement: Measurement) => void;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {valves.map((v) => {
        const p = v.value === null ? null : Math.min(100, Math.max(0, v.value));
        const s = state(p);
        return (
          <button
            key={v.tag}
            type="button"
            title={`Клапа ${v.name}`}
            onClick={() =>
              onSelect({
                name: `Клапа ${v.name}`,
                value: p === null ? "—" : Math.round(p),
                unit: "%",
                tone,
                tag: v.tag,
              })
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-left transition hover:bg-white/[0.08] active:scale-[0.98]"
          >
            <div className="flex items-center text-[8px] uppercase sm:text-[9px]">
              <span className="flex items-center gap-1" style={{ color: s.color }}>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                />
                {s.label}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-0.5 tabular-nums">
              <span className="text-base font-semibold text-slate-100 sm:text-lg">
                {p === null ? "—" : Math.round(p)}
              </span>
              <span className="text-[10px] text-slate-400">%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${p ?? 0}%`,
                  background: `linear-gradient(90deg, ${s.color}99, ${s.color})`,
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
