"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";

// Import our components
import { MillComparisonTab } from "./components/MillComparisonTab";
import { TrendsTab } from "./components/TrendsTab";
import { StatisticsTab } from "./components/StatisticsTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { ParameterSelector } from "./components/ParameterSelector";

// Interface for the mill data that will be shared across components
interface MillData {
  mill_name: string;
  values: number[];
  timestamps: string[];
  [key: string]: any;
}

// Interface for trend data
interface TrendData {
  mill_name: string;
  values: number[];
  timestamps: string[];
}

export default function AnalyticsPage() {
  // State for the selected parameter and time range
  const [selectedParameter, setSelectedParameter] = useState<string>("Ore");
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [activeTab, setActiveTab] = useState<string>("comparison");
  
  // State for the fetched data
  const [millsData, setMillsData] = useState<any>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  // Helper function to get time range based on selection
  const getTimeRange = () => {
    const now = new Date();
    const startDate = new Date(now);
    
    switch (timeRange) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      default: // 24h
        startDate.setDate(now.getDate() - 1);
    }
    
    return {
      start_ts: startDate.toISOString(),
      end_ts: now.toISOString()
    };
  };
  
  // Handler for parameter change
  const handleParameterChange = (parameter: string) => {
    setSelectedParameter(parameter);
  };

  // Handler for time range change
  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };
  
  // Centralized function to fetch mills data
  useEffect(() => {
    const fetchMillsData = async () => {
      setIsLoading(true);
      setError(null);
      
      const { start_ts, end_ts } = getTimeRange();
      
      try {
        // Fetch data for mill comparison
        const response = await axios.get(`${API_BASE_URL}/api/mills/all_mills_by_param`, {
          params: {
            parameter: selectedParameter,
            start_ts,
            end_ts,
            freq: '1h'
          }
        });
        
        if (response.data && response.data.data) {
          setMillsData(response.data);
        } else {
          setError("No data available from API");
        }
        
        // Fetch trend data (using the same parameters)
        // Calculate start and end timestamps based on time range
        const end = new Date();
        const start = new Date();
        
        if (timeRange === "24h") {
          start.setHours(start.getHours() - 24);
        } else if (timeRange === "7d") {
          start.setDate(start.getDate() - 7);
        } else if (timeRange === "30d") {
          start.setDate(start.getDate() - 30);
        }
        
        const trendResponse = await axios.get(`${API_BASE_URL}/api/mills/all_mills_by_param`, {
          params: {
            parameter: selectedParameter,
            start_ts: start.toISOString(),
            end_ts: end.toISOString(),
            freq: '1h'
          }
        });
        
        if (trendResponse.data && trendResponse.data.mills_data) {
          setTrendData(trendResponse.data.mills_data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch data");
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMillsData();
  }, [selectedParameter, timeRange, API_BASE_URL]);  // Re-fetch when these dependencies change

  return (
    <div id="analytics-container" className="h-screen flex flex-col p-4">
      <h1 className="text-xl font-bold mb-4">Аналитики</h1>
      
      {/* Controls Section */}
      <div className="mb-4 p-4 border rounded-lg shadow-sm bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="w-full md:w-1/2">
            <h2 className="text-sm font-medium mb-2">Параметри за анализ</h2>
            <ParameterSelector 
              selectedParameter={selectedParameter}
              onParameterChange={handleParameterChange}
            />
          </div>
          
          <div className="w-full md:w-1/2">
            <h2 className="text-sm font-medium mb-2">Времеви диапазон</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => handleTimeRangeChange("24h")}
                className={`px-3 py-1 text-sm rounded ${timeRange === "24h" ? 
                  "bg-blue-600 text-white" : 
                  "bg-gray-200 text-gray-800"}`}
              >
                24 Часа
              </button>
              <button 
                onClick={() => handleTimeRangeChange("7d")}
                className={`px-3 py-1 text-sm rounded ${timeRange === "7d" ? 
                  "bg-blue-600 text-white" : 
                  "bg-gray-200 text-gray-800"}`}
              >
                7 Дни
              </button>
              <button 
                onClick={() => handleTimeRangeChange("30d")}
                className={`px-3 py-1 text-sm rounded ${timeRange === "30d" ? 
                  "bg-blue-600 text-white" : 
                  "bg-gray-200 text-gray-800"}`}
              >
                30 Дни
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-4 mb-3 border-b bg-white">
          <button
            onClick={() => setActiveTab("comparison")}
            className={`py-2 text-sm font-medium text-center ${activeTab === "comparison" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Сравнение
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            className={`py-2 text-sm font-medium text-center ${activeTab === "trends" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Тенденции
          </button>
          <button
            onClick={() => setActiveTab("statistics")}
            className={`py-2 text-sm font-medium text-center ${activeTab === "statistics" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Статистика
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`py-2 text-sm font-medium text-center ${activeTab === "analytics" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Аналитика
          </button>
        </div>
        
        <div className="flex-1 border rounded-lg shadow-sm bg-white min-h-0">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-pulse flex flex-col items-center space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-48 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {activeTab === "comparison" && (
                <MillComparisonTab 
                  parameter={selectedParameter} 
                  timeRange={timeRange}
                  millsData={millsData}
                />
              )}
              
              {activeTab === "trends" && (
                <TrendsTab 
                  parameter={selectedParameter}
                  timeRange={timeRange}
                  trendData={trendData}
                />
              )}
              
              {activeTab === "statistics" && (
                <StatisticsTab 
                  parameter={selectedParameter} 
                  timeRange={timeRange}
                  millsData={millsData}
                />
              )}
              
              {activeTab === "analytics" && (
                <AnalyticsTab 
                  parameter={selectedParameter} 
                  timeRange={timeRange}
                  millsData={millsData}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
