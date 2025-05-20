"use client";
import React from "react";
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

interface TrendChartOreProps {
  data: {
    values: number[];
    timestamps: string[];
    target?: number;
  };
  min?: number;
  max?: number;
}

export const TrendChartOre: React.FC<TrendChartOreProps> = ({ 
  data, 
  min = 0, 
  max = 100 
}) => {
  // Combine timestamps and values into a format Recharts can use
  const chartData = data.timestamps.map((timestamp, index) => ({
    timestamp,
    value: data.values[index],
  }));

  // Format the timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Format the tooltip
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(payload[0].payload.timestamp);
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="text-sm font-medium">
            {`${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
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
          tickFormatter={formatTimestamp}
          interval="preserveStartEnd"
          minTickGap={50}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 10 }}
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
