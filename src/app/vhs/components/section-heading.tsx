import { cn } from "@/lib/utils";
import type { WaterTone } from "./dashboard-types";

const colors: Record<WaterTone, string> = {
  fresh: "bg-sky-400",
  recycle: "bg-emerald-400",
  drain: "bg-amber-400",
  power: "bg-yellow-300",
  tail: "bg-stone-300",
};

const textColors: Record<WaterTone, string> = {
  fresh: "text-sky-300",
  recycle: "text-emerald-300",
  drain: "text-amber-300",
  power: "text-yellow-200",
  tail: "text-stone-200",
};

export function SectionHeading({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle: string;
  tone: WaterTone;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={cn("size-2.5 rounded-full", colors[tone])} />
      <h2 className={cn("text-xl font-semibold tracking-tight sm:text-2xl", textColors[tone])}>
        {title}
      </h2>
      <p className="text-xs text-slate-400">{subtitle}</p>
      <div className="hidden h-px flex-1 bg-gradient-to-r from-white/15 to-transparent sm:block" />
    </div>
  );
}
