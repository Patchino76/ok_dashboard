"use client";
import React from "react";
import { getParameterByValue } from "./ParameterSelector";
import { useMillRangesStore } from "@/lib/store/millRangesStore";

interface SimpleBarChartProps {
  data: Array<{ [key: string]: any }>;
  nameKey?: string;
  valueKey?: string;
  valueLabel?: string;
  thresholds?: {
    low: number;
    high: number;
  };
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  nameKey = "mill_name",
  valueKey = "parameter_value",
  valueLabel = "",
  thresholds,
}) => {
  // Find the maximum value for scaling
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey]) || 0));

  // Get colors from store
  const { lowColor, yellowColor, highColor } = useMillRangesStore();

  // Use provided thresholds if available, otherwise use defaults
  const millValues = data.map((item) => Number(item[valueKey]) || 0);
  const calculatedThresholds = thresholds || { low: 0, high: 0 };

  // Color thresholds based on value
  const getBarColor = (value: number) => {
    if (value >= calculatedThresholds.high) return highColor; // High - Green by default
    if (value >= calculatedThresholds.low) return yellowColor; // Between low and high - Yellow by default
    return lowColor; // Below low - Red by default
  };

  // Debug thresholds
  console.log("Bar chart using thresholds:", calculatedThresholds);

  return (
    <div className="w-full h-full flex flex-col px-4">
      {/* Horizontal bars container */}
      <div className="flex-1 flex flex-col justify-between gap-3 overflow-y-auto">
        {data.map((item) => {
          const value = Number(item[valueKey]) || 0;
          const percentage = maxValue > 0 ? value / maxValue : 0;
          const barWidth = `${Math.max(percentage * 100, 2)}%`;
          const color = getBarColor(value);
          const name = String(item[nameKey] || "");

          return (
            <div key={name} className="flex items-center w-full gap-1">
              {/* Name */}
              <div className="w-16 text-xs font-medium text-right truncate pr-2">
                {name}
              </div>

              {/* Bar container */}
              <div className="flex-1 h-8 bg-gray-100 rounded relative">
                {/* Actual bar */}
                <div
                  className="h-full rounded cursor-pointer transition-all duration-300 hover:brightness-110 hover:shadow"
                  style={{ width: barWidth, backgroundColor: color }}
                ></div>

                {/* Value label */}
                <div className="absolute right-2 top-0 text-xs font-medium h-8 flex items-center">
                  {value.toFixed(1)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend removed as per request */}
    </div>
  );
};
