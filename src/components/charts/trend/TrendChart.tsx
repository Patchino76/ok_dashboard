'use client'

import React, { useMemo } from 'react'
import {
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from "recharts"
import { calculateRegression, generateRegressionLine } from "./trendCalculation"
import { smoothData, formatTrendData, calculateAxisBounds, formatYAxisTick } from "./trendVisualization"
import { TagTrendPoint } from "@/lib/tags/types"

export type TrendChartProps = {
  data: TagTrendPoint[] | { values: number[], timestamps: string[] }  // Support both formats
  color?: string
  height?: number | string
  target?: number  // Optional target line value
  targetColor?: string // Optional target line color
  smoothing?: boolean // Enable/disable smoothing
  showRegression?: boolean // Show/hide regression line
  min?: number // Optional min value for Y axis
  max?: number // Optional max value for Y axis
  unit?: string // Optional unit for display in tooltip
  precision?: number  // Decimal precision
}

export function TrendChart({ 
  data, 
  color = "#0ea5e9", 
  height = 300, 
  target, 
  targetColor = "#fbbf24", 
  smoothing = true,
  showRegression = true,
  min,
  max,
  unit = "",
  precision
}: TrendChartProps) {
  
  // Convert data to standard format if needed
  const standardizedData = useMemo(() => {
    // Check if data is in TagTrendPoint[] format
    if (Array.isArray(data) && data.length > 0 && 'timestamp' in data[0]) {
      return data as TagTrendPoint[];
    }
    
    // Convert from {values, timestamps} format to TagTrendPoint[]
    const nonArrayData = data as { values: number[], timestamps: string[] };
    if (nonArrayData.values && nonArrayData.timestamps) {
      return nonArrayData.values.map((value, index) => ({
        timestamp: nonArrayData.timestamps[index],
        value: value
      }));
    }
    
    return [];
  }, [data]);
  
  // Filter and process data points
  const validPoints = useMemo(() => {
    return standardizedData.filter(point => 
      point.value !== null && !isNaN(point.value as number)
    );
  }, [standardizedData]);
  
  // Calculate regression based on valid data points
  const regression = useMemo(() => {
    return validPoints.length >= 2 && showRegression ? 
      calculateRegression(validPoints) : null;
  }, [validPoints, showRegression]);
  
  // Generate regression line data
  const regressionLineData = useMemo(() => {
    if (!regression || validPoints.length < 2 || !showRegression) return [];
    return generateRegressionLine(regression, validPoints);
  }, [regression, validPoints, showRegression]);
  
  // Calculate Y-axis bounds if not manually specified
  const { minValue, maxValue, isVerySmallValue } = useMemo(() => {
    if (min !== undefined && max !== undefined) {
      return { 
        minValue: min, 
        maxValue: max, 
        isVerySmallValue: Math.max(min, max) < 0.1 
      };
    }
    return calculateAxisBounds(validPoints, regressionLineData);
  }, [validPoints, regressionLineData, min, max]);
  
  // Format data for the chart with optional smoothing
  const trendData = useMemo(() => 
    formatTrendData(validPoints, smoothing), 
  [validPoints, smoothing]);
  
  // Format regression line data (never apply smoothing to regression line)
  const formattedRegressionData = useMemo(() => 
    formatTrendData(regressionLineData, false), 
  [regressionLineData]);
  
  // Custom tooltip for better UX
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dateLabel = payload[0]?.payload?.fullDateTime || label;
      
      return (
        <div className="bg-card p-2 border rounded shadow-sm">
          <p className="text-sm font-medium">{dateLabel}</p>
          <div className="mt-1">
            {payload.map((item: any, index: number) => {
              if (item.dataKey === 'value') {
                // Format the value according to precision
                const formattedValue = isVerySmallValue || precision !== undefined
                  ? Number(item.value).toFixed(precision !== undefined ? precision : 4)
                  : Math.round(item.value * 100) / 100;
                
                return (
                  <p key={index} className="text-sm flex items-center">
                    <span className="w-3 h-3 inline-block mr-2" 
                      style={{ backgroundColor: item.stroke || color }}></span>
                    <span>{formattedValue}{unit ? ` ${unit}` : ''}</span>
                  </p>
                );
              }
              return null;
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate tick formatter based on data characteristics
  const yAxisTickFormatter = (value: number) => 
    formatYAxisTick(value, precision, isVerySmallValue);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={trendData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        
        <XAxis
          dataKey="fullDateTime"
          tickFormatter={(time) => time?.split(' ')[1] || time} // Show only time part
          interval="preserveStartEnd"
          minTickGap={50}
          tick={{ fontSize: 10 }}
        />
        
        <YAxis
          domain={[minValue, maxValue] as [number, number]}
          tick={{ fontSize: 10 }}
          tickFormatter={yAxisTickFormatter}
          width={35}
        />
        
        <Tooltip content={customTooltip} />
        
        {/* Target reference line */}
        {target !== undefined && (
          <ReferenceLine 
            y={target} 
            stroke={targetColor} 
            strokeDasharray="3 3"
            label={{ 
              value: `Target: ${target}${unit}`, 
              fill: targetColor, 
              fontSize: 10,
              position: 'insideBottomRight' 
            }}
          />
        )}
        
        {/* Main data line */}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
          name="Value"
        />
        
        {/* Regression line - only shown if showRegression is true */}
        {showRegression && formattedRegressionData.length > 0 && (
          <Line
            type="monotone"
            data={formattedRegressionData}
            dataKey="value"
            stroke="#ef4444"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            name="Trend"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
