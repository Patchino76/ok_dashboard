import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WaterTone } from "./dashboard-types";
import { cn } from "@/lib/utils";

const edgeColors: Record<WaterTone, string> = {
  fresh: "border-t-sky-400/80",
  recycle: "border-t-emerald-400/80",
  drain: "border-t-amber-400/80",
  power: "border-t-yellow-300/80",
  tail: "border-t-stone-300/80",
};

const hoverAccents: Record<WaterTone, string> = {
  fresh:
    "hover:border-t-sky-300 focus-within:border-t-sky-300 hover:ring-sky-400/50 focus-within:ring-sky-400/50 hover:shadow-sky-500/25 focus-within:shadow-sky-500/25",
  recycle:
    "hover:border-t-emerald-300 focus-within:border-t-emerald-300 hover:ring-emerald-400/50 focus-within:ring-emerald-400/50 hover:shadow-emerald-500/25 focus-within:shadow-emerald-500/25",
  drain:
    "hover:border-t-amber-300 focus-within:border-t-amber-300 hover:ring-amber-400/50 focus-within:ring-amber-400/50 hover:shadow-amber-500/25 focus-within:shadow-amber-500/25",
  power:
    "hover:border-t-yellow-200 focus-within:border-t-yellow-200 hover:ring-yellow-300/50 focus-within:ring-yellow-300/50 hover:shadow-yellow-400/25 focus-within:shadow-yellow-400/25",
  tail: "hover:border-t-stone-200 focus-within:border-t-stone-200 hover:ring-stone-300/50 focus-within:ring-stone-300/50 hover:shadow-stone-300/25 focus-within:shadow-stone-300/25",
};

export function StationCard({
  title,
  tone,
  status,
  children,
  className,
}: {
  title: string;
  tone: WaterTone;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "gap-3 border-t-2 border-white/10 bg-slate-900/80 py-3 text-slate-100 shadow-lg ring-1 ring-transparent transition-all duration-300 ease-out hover:bg-slate-800/90 hover:ring-white/25 hover:shadow-xl focus-within:bg-slate-800/90 focus-within:shadow-xl active:bg-slate-800 active:ring-white/30",
        edgeColors[tone],
        hoverAccents[tone],
        className,
      )}
    >
      <CardHeader className="flex items-start justify-between gap-2 px-3">
        <CardTitle className="text-[13px] leading-snug font-semibold">
          {title}
        </CardTitle>
        {status}
      </CardHeader>
      <CardContent className="grid gap-3 px-3">{children}</CardContent>
    </Card>
  );
}

export function PumpCountBadge({
  total,
  running,
}: {
  total: number;
  running: number;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 border-white/15 px-1.5 text-[10px] tabular-nums",
        running ? "text-emerald-300" : "text-slate-400",
      )}
    >
      {running}/{total}
    </Badge>
  );
}
