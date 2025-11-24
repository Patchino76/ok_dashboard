"use client";

import { FC } from "react";
import { Slider } from "@/components/ui/slider";
import { Lock, Unlock } from "lucide-react";

interface VerticalShiftSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  color: "blue" | "orange" | "purple";
  isLocked: boolean;
  canLock: boolean;
  onChange: (value: number) => void;
  onToggleLock: () => void;
}

const colorClasses = {
  blue: {
    range: "bg-blue-500",
    thumb: "border-blue-600 bg-blue-500",
    text: "text-blue-900",
  },
  orange: {
    range: "bg-amber-500",
    thumb: "border-amber-600 bg-amber-500",
    text: "text-amber-900",
  },
  purple: {
    range: "bg-purple-500",
    thumb: "border-purple-600 bg-purple-500",
    text: "text-purple-900",
  },
};

export const VerticalShiftSlider: FC<VerticalShiftSliderProps> = ({
  label,
  value,
  min,
  max,
  color,
  isLocked,
  canLock,
  onChange,
  onToggleLock,
}) => {
  const colors = colorClasses[color];

  const handleValueChange = (values: number[]) => {
    if (!isLocked) {
      onChange(values[0]);
    }
  };

  // Format values for display (e.g., 15876 -> 15.9k)
  const formatValue = (val: number) => {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    return val.toString();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Lock/Unlock button - Left side, vertically centered */}
      <button
        onClick={onToggleLock}
        disabled={!isLocked && !canLock}
        className={`p-1 rounded-md transition-all ${
          isLocked
            ? "bg-red-100 hover:bg-red-200 text-red-600"
            : canLock
            ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
            : "bg-slate-50 text-slate-300 cursor-not-allowed"
        }`}
        title={
          isLocked
            ? "Click to unlock"
            : canLock
            ? "Click to lock (max 2 shifts)"
            : "Cannot lock (max 2 shifts already locked)"
        }
      >
        {isLocked ? (
          <Lock className="h-3 w-3" />
        ) : (
          <Unlock className="h-3 w-3" />
        )}
      </button>

      {/* Slider column */}
      <div className="flex flex-col items-center w-20">
        {/* Value display */}
        <div
          className={`text-xs font-bold ${colors.text} mb-2 whitespace-nowrap ${
            isLocked ? "opacity-50" : ""
          }`}
        >
          {Math.round(value)}t
        </div>

        {/* Max value label (top) */}
        <div
          className={`text-[9px] text-slate-400 mb-2 ${
            isLocked ? "opacity-50" : ""
          }`}
        >
          {formatValue(max)}
        </div>

        {/* Vertical slider - fixed height */}
        <div
          className={`h-48 flex items-center justify-center ${
            isLocked ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <Slider
            orientation="vertical"
            min={min}
            max={max}
            step={1}
            value={[value]}
            onValueChange={handleValueChange}
            rangeClassName={colors.range}
            thumbClassName={colors.thumb}
            disabled={isLocked}
          />
        </div>

        {/* Min value label (bottom) */}
        <div
          className={`text-[9px] text-slate-400 mt-2 mb-2 ${
            isLocked ? "opacity-50" : ""
          }`}
        >
          {formatValue(min)}
        </div>

        {/* Label */}
        <div
          className={`text-[10px] font-medium text-slate-600 ${
            isLocked ? "opacity-50" : ""
          }`}
        >
          {label} {isLocked && "🔒"}
        </div>
      </div>
    </div>
  );
};
