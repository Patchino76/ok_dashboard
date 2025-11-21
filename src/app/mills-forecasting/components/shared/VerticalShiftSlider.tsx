"use client";

import { FC } from "react";
import { Slider } from "@/components/ui/slider";

interface VerticalShiftSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  color: "blue" | "orange" | "purple";
  onChange: (value: number) => void;
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
  onChange,
}) => {
  const colors = colorClasses[color];

  const handleValueChange = (values: number[]) => {
    onChange(values[0]);
  };

  // Format values for display (e.g., 15876 -> 15.9k)
  const formatValue = (val: number) => {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    return val.toString();
  };

  return (
    <div className="flex flex-col items-center w-20">
      {/* Value display */}
      <div
        className={`text-xs font-bold ${colors.text} mb-2 whitespace-nowrap`}
      >
        {Math.round(value)}t
      </div>

      {/* Max value label (top) */}
      <div className="text-[9px] text-slate-400 mb-2">{formatValue(max)}</div>

      {/* Vertical slider - fixed height */}
      <div className="h-48 flex items-center justify-center">
        <Slider
          orientation="vertical"
          min={min}
          max={max}
          step={1}
          value={[value]}
          onValueChange={handleValueChange}
          rangeClassName={colors.range}
          thumbClassName={colors.thumb}
        />
      </div>

      {/* Min value label (bottom) */}
      <div className="text-[9px] text-slate-400 mt-2 mb-2">
        {formatValue(min)}
      </div>

      {/* Label */}
      <div className="text-[10px] font-medium text-slate-600">{label}</div>
    </div>
  );
};
