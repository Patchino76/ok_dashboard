"use client";
import React from "react";
import { getParameterByValue } from "./ParameterSelector";

interface BarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

const Bar: React.FC<BarProps> = ({ label, value, maxValue, color }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  
  return (
    <div className="flex flex-col items-center" style={{ width: '70px' }}>
      {/* Value label above bar */}
      <div className="text-xs font-medium">{value.toFixed(1)}</div>
      
      {/* Vertical bar */}
      <div className="relative w-14 bg-gray-200 rounded-t-md" style={{ height: '280px' }}>
        <div 
          className="absolute bottom-0 w-14 rounded-t-md cursor-pointer transition-all duration-300 hover:brightness-110 hover:shadow-lg" 
          style={{ 
            height: `${percentage}%`,
            backgroundColor: color
          }}
        ></div>
      </div>
      
      {/* Mill name below bar */}
      <div className="text-xs text-center mt-1 font-medium">{label}</div>
    </div>
  );
};

interface SimpleBarChartProps {
  data: Array<{ mill_name: string; parameter_value: number }>;
  parameter: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, parameter }) => {
  const parameterInfo = getParameterByValue(parameter);
  
  // Find the maximum value for scaling
  const maxValue = Math.max(...data.map(item => item.parameter_value));
  
  // Determine color based on value
  const getBarColor = (value: number) => {
    const percentage = value / maxValue;
    
    if (percentage >= 0.85) return "#22c55e"; // Green - Optimal (≥85%)
    if (percentage >= 0.75) return "#facc15"; // Yellow - Good (75-84%)
    return "#ef4444"; // Red - Attention (<75%)
  };

  return (
    <div className="w-full h-full flex flex-col items-center">
      {/* Removed redundant title to save space */}
      
      {/* Vertical bars container - taking full space */}
      <div className="flex flex-row justify-center items-end gap-3 overflow-x-auto py-1 w-full" style={{ height: 'calc(100% - 26px)' }}>
        {data.map((item) => (
          <Bar
            key={item.mill_name}
            label={`${item.mill_name}`}
            value={item.parameter_value}
            maxValue={maxValue}
            color={getBarColor(item.parameter_value)}
          />
        ))}
      </div>
      
      {/* Compact legend at the bottom */}
      <div className="flex items-center justify-center gap-2 flex-wrap text-xs py-1">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-[#22c55e] mr-1"></div>
          <span>Оптимално (≥85%)</span>
        </div>
        <div className="flex items-center mx-2">
          <div className="w-2 h-2 bg-[#facc15] mr-1"></div>
          <span>Добро (75-84%)</span>
        </div>
        <div className="flex items-center">
          <div className="w-2 h-2 bg-[#ef4444] mr-1"></div>
          <span>Внимание (&lt;75%)</span>
        </div>
      </div>
    </div>
  );
};
