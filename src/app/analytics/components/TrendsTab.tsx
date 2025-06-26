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
  const [allSelected, setAllSelected] = useState<boolean>(false);
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
  
  // Toggle all mills at once
  const handleToggleAll = () => {
    const newState = !allSelected;
    setAllSelected(newState);
    
    // Create a new object with all mills set to the new state
    const newSelectedMills: Record<string, boolean> = {};
    trendData.forEach(mill => {
      newSelectedMills[mill.mill_name] = newState;
    });
    
    setSelectedMills(newSelectedMills);
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(timestamp) => {
                    const date = new Date(timestamp);
                    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                  }}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis 
                  domain={[0, 'auto']}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <Tooltip content={<CustomTooltip />} />
                {trendData
                  .filter(mill => selectedMills[mill.mill_name])
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

        {/* Vertical mill selection sidebar - now on the right */}
        <div className="ml-6 w-48 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Mill Selection</div>
            
            {/* Select/Deselect All Switch */}
            <div className="flex items-center">
              <label
                className="text-xs flex items-center cursor-pointer mr-1"
                onClick={handleToggleAll}
              >
                <span className="truncate">{allSelected ? 'Deselect All' : 'Select All'}</span>
              </label>
              <div 
                className={`relative inline-flex items-center h-4 rounded-full w-8 cursor-pointer transition-colors ease-in-out duration-200 border ${
                  allSelected ? 'bg-gray-400' : 'bg-gray-200'
                }`} 
                style={{ 
                  borderColor: allSelected ? '#9CA3AF' : '#E5E7EB'
                }}
                onClick={handleToggleAll}
              >
                <span 
                  className={`inline-block w-3 h-3 transform rounded-full transition ease-in-out duration-200 ${
                    allSelected ? 'translate-x-4' : 'translate-x-1'
                  }`}
                  style={{ 
                    backgroundColor: allSelected ? '#4B5563' : '#CBD5E0',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Individual mill switches with extra spacing after the header */}
          <div className="flex flex-col space-y-4 pt-4 border-t border-gray-200">  
          {trendData.map((mill, index) => {
            const millName = mill.mill_name;
            const isSelected = !!selectedMills[millName];
            const millColor = millColors[index % millColors.length];
            
            // Convert MILL_01 to index for millsNames lookup (MILL_01 -> 0, MILL_02 -> 1, etc.)
            const millIndex = parseInt(millName.replace('MILL_', '')) - 1;
            const displayName = millsNames[millIndex]?.bg || millName;
            
            return (
              <div key={`mill-${index}-${millName}`} className="flex items-center">
                <label 
                  className="text-xs flex items-center cursor-pointer flex-grow mr-1"
                  onClick={() => handleMillToggle(millName)}
                >
                  <span 
                    className="inline-block mr-1 rounded-sm" 
                    style={{ 
                      backgroundColor: millColor,
                      width: '8px',
                      height: '8px' 
                    }}
                  ></span>
                  <span className="truncate">{displayName}</span>
                </label>
                {/* Smaller grey switch */}
                <div 
                  className={`relative inline-flex items-center h-4 rounded-full w-8 cursor-pointer transition-colors ease-in-out duration-200 border ${
                    isSelected ? 'bg-gray-400' : 'bg-gray-200'
                  }`} 
                  style={{ 
                    borderColor: isSelected ? '#9CA3AF' : '#E5E7EB'
                  }}
                  onClick={() => handleMillToggle(millName)}
                >
                  <span 
                    className={`inline-block w-3 h-3 transform rounded-full transition ease-in-out duration-200 ${
                      isSelected ? 'translate-x-4' : 'translate-x-1'
                    }`}
                    style={{ 
                      backgroundColor: isSelected ? '#4B5563' : '#CBD5E0',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                  />
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};
