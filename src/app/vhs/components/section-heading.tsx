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

const glowColors: Record<WaterTone, string> = {
  fresh: "group-hover/section:ring-sky-400/25",
  recycle: "group-hover/section:ring-emerald-400/25",
  drain: "group-hover/section:ring-amber-400/25",
  power: "group-hover/section:ring-yellow-300/25",
  tail: "group-hover/section:ring-stone-300/25",
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
      <span
        className={cn(
          "size-2.5 rounded-full ring-0 transition-[box-shadow] duration-200 group-hover/section:ring-4",
          colors[tone],
          glowColors[tone],
        )}
      />
      <h2
        className={cn(
          "text-xl font-semibold tracking-tight transition-[filter] duration-200 group-hover/section:brightness-125 sm:text-2xl",
          textColors[tone],
        )}
      >
        {title}
      </h2>
      <p className="text-xs text-slate-400">{subtitle}</p>
      <div className="hidden h-px flex-1 bg-gradient-to-r from-white/15 to-transparent transition-colors duration-200 group-hover/section:from-white/30 sm:block" />
    </div>
  );
}
