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
import { calculateRegression } from "@/app/dashboard/utils/trendCalculation";
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
    
    // Create data points with timestamp and value (ensure integer values)
    return data.values.map((value, index) => ({
      timestamp: data.timestamps[index],
      value: Math.round(value) // Ensure integer values
    }));
  }, [data]);
  
  // Apply smoothing to the chart data
  const chartData = useMemo(() => {
    if (rawData.length < 3) return rawData;
    
    // Apply smoothing with a window size of 15 for smoother lines
    return smoothData(rawData, 15);
  }, [rawData]);
  
  // Calculate regression based on raw data for accuracy
  const regressionResult = useMemo(() => {
    // Convert raw data to TagTrendPoint format for the regression function
    const trendPoints = rawData.map(point => ({ 
      timestamp: point.timestamp, 
      value: point.value 
    })) as TagTrendPoint[];
    
    // Use the dashboard's calculation function which processes time properly
    return calculateRegression(trendPoints);
  }, [rawData]);
  
  // Generate regression line data points
  const regressionLine = useMemo(() => {
    if (!regressionResult || chartData.length === 0) return [];
    
    // Calculate the start and end timestamps
    const startTime = new Date(chartData[0].timestamp).getTime();
    const timeSpan = new Date(chartData[chartData.length-1].timestamp).getTime() - startTime;
    
    // Create points for the regression line
    return chartData.map((point, index) => {
      // Calculate the exact time position for accurate regression
      const pointTime = new Date(point.timestamp).getTime();
      const timePosition = (pointTime - startTime) / timeSpan;
      
      // Calculate regression value using the slope-intercept formula: y = mx + b
      // This is the correct way to calculate points on a regression line
      const regressionValue = Math.round(
        regressionResult.slope * pointTime + regressionResult.intercept
      );
      
      return {
        timestamp: point.timestamp,
        regressionValue: regressionValue
      };
    });
  }, [chartData, regressionResult]);
  
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
          <p className="text-sm">{`${Math.round(payload[0].value)} t/h`}</p>
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
          tickFormatter={(value) => typeof value === 'number' ? Math.round(value).toString() : value.toString()}
          width={30}
        />
        <Tooltip content={customTooltip} />
        {/* Remove the target reference line as it conflicts with regression line */}
        {/* Main data line */}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
        />
        
        {/* Regression trend line */}
        <Line
          type="monotone"
          data={regressionLine}
          dataKey="regressionValue"
          stroke="#ef4444"
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          name=""
          legendType="none"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
