"use client";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";
import { SimpleBarChart } from "./SimpleBarChart";

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
}

export const MillComparisonTab: React.FC<MillComparisonTabProps> = ({
  parameter,
  timeRange,
}) => {
  const [millsData, setMillsData] = useState<MillData[]>([]);
  const [rawAPIData, setRawAPIData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<boolean>(true); // Enable debug mode
  const [stats, setStats] = useState<StatsData>({
    avg: 0,
    min: 0,
    max: 0,
    minMill: "",
    maxMill: ""
  });
  
  // Use a ref to get the container height
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert timeRange to actual timestamps
  const getTimeRange = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch(timeRange) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "24h":
      default:
        startDate.setDate(now.getDate() - 1);
    }
    
    return {
      start_ts: startDate.toISOString(),
      end_ts: now.toISOString()
    };
  };

  // API base URL - use environment variable or fallback to localhost:8000
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      const { start_ts, end_ts } = getTimeRange();
      
      try {
        // Get the raw API response
        const response = await axios.get(`${API_BASE_URL}/api/mills/all_mills_by_param`, {
          params: {
            parameter,
            start_ts,
            end_ts,
            freq: '1h'
          }
        });
        
        console.log('API Response:', response.data);
        
        // COMPLETELY NEW APPROACH: Direct brute-force property extraction
        // This approach will try to directly find any properties that look like mill data
        // regardless of the specific structure
        
        if (!response.data || !response.data.data || response.data.data.length === 0) {
          setError("No data available from API");
          setLoading(false);
          return;
        }
        
        // Get all records
        const allRecords = response.data.data;
        
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
        let totalSum = 0;
        let totalCount = 0;
        let minValue = Infinity;
        let maxValue = -Infinity;
        let minMill = "";
        let maxMill = "";
        
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
                
                // Update stats
                totalSum += value;
                totalCount++;
                
                if (value < minValue) {
                  minValue = value;
                  minMill = millDisplayName;
                }
                
                if (value > maxValue) {
                  maxValue = value;
                  maxMill = millDisplayName;
                }
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
              
              // Update stats
              totalSum += value;
              totalCount++;
              
              if (value < minValue) {
                minValue = value;
                minMill = millName;
              }
              
              if (value > maxValue) {
                maxValue = value;
                maxMill = millName;
              }
            }
          });
          
          // SPECIAL APPROACH 3: If the latestRecord has a mills array
          if (latestRecord.mills && Array.isArray(latestRecord.mills)) {
            console.log('Found mills array in record:', latestRecord.mills);
            
            latestRecord.mills.forEach((mill: any, index: number) => {
              if (mill && typeof mill === 'object') {
                // Try to find id and value properties
                const millId = mill.id || mill.mill_id || `mill_${index + 1}`;
                const value = parseFloat(mill.value || mill.parameterValue || mill.parameter_value);
                
                if (!isNaN(value)) {
                  const millName = millId.replace('MILL_', '').replace('mill_', '');
                  
                  extractedData.push({
                    mill_name: millName,
                    parameter_value: Number(value.toFixed(2))
                  });
                  
                  // Update stats
                  totalSum += value;
                  totalCount++;
                  
                  if (value < minValue) {
                    minValue = value;
                    minMill = millName;
                  }
                  
                  if (value > maxValue) {
                    maxValue = value;
                    maxMill = millName;
                  }
                }
              } else if (typeof mill === 'number') {
                // If the mills array contains direct values
                const millName = `${index + 1}`;
                const value = mill;
                
                extractedData.push({
                  mill_name: millName,
                  parameter_value: Number(value.toFixed(2))
                });
                
                // Update stats
                totalSum += value;
                totalCount++;
                
                if (value < minValue) {
                  minValue = value;
                  minMill = millName;
                }
                
                if (value > maxValue) {
                  maxValue = value;
                  maxMill = millName;
                }
              }
            });
          }
        }
        
        // Check if we found any mills data
        if (extractedData.length === 0) {
          console.log('No mill data found using any approach');
          
          // FALLBACK: Simply look for properties that might be numeric values as a last resort
          if (latestRecord) {
            Object.entries(latestRecord).forEach(([key, value]: [string, any]) => {
              // Skip obvious non-mill properties
              if (key === 'timestamp' || key === 'parameter' || key === 'freq' || key === 'start_ts' || key === 'end_ts') return;
              
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                extractedData.push({
                  mill_name: key,
                  parameter_value: Number(numValue.toFixed(2))
                });
                
                // Update stats
                totalSum += numValue;
                totalCount++;
                
                if (numValue < minValue) {
                  minValue = numValue;
                  minMill = key;
                }
                
                if (numValue > maxValue) {
                  maxValue = numValue;
                  maxMill = key;
                }
              }
            });
          }
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
        
        // Set the processed data for display
        setMillsData(extractedData);
        setStats({
          avg: totalCount > 0 ? Number((totalSum / totalCount).toFixed(2)) : 0,
          min: minValue !== Infinity ? Number(minValue.toFixed(2)) : 0,
          max: maxValue !== -Infinity ? Number(maxValue.toFixed(2)) : 0,
          minMill,
          maxMill
        });
        
      } catch (err) {
        console.error('Error fetching mills data:', err);
        setError("Failed to fetch data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [parameter, timeRange, API_BASE_URL]);

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
    <div className="flex flex-col bg-white border rounded-lg shadow overflow-hidden" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Compact header bar with parameter name and stats */}
      <div className="py-1 px-3 bg-gray-50 border-b flex flex-row justify-between items-center text-xs" style={{ height: '28px' }}>
        <div className="font-medium">
          {parameterInfo?.labelBg || parameter} {parameterInfo?.unit && `(${parameterInfo.unit})`}
        </div>
        
        <div className="flex gap-2 text-xs">
          <div className="flex gap-1">
            <span className="font-medium">Ср:</span>
            <span>{stats.avg}{parameterInfo?.unit}</span>
          </div>
          <div className="flex gap-1">
            <span className="font-medium">Макс:</span>
            <span>{stats.max}{parameterInfo?.unit}({stats.maxMill})</span>
          </div>
          <div className="flex gap-1">
            <span className="font-medium">Мин:</span>
            <span>{stats.min}{parameterInfo?.unit}({stats.minMill})</span>
          </div>
        </div>
      </div>
      
      {/* Full-height chart container */}
      <div className="flex-1 w-full" style={{ height: 'calc(100% - 28px)' }}>
        {millsData && millsData.length > 0 ? (
          <SimpleBarChart data={millsData} parameter={parameter} />
        ) : (
          <div className="w-full h-full flex items-center justify-center border rounded-md">
            <p className="text-gray-500">No mill data available from API</p>
          </div>
        )}
      </div>
    </div>
  );
};
