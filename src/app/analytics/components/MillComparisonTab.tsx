"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";
import { useMillSelectionStore } from "@/lib/store/millSelectionStore";
import { useMillRangesStore } from "@/lib/store/millRangesStore";
import { SimpleBarChart } from "./SimpleBarChart";

// Mill colors for visual consistency with TrendsTab
const millColors = [
  "#3b82f6", // blue
  "#f97316", // orange
  "#10b981", // green
  "#ef4444", // red
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#14b8a6", // teal
  "#ec4899", // pink
  "#6366f1", // indigo
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#d946ef", // fuchsia
];

// Type definition for the mill data
interface MillData {
  mill_name: string;
  parameter_value: number;
}

interface StatsData {
  avg: number;
  min: number;
  max: number;
  minMill: string;
  maxMill: string;
}

interface MillComparisonTabProps {
  parameter: string;
  timeRange: string;
  millsData?: any; // API response data
}

export const MillComparisonTab: React.FC<MillComparisonTabProps> = ({
  parameter,
  timeRange,
  millsData
}) => {
  // Access mill selection state from Zustand store
  const { 
    selectedMills, 
    allSelected, 
    toggleMill,
    toggleAllMills,
    initializeMills 
  } = useMillSelectionStore();
  
  // Access mill ranges state from Zustand store
  const {
    lowThreshold,
    highThreshold,
    lowColor,
    yellowColor,
    highColor,
    setLowThreshold,
    setHighThreshold,
    calculateThresholds
  } = useMillRangesStore();
  
  // We'll calculate the thresholds based on chart data when it's available
  // This is just a placeholder for initial render
  const [currentThresholds, setCurrentThresholds] = useState<{ low: number, high: number }>(
    { low: 0, high: 0 }
  );
  // Debug logging
  console.log('MillComparisonTab received millsData:', millsData);
  console.log('MillComparisonTab millsData structure:', millsData ? Object.keys(millsData) : 'No data');
  if (millsData?.data) {
    console.log('MillComparisonTab data array length:', millsData.data.length);
    console.log('MillComparisonTab first data sample:', millsData.data[0]);
  }
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [filteredChartData, setFilteredChartData] = useState<MillData[]>([]);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Using shared mill selection state from parent instead of local state
  
  // Use store actions for toggles
  const handleMillToggle = (millName: string) => toggleMill(millName);
  const handleToggleAll = () => toggleAllMills();
  
  // Initialize mill selections when chart data is available
  useEffect(() => {
    if (chartData && chartData.length > 0) {
      const millNames = chartData.map(mill => mill.mill_name);
      
      // Check if we need to initialize (only if the mills in store don't match current data)
      const shouldInitialize = millNames.some(name => selectedMills[name] === undefined);
      
      if (shouldInitialize) {
        initializeMills(millNames);
      }
    }
  }, [chartData, selectedMills, initializeMills]);

  // Calculate thresholds whenever chart data changes
  useEffect(() => {
    if (filteredChartData && filteredChartData.length > 0) {
      // Extract parameter values for calculating thresholds
      const values = filteredChartData.map(item => Number(item.parameter_value) || 0);
      
      // Calculate thresholds using the store's helper function
      const thresholds = calculateThresholds(values);
      setCurrentThresholds(thresholds);
      
      // Debug logging
      console.log('Current thresholds:', thresholds);
      console.log('Current percentage thresholds:', { lowThreshold, highThreshold });
    }
  }, [filteredChartData, calculateThresholds, lowThreshold, highThreshold]);

  // Function to extract mill data from API response
  const extractMillDataFromResponse = (responseData: any): MillData[] => {
    if (!responseData || !responseData.data || responseData.data.length === 0) {
      return [];
    }
    
    // Get all records
    const allRecords = responseData.data;
    
    // Find the latest record by timestamp if available
    let latestRecord: any = null;
    
    if (allRecords[0].timestamp) {
      // Sort by timestamp (descending)
      allRecords.sort((a: any, b: any) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      latestRecord = allRecords[0];
      console.log('Using latest record by timestamp:', latestRecord);
    } else {
      // Just use the first record if no timestamp
      latestRecord = allRecords[0];
      console.log('No timestamps found, using first record:', latestRecord);
    }
    
    // Try to directly extract mill data using different approaches
    const extractedData: MillData[] = [];
    
    // Log all available keys for debugging
    console.log('Available keys in record:', latestRecord ? Object.keys(latestRecord) : 'No record available');
    
    // APPROACH 1: Handle case where we have multiple records, each for one mill
    if (Array.isArray(allRecords) && allRecords.length > 1 && allRecords[0].mill_id) {
      // Look for records with the same timestamp as latest
      const latestTimestamp = latestRecord.timestamp;
      const latestRecords = allRecords.filter((record: any) => record.timestamp === latestTimestamp);
      
      console.log('Using multiple records approach with', latestRecords.length, 'records');
      
      latestRecords.forEach((record: any) => {
        if (record.mill_id && record.value !== undefined) {
          const millDisplayName = record.mill_id.replace('MILL_', '');
          const value = parseFloat(record.value);
          
          if (!isNaN(value)) {
            extractedData.push({
              mill_name: millDisplayName,
              parameter_value: Number(value.toFixed(2))
            });
          }
        }
      });
    }
    // APPROACH 2: Handle case where we have a single record with all mill data
    else if (latestRecord) {
      // Look for properties that might be mills (either by name or pattern)
      Object.keys(latestRecord).forEach(key => {
        // Skip timestamp and other non-mill keys
        if (key === 'timestamp' || key === 'parameter' || key === 'freq') return;
        
        // Try to extract mill name and value
        const value = parseFloat(latestRecord[key]);
        if (!isNaN(value)) {
          // Try to clean up the key to get mill name/number
          let millName = key;
          if (millName.includes('MILL_')) {
            millName = millName.replace('MILL_', '');
          } else if (millName.match(/mill\d+/i)) {
            // Extract just the number if it's like 'mill1', 'Mill2', etc.
            millName = millName.replace(/mill/i, '');
          }
          
          console.log(`Found potential mill data: ${key} -> ${millName} = ${value}`);
          
          extractedData.push({
            mill_name: millName,
            parameter_value: Number(value.toFixed(2))
          });
        }
      });
    }
    
    // Final sort by mill name/number for consistent display
    extractedData.sort((a, b) => {
      // Try to sort numerically if mill_name contains numbers
      const numA = parseInt(a.mill_name);
      const numB = parseInt(b.mill_name);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      
      // Otherwise sort alphabetically
      return a.mill_name.localeCompare(b.mill_name);
    });
    
    console.log('Final extracted mill data:', extractedData);
    return extractedData;
  };

  // Function to calculate statistics from mill data
  const calculateStats = (data: MillData[]): StatsData => {
    if (data.length === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        minMill: "",
        maxMill: ""
      };
    }

    let totalSum = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;
    let minMill = "";
    let maxMill = "";

    data.forEach(item => {
      const value = item.parameter_value;
      totalSum += value;
      
      if (value < minValue) {
        minValue = value;
        minMill = item.mill_name;
      }
      
      if (value > maxValue) {
        maxValue = value;
        maxMill = item.mill_name;
      }
    });

    return {
      avg: Number((totalSum / data.length).toFixed(2)),
      min: minValue !== Infinity ? Number(minValue.toFixed(2)) : 0,
      max: maxValue !== -Infinity ? Number(maxValue.toFixed(2)) : 0,
      minMill,
      maxMill
    };
  };

  // Use a ref to get the container height
  const containerRef = useRef<HTMLDivElement>(null);

  // Process mill data when it changes
  useEffect(() => {
    if (!millsData) {
      setLoading(false);
      return;
    }

    try {
      // Process the data passed from the parent
      setLoading(true);

      if (!millsData || !millsData.data || millsData.data.length === 0) {
        setError("No data available for this parameter and time range");
        setLoading(false);
        return;
      }

      // Extract the mill data
      const extractedData = extractMillDataFromResponse(millsData);
      setChartData(extractedData);
      
          // Calculate stats based on extracted data
      if (extractedData.length > 0) {
        const stats = calculateStats(extractedData);
        setStatsData(stats);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process data");
      console.error("Error processing data:", err);
    } finally {
      setLoading(false);
    }
  }, [millsData, parameter]);
  
  // Update filtered chart data when selection changes
  useEffect(() => {
    if (chartData.length > 0 && Object.keys(selectedMills).length > 0) {
      const filtered = chartData.filter(mill => selectedMills[mill.mill_name]);
      setFilteredChartData(filtered);
      
      // Recalculate stats based on filtered data
      if (filtered.length > 0) {
        const stats = calculateStats(filtered);
        setStatsData(stats);
      } else {
        setStatsData(null);
      }
    }
  }, [chartData, selectedMills]);

  // Get parameter details for display
  const parameterInfo = getParameterByValue(parameter);

  if (loading) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-48 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700">
        <p className="font-medium">Error</p>
        <p>{error}</p>
      </div>
    );
  }


  
  return (
    <div className="h-full flex flex-col bg-white rounded-lg overflow-hidden">
      {/* Compact header bar with parameter name and stats */}
      <div className="flex justify-between p-4 border-b">
        <div className="flex items-center">
          <span className="text-lg font-semibold">{parameterInfo?.label || parameter}</span>
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
            {parameterInfo?.unit || ""}  
          </span>
          <span className="ml-4 text-gray-500">{timeRange === "24h" ? "24 Часа" : timeRange === "7d" ? "7 Дни" : "30 Дни"}</span>
        </div>
        <div>
          <span className="font-medium">Средно: </span>
          <span className="px-2 py-1 bg-gray-100 rounded">{statsData?.avg || 0}</span>
        </div>
      </div>
      
      {/* Range Settings Controls */}
      <div className="p-4 border-b">
        <div className="flex items-center mb-2">
          <h3 className="text-sm font-medium">Bar Color Thresholds</h3>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lowColor }}></div>
              <span className="ml-1 text-xs text-gray-500">Low</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: yellowColor }}></div>
              <span className="ml-1 text-xs text-gray-500">Medium</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: highColor }}></div>
              <span className="ml-1 text-xs text-gray-500">High</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Low Threshold */}
          <div className="flex items-center">
            <label className="text-xs text-gray-500 w-20">Low Threshold:</label>
            <input 
              type="number" 
              value={currentThresholds.low.toFixed(2)} 
              onChange={(e) => {
                // Convert back to percentage to store in the ranges store
                const mean = statsData?.avg || 0;
                if (mean > 0) {
                  const newValue = Number(e.target.value);
                  const percentage = ((newValue / mean) - 1) * 100;
                  setLowThreshold(percentage);
                }
              }} 
              className="w-20 px-2 py-1 text-sm border rounded" 
              step="1"
            />
            <span className="ml-1 text-xs text-gray-500">{parameterInfo?.unit}</span>
          </div>
          
          {/* High Threshold */}
          <div className="flex items-center">
            <label className="text-xs text-gray-500 w-20">High Threshold:</label>
            <input 
              type="number" 
              value={currentThresholds.high.toFixed(2)} 
              onChange={(e) => {
                // Convert back to percentage to store in the ranges store
                const mean = statsData?.avg || 0;
                if (mean > 0) {
                  const newValue = Number(e.target.value);
                  const percentage = ((newValue / mean) - 1) * 100;
                  setHighThreshold(percentage);
                }
              }} 
              className="w-20 px-2 py-1 text-sm border rounded" 
              step="1"
            />
            <span className="ml-1 text-xs text-gray-500">{parameterInfo?.unit}</span>
          </div>
        </div>
      </div>
      
      {/* Main content area with chart and sidebar */}
      <div className="flex flex-1 p-4 overflow-hidden">
        {/* Chart area */}
        <div className="flex-1 overflow-auto" ref={containerRef}>
          {filteredChartData && filteredChartData.length > 0 ? (
            <SimpleBarChart 
              data={filteredChartData} 
              nameKey="mill_name" 
              valueKey="parameter_value" 
              valueLabel={parameterInfo?.unit}
              thresholds={currentThresholds}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center border rounded-md">
              <p className="text-gray-500">No mill data available</p>
            </div>
          )}
        </div>
        
        {/* Vertical mill selection sidebar */}
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
          
          {/* Individual mill switches */}
          <div className="flex flex-col space-y-4 pt-4 border-t border-gray-200">  
            {chartData.map((mill, index) => {
              const millName = mill.mill_name;
              const isSelected = !!selectedMills[millName];
              const millColor = millColors[index % millColors.length];
              
              // Get Bulgarian mill name
              const millNumber = parseInt(millName.replace(/\D/g, ''));
              const displayName = millsNames[millNumber-1]?.bg || millName;
              
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
