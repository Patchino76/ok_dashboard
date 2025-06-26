"use client";
import React, { useState, useMemo } from "react";

// Import our components
import { MillComparisonTab } from "./components/MillComparisonTab";
import { TrendsTab } from "./components/TrendsTab";
import { StatisticsTab } from "./components/StatisticsTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { ParameterSelector } from "./components/ParameterSelector";

// Import our custom hook
import { useMillsAnalytics, getTimeRangeParams } from "@/lib/hooks/useAnalytics";

// We're using the interfaces defined in our custom hook

export default function AnalyticsPage() {
  // State for the selected parameter and time range
  const [selectedParameter, setSelectedParameter] = useState<string>("Ore");
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [activeTab, setActiveTab] = useState<string>("comparison");
  
  // Use useMemo to stabilize the query parameters object
  const queryParams = useMemo(() => {
    const timeRangeParams = getTimeRangeParams(timeRange);
    return {
      parameter: selectedParameter,
      start_ts: timeRangeParams.start_ts,
      end_ts: timeRangeParams.end_ts,
      freq: '1h'
    };
  }, [selectedParameter, timeRange]);
  
  // Use the custom hook to fetch analytics data
  const { 
    data,
    rawData,
    isLoading, 
    error 
  } = useMillsAnalytics(queryParams);

  // Extract the transformed data with fallbacks
  const comparisonData = data?.comparisonData || [];
  const trendData = data?.trendData || [];

  // Debug logging
  console.log('Analytics Page - Raw data from hook:', rawData);
  console.log('Analytics Page - Transformed data from hook:', data);
  console.log('Analytics Page - Comparison data:', comparisonData);
  console.log('Analytics Page - Trend data:', trendData);
  console.log('Analytics Page - Comparison data length:', comparisonData.length);
  console.log('Analytics Page - Trend data length:', trendData.length);

  // Handler for parameter change
  const handleParameterChange = (parameter: string) => {
    setSelectedParameter(parameter);
  };

  // Handler for time range change
  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };
  
  // The useMillsAnalytics hook handles data fetching automatically when dependencies change

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
              <p>{(error as Error).message || "Failed to fetch data"}</p>
            </div>
          ) : (
            <>
              {activeTab === "comparison" && (
                <MillComparisonTab 
                  parameter={selectedParameter} 
                  timeRange={timeRange}
                  millsData={rawData}
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
                  millsData={undefined}
                />
              )}
              
              {activeTab === "analytics" && (
                <AnalyticsTab 
                  parameter={selectedParameter} 
                  timeRange={timeRange}
                  millsData={undefined}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
