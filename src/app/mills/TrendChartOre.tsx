"use client";
import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { smoothData, calculateAxisBounds } from "@/lib/utils/trends/trendVisualization";
import { calculateRegression } from "@/lib/utils/trends/trendCalculation";
import type { TagTrendPoint } from "@/lib/tags/types";

interface TrendChartOreProps {
  data: {
    values: number[];
    timestamps: string[];
    target?: number;
  };
  min?: number;
  max?: number;
}

export const TrendChartOre: React.FC<TrendChartOreProps> = ({ data, min, max }) => {
  // Convert incoming data to a format suitable for the chart
  const rawData = useMemo(() => {
    if (!data.values || !data.timestamps || data.values.length === 0) {
      return [];
    }
    
    // Create data points with timestamp and value
    return data.values.map((value, index) => ({
      timestamp: data.timestamps[index],
      value: value
    }));
  }, [data]);
  
  // Apply smoothing to the chart data
  const chartData = useMemo(() => {
    if (rawData.length < 3) return rawData;
    
    // Apply smoothing with a window size of 15 for smoother lines
    return smoothData(rawData, 15);
  }, [rawData]);
  
  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (min !== undefined && max !== undefined) {
      return [min, max];
    }
    
    if (chartData.length === 0) return [0, 100];
    
    // Get min and max values
    const values = chartData.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    // Round to nearest 20
    const minBound = Math.floor(minValue / 20) * 20;
    const maxBound = Math.ceil(maxValue / 20) * 20;
    
    return [minBound, maxBound];
  }, [chartData, min, max]);
  
  // Format tooltip
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="text-sm font-medium">
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm">{`${payload[0].value.toFixed(0)} t/h`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(timestamp) => {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }}
          interval="preserveStartEnd"
          minTickGap={50}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          domain={yDomain as [number, number]}
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => typeof value === 'number' ? value.toFixed(0) : value.toString()}
          width={30}
        />
        <Tooltip content={customTooltip} />
        {data.target && <ReferenceLine y={data.target} stroke="#EF4444" strokeDasharray="5 5" />}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0284c7"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
