"use client";
import React, { useState, useEffect } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";

interface MillTrendData {
  mill_name: string;
  values: number[];
  timestamps: string[];
}

type Parameter = {
  value: string;
  label: string;
  labelBg: string;
  unit?: string;
  precision?: number;
};

interface TrendsTabProps {
  parameter: string;
  timeRange: string;
  trendData?: Array<{
    mill_name: string;
    values: number[];
    timestamps: string[];
  }>;
}

// Array of colors for mill lines
const millColors = [
  "#4f46e5", // Indigo
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#ef4444", // Red
];

export const TrendsTab: React.FC<TrendsTabProps> = ({ parameter, timeRange, trendData = [] }) => {
  // Ensure parameter is always a string
  const paramString = typeof parameter === 'object' ? 'Ore' : String(parameter);
  
  // Debug logging
  console.log('TrendsTab received trendData:', trendData);
  console.log('TrendsTab trendData length:', trendData.length);
  if (trendData.length > 0) {
    console.log('First trend data sample:', trendData[0]);
  }
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMills, setSelectedMills] = useState<Record<string, boolean>>({});
  const [parameterUnit, setParameterUnit] = useState<string>("");

  // Initialize selected mills based on actual trend data
  useEffect(() => {
    if (trendData && trendData.length > 0) {
      const initialMills: Record<string, boolean> = {};
      trendData.forEach((mill, index) => {
        // Select first 3 mills by default
        initialMills[mill.mill_name] = index < 3;
      });
      setSelectedMills(initialMills);
      console.log('TrendsTab initialized selectedMills:', initialMills);
    }
  }, [trendData]);

  // Get parameter info for display
  useEffect(() => {
    const info = getParameterByValue(paramString);
    if (info && info.unit) {
      setParameterUnit(info.unit);
    }
  }, [paramString]);

  // Toggle mill selection
  const handleMillToggle = (millName: string) => {
    setSelectedMills(prev => ({
      ...prev,
      [millName]: !prev[millName]
    }));
  };

  // Format time range for display
  const formatTimeRange = (): string => {
    switch (timeRange) {
      case "24h": return "24 часа";
      case "7d": return "7 дни";
      case "30d": return "30 дни";
      default: return String(timeRange);
    }
  };

  // Process data for chart
  const processedData = React.useMemo(() => {
    const result: Array<{
      timestamp: string;
      [key: string]: string | number;
    }> = [];
    
    if (trendData && trendData.length > 0) {
      // Get all unique timestamps
      const allTimestamps = new Set<string>();
      trendData.forEach(mill => {
        mill.timestamps.forEach(ts => allTimestamps.add(ts));
      });
      
      // Sort timestamps
      const sortedTimestamps = Array.from(allTimestamps).sort();
      
      // Create data points for each timestamp
      sortedTimestamps.forEach(timestamp => {
        const dataPoint: { 
          timestamp: string; 
          [key: string]: string | number;
        } = { timestamp };
        
        // Add mill values for this timestamp
        trendData.forEach(mill => {
          const millName = mill.mill_name;
          if (selectedMills[millName]) {
            const index = mill.timestamps.findIndex(ts => ts === timestamp);
            if (index !== -1) {
              dataPoint[millName] = mill.values[index];
            }
          }
        });
        
        result.push(dataPoint);
      });
    }
    
    console.log('TrendsTab processedData result:', result);
    console.log('TrendsTab processedData length:', result.length);
    if (result.length > 0) {
      console.log('TrendsTab first processed data point:', result[0]);
      console.log('TrendsTab last processed data point:', result[result.length - 1]);
    }
    
    return result;
  }, [trendData, selectedMills]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const date = new Date(label);
    const formattedTime = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    return (
      <div className="bg-white p-3 border rounded shadow-lg">
        <p className="text-gray-600 mb-2">{formattedTime}</p>
        {payload.map((entry, i) => (
          <div key={`tooltip-${i}`} className="flex justify-between gap-4">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium">
              {Number(entry.value).toFixed(1)} {parameterUnit}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-48 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700">
        <p className="font-medium">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-hidden">
      {/* Header with time range */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-medium">Тренд за {formatTimeRange()}</h3>
          <p className="text-gray-600">
            {paramString} {parameterUnit && `(${parameterUnit})`}
          </p>
        </div>
      </div>
      
      {/* Horizontal mill selection */}
      <div className="mb-6 flex flex-wrap gap-4">
        {trendData.map((mill, index) => {
          const millName = mill.mill_name;
          return (
            <div key={`mill-${index}-${millName}`} className="flex items-center">
              <input
                type="checkbox"
                id={`mill-${millName}`}
                checked={!!selectedMills[millName]}
                onChange={() => handleMillToggle(millName)}
                className="mr-2"
              />
              <label 
                htmlFor={`mill-${millName}`} 
                className="text-sm flex items-center cursor-pointer"
              >
                <span 
                  className="w-3 h-3 inline-block mr-1 rounded-sm" 
                  style={{ backgroundColor: millColors[index % millColors.length] }}
                ></span>
                {millName}
              </label>
            </div>
          );
        })}
      </div>
      
      {/* Chart area */}
      <div className="flex-1 h-[400px]">
        {processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="timestamp"
                type="category"
                tickFormatter={(time: string) => {
                  const date = new Date(time);
                  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                }}
                interval="preserveStartEnd"
                minTickGap={50}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(value: number) => value.toFixed(1)}
                width={35}
              />
              <Tooltip content={CustomTooltip} />
              <Legend height={30} wrapperStyle={{ paddingTop: '10px' }} />

              {/* Render a line for each selected mill */}
              {trendData
                .filter(mill => selectedMills[mill.mill_name])
                .map((mill, index) => (
                  <Line
                    key={`line-${mill.mill_name}`}
                    type="monotone"
                    dataKey={mill.mill_name}
                    stroke={millColors[index % millColors.length]}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name={mill.mill_name}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-500">No trend data available</p>
          </div>
        )}
      </div>
    </div>
  );
};
