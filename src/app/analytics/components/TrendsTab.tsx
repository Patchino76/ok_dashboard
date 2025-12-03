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
  TooltipProps,
} from "recharts";
import { getParameterByValue } from "./ParameterSelector";
import { useMillSelectionStore } from "@/lib/store/millSelectionStore";
import { CompactMillsSelector } from "./CompactMillsSelector";

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
  trendData: MillTrendData[];
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

export const TrendsTab: React.FC<TrendsTabProps> = ({
  parameter,
  timeRange,
  trendData,
}) => {
  // Access mill selection state from Zustand store
  const { selectedMills, initializeMills } = useMillSelectionStore();
  // Ensure parameter is always a string
  const paramString = typeof parameter === "object" ? "Ore" : String(parameter);

  // Debug logging
  console.log("TrendsTab received trendData:", trendData);
  console.log("TrendsTab trendData length:", trendData.length);
  if (trendData.length > 0) {
    console.log("First trend data sample:", trendData[0]);
  }

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parameterUnit, setParameterUnit] = useState<string>("");

  // Get parameter info for display
  useEffect(() => {
    const info = getParameterByValue(paramString);
    if (info && info.unit) {
      setParameterUnit(info.unit);
    }
  }, [paramString]);

  // Initialize mill selections when trend data is available
  useEffect(() => {
    if (trendData && trendData.length > 0) {
      const millNames = trendData.map((mill) => mill.mill_name);

      // Check if we need to initialize (only if the mills in store don't match current data)
      const shouldInitialize = millNames.some(
        (name) => selectedMills[name] === undefined
      );

      if (shouldInitialize) {
        initializeMills(millNames);
      }
    }
  }, [trendData, selectedMills, initializeMills]);

  // Mill names for the selector
  const millNames = React.useMemo(
    () => trendData.map((mill) => mill.mill_name),
    [trendData]
  );

  // Format time range for display
  const formatTimeRange = (): string => {
    switch (timeRange) {
      case "24h":
        return "24 часа";
      case "7d":
        return "7 дни";
      case "30d":
        return "30 дни";
      default:
        return String(timeRange);
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
      trendData.forEach((mill) => {
        mill.timestamps.forEach((ts) => allTimestamps.add(ts));
      });

      // Sort timestamps
      const sortedTimestamps = Array.from(allTimestamps).sort();

      // Create data points for each timestamp
      sortedTimestamps.forEach((timestamp) => {
        const dataPoint: {
          timestamp: string;
          [key: string]: string | number;
        } = { timestamp };

        // Add mill values for this timestamp
        trendData.forEach((mill) => {
          const millName = mill.mill_name;
          if (selectedMills[millName]) {
            const index = mill.timestamps.findIndex((ts) => ts === timestamp);
            if (index !== -1) {
              dataPoint[millName] = mill.values[index];
            }
          }
        });

        result.push(dataPoint);
      });
    }

    console.log("TrendsTab processedData result:", result);
    console.log("TrendsTab processedData length:", result.length);
    if (result.length > 0) {
      console.log("TrendsTab first processed data point:", result[0]);
      console.log(
        "TrendsTab last processed data point:",
        result[result.length - 1]
      );
    }

    return result;
  }, [trendData, selectedMills]);

  // Format timestamp for X-axis based on time range
  const formatXAxisTick = (timestamp: string): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");

    // For longer time ranges, show date + time
    if (timeRange === "7d" || timeRange === "30d") {
      return `${day}.${month} ${hours}:${minutes}`;
    }
    // For shorter ranges, show date.month + time
    return `${day}.${month} ${hours}:${minutes}`;
  };

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;

    const date = new Date(label);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const formattedDateTime = `${day}.${month}.${year} ${hours}:${minutes}`;

    return (
      <div className="bg-white p-3 border rounded shadow-lg">
        <p className="text-gray-600 mb-2 font-medium">{formattedDateTime}</p>
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
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header with time range */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-medium">Тренд за {formatTimeRange()}</h3>
          <p className="text-gray-600">
            {paramString} {parameterUnit && `(${parameterUnit})`}
          </p>
        </div>
      </div>

      {/* Main content area with chart and sidebar */}
      <div className="flex flex-grow h-full">
        {/* Chart area - taking most of the space */}
        <div className="flex-grow relative h-full">
          {processedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={processedData}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.3}
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatXAxisTick}
                  stroke="#94a3b8"
                  fontSize={11}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, "auto"]}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <Tooltip content={<CustomTooltip />} />
                {trendData
                  .filter((mill) => selectedMills[mill.mill_name])
                  .map((mill, index) => (
                    <Line
                      key={mill.mill_name}
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

        {/* Compact mill selection sidebar */}
        <div className="ml-4">
          <CompactMillsSelector mills={millNames} />
        </div>
      </div>
    </div>
  );
};
