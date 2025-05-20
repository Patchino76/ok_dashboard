"use client";
import React from "react";
import { PieChart, Pie, Cell, Label, ResponsiveContainer } from "recharts";

export interface SemiCircleGaugeProps {
  PV: number;       // Process value
  SP: number;       // Set point
  min: number;      // Minimum value of gauge
  max: number;      // Maximum value of gauge
  low?: number;     // Low limit
  high?: number;    // High limit
  unit: string;     // Unit of measure
}

export const SemiCircleOreGauge: React.FC<SemiCircleGaugeProps> = ({
  PV,
  SP,
  min,
  max,
  low = min,
  high = max,
  unit,
}) => {
  // Ensure values are within range
  const safeMin = isNaN(min) ? 0 : min;
  const safeMax = isNaN(max) || max <= safeMin ? safeMin + 100 : max;
  const safePV = Math.max(safeMin, Math.min(safeMax, isNaN(PV) ? 0 : PV));
  
  // Calculate normalized value (0-1)
  const normalizedValue = (safePV - safeMin) / (safeMax - safeMin);

  // Create data for semi-circle (only show upper half)
  const data = [
    { name: "value", value: normalizedValue },
    { name: "empty", value: 1 - normalizedValue }
  ];

  // Define colors
  const COLORS = [
    normalizedValue < 0.3 ? "#ef4444" : 
    normalizedValue < 0.7 ? "#f59e0b" : 
    "#22c55e", 
    "#e5e7eb"
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="85%"
          startAngle={180}
          endAngle={0}
          innerRadius="65%"
          outerRadius="100%"
          paddingAngle={0}
          dataKey="value"
          isAnimationActive={true}
          animationDuration={800}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index]} stroke="none" />
          ))}
          <Label
            value={`${safePV.toFixed(0)} ${unit}`}
            position="center"
            fill="#374151"
            style={{ fontSize: '1.25rem', fontWeight: 'bold' }}
          />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};
