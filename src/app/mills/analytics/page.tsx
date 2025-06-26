"use client";
import React, { useState, useEffect } from "react";

// Import our components
import { MillComparisonTab } from "./components/MillComparisonTab";
import { TrendsTab } from "./components/TrendsTab";
import { StatisticsTab } from "./components/StatisticsTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { ParameterSelector } from "./components/ParameterSelector";

export default function MillsAnalyticsPage() {
  // Add a style tag to set the page height at the document root level
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      html, body {
        height: 100%;
      }
      #mills-analytics-container {
        min-height: calc(100vh - 100px);
        display: flex;
        flex-direction: column;
      }
      .tab-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
    `;
    
    // Append the style element to the head
    document.head.appendChild(styleElement);
    
    // Clean up
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  // State for the selected parameter and time range
  const [selectedParameter, setSelectedParameter] = useState<string>("Ore");
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [activeTab, setActiveTab] = useState<string>("comparison");
  
  // Handler for parameter change
  const handleParameterChange = (parameter: string) => {
    setSelectedParameter(parameter);
  };

  // Handler for time range change
  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  return (
    <div id="mills-analytics-container" className="flex flex-col space-y-4">
      <h1 className="text-2xl font-bold mb-6">Мелнична Аналитика</h1>
      
      {/* Controls Section */}
      <div className="mb-6 p-6 border rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="w-full md:w-1/2">
            <h2 className="text-lg font-medium mb-2">Параметри за анализ</h2>
            <ParameterSelector 
              selectedParameter={selectedParameter}
              onParameterChange={handleParameterChange}
            />
          </div>
          
          <div className="w-full md:w-1/2">
            <h2 className="text-lg font-medium mb-2">Времеви диапазон</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => handleTimeRangeChange("24h")}
                className={`px-4 py-2 rounded ${timeRange === "24h" ? 
                  "bg-blue-600 text-white" : 
                  "bg-gray-200 text-gray-800"}`}
              >
                24 Часа
              </button>
              <button 
                onClick={() => handleTimeRangeChange("7d")}
                className={`px-4 py-2 rounded ${timeRange === "7d" ? 
                  "bg-blue-600 text-white" : 
                  "bg-gray-200 text-gray-800"}`}
              >
                7 Дни
              </button>
              <button 
                onClick={() => handleTimeRangeChange("30d")}
                className={`px-4 py-2 rounded ${timeRange === "30d" ? 
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
      <div className="w-full">
        <div className="grid grid-cols-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab("comparison")}
            className={`py-2 font-medium text-center ${activeTab === "comparison" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Сравнение
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            className={`py-2 font-medium text-center ${activeTab === "trends" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Тенденции
          </button>
          <button
            onClick={() => setActiveTab("statistics")}
            className={`py-2 font-medium text-center ${activeTab === "statistics" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Статистика
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`py-2 font-medium text-center ${activeTab === "analytics" ? "border-b-2 border-blue-500 text-blue-700" : "text-gray-600"}`}
          >
            Аналитика
          </button>
        </div>
        
        <div className="p-6 border rounded-lg shadow-sm">
          {activeTab === "comparison" && (
            <MillComparisonTab 
              parameter={selectedParameter} 
              timeRange={timeRange} 
            />
          )}
          
          {activeTab === "trends" && (
            <TrendsTab 
              parameter={selectedParameter} 
              timeRange={timeRange} 
            />
          )}
          
          {activeTab === "statistics" && (
            <StatisticsTab 
              parameter={selectedParameter} 
              timeRange={timeRange} 
            />
          )}
          
          {activeTab === "analytics" && (
            <AnalyticsTab 
              parameter={selectedParameter} 
              timeRange={timeRange} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
