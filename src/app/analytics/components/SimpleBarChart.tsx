"use client";
import React from "react";
import { getParameterByValue } from "./ParameterSelector";

interface SimpleBarChartProps {
  data: Array<{ [key: string]: any }>;
  nameKey?: string;
  valueKey?: string;
  valueLabel?: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ 
  data, 
  nameKey = 'mill_name', 
  valueKey = 'parameter_value',
  valueLabel = ''
}) => {
  // Find the maximum value for scaling
  const maxValue = Math.max(...data.map(item => Number(item[valueKey]) || 0));
  
  // Color thresholds
  const getBarColor = (percentage: number) => {
    if (percentage >= 0.85) return "#22c55e"; // Green - Optimal (≥85%)
    if (percentage >= 0.75) return "#facc15"; // Yellow - Good (75-84%)
    return "#ef4444";                         // Red - Attention (<75%)
  };

  return (
    <div className="w-full h-full flex flex-col px-4">      
      {/* Horizontal bars container */}
      <div className="flex-1 flex flex-col justify-between gap-3 overflow-y-auto">
        {data.map((item) => {
          const value = Number(item[valueKey]) || 0;
          const percentage = maxValue > 0 ? (value / maxValue) : 0;
          const barWidth = `${Math.max(percentage * 100, 2)}%`;
          const color = getBarColor(percentage);
          const name = String(item[nameKey] || '');
          
          return (
            <div key={name} className="flex items-center w-full gap-1">
              {/* Name */}
              <div className="w-16 text-xs font-medium text-right truncate pr-2">{name}</div>
              
              {/* Bar container */}
              <div className="flex-1 h-8 bg-gray-100 rounded relative">
                {/* Actual bar */}
                <div 
                  className="h-full rounded cursor-pointer transition-all duration-300 hover:brightness-110 hover:shadow" 
                  style={{ width: barWidth, backgroundColor: color }}
                ></div>
                
                {/* Value label */}
                <div className="absolute right-2 top-0 text-xs font-medium h-8 flex items-center">
                  {value.toFixed(1)}{valueLabel ? ` ${valueLabel}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Compact legend */}
      <div className="mt-2 flex justify-between border-t pt-2 text-xs">
        <div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>&lt; 75%</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-400"></div>
            <span>75% - 84%</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>&gt; 85%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
