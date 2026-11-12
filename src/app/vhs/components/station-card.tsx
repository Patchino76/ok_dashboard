import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WaterTone } from "./dashboard-types";
import { cn } from "@/lib/utils";

const edgeColors: Record<WaterTone, string> = {
  fresh: "border-t-sky-400/80",
  recycle: "border-t-emerald-400/80",
  drain: "border-t-amber-400/80",
  power: "border-t-yellow-300/80",
  tail: "border-t-stone-300/80",
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
        "gap-3 border-t-2 border-white/10 bg-slate-900/80 py-3 text-slate-100 shadow-lg",
        edgeColors[tone],
        className,
      )}
    >
      <CardHeader className="flex items-start justify-between gap-2 px-3">
        <CardTitle className="text-[13px] leading-snug font-semibold">{title}</CardTitle>
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
