"use client";
import React, { useState, useMemo, useCallback } from "react";
import {
  Clock,
  Calendar,
  CalendarDays,
  Download,
  BarChart3,
  TrendingUp,
  Activity,
  Lightbulb,
} from "lucide-react";

// Import our components
import { MillComparisonTab } from "./components/MillComparisonTab";
import { TrendsTab } from "./components/TrendsTab";
import { ModernStatisticsTab } from "./components/ModernStatisticsTab";
import { EnhancedAnalyticsTab } from "./components/EnhancedAnalyticsTab";
import {
  ParameterSelector,
  getParameterByValue,
} from "./components/ParameterSelector";
import { QuickActionsPanel } from "./components/QuickActionsPanel";

// Import our custom hook
import {
  useMillsAnalytics,
  getTimeRangeParams,
} from "@/lib/hooks/useAnalytics";

// We're using the interfaces defined in our custom hook

export default function AnalyticsPage() {
  // State for the selected parameter and time range
  const [selectedParameter, setSelectedParameter] = useState<string>("Ore");
  const [timeRange, setTimeRange] = useState<string>("7d");
  const [activeTab, setActiveTab] = useState<string>("comparison");
  // Shared mill selection for the ModernStatisticsTab so it persists across parameter changes
  const [statisticsSelectedMills, setStatisticsSelectedMills] = useState<
    string[]
  >([]);

  // Use useMemo to stabilize the query parameters object
  const queryParams = useMemo(() => {
    const timeRangeParams = getTimeRangeParams(timeRange);

    // Adjust frequency based on time range
    let freq = "1h";
    if (timeRange === "8h") {
      freq = "15m"; // Use 15-minute intervals for 8h range
    } else if (timeRange === "30d") {
      freq = "6h"; // Use 6-hour intervals for 30d range to reduce data points
    } else if (timeRange === "60d") {
      freq = "12h"; // Use 12-hour intervals for 60d range to further reduce points
    }

    return {
      parameter: selectedParameter,
      start_ts: timeRangeParams.start_ts,
      end_ts: timeRangeParams.end_ts,
      freq: freq,
    };
  }, [selectedParameter, timeRange]);

  // Use the custom hook to fetch analytics data
  const { data, rawData, isLoading, error } = useMillsAnalytics(queryParams);

  // Extract the transformed data with fallbacks
  const comparisonData = data?.comparisonData || [];
  const trendData = data?.trendData || [];

  // Handler for parameter change
  const handleParameterChange = (parameter: string) => {
    setSelectedParameter(parameter);
  };

  // Handler for time range change
  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  // Export data to CSV
  const handleExportData = useCallback(() => {
    if (!rawData?.data || rawData.data.length === 0) {
      alert("Няма данни за експортиране");
      return;
    }

    const paramInfo = getParameterByValue(selectedParameter);
    const headers = Object.keys(rawData.data[0]);
    const csvContent = [
      headers.join(","),
      ...rawData.data.map((row: any) =>
        headers.map((h) => row[h] ?? "").join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `analytics_${
        paramInfo?.label || selectedParameter
      }_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [rawData, selectedParameter, timeRange]);

  // Time range options with icons
  const timeRangeOptions = [
    { value: "8h", label: "Смяна", icon: Clock },
    { value: "24h", label: "Ден", icon: Calendar },
    { value: "7d", label: "Седмица", icon: CalendarDays },
    { value: "30d", label: "Месец", icon: CalendarDays },
  ];

  // Tab options with icons
  const tabOptions = [
    { value: "comparison", label: "Сравнение", icon: BarChart3 },
    { value: "trends", label: "Тенденции", icon: TrendingUp },
    { value: "statistics", label: "Статистика", icon: Activity },
    { value: "analytics", label: "Аналитика", icon: Lightbulb },
  ];

  return (
    <div id="analytics-container" className="h-screen flex flex-col p-4">
      {/* Header with title and export button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Аналитики</h1>
        <button
          onClick={handleExportData}
          disabled={isLoading || !rawData?.data?.length}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Експорт CSV</span>
        </button>
      </div>

      {/* Controls Section */}
      <div className="mb-4 p-4 border rounded-lg shadow-sm bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="w-full md:w-1/2">
            <h2 className="text-sm font-medium mb-2 text-gray-600">
              Параметър
            </h2>
            <ParameterSelector
              selectedParameter={selectedParameter}
              onParameterChange={handleParameterChange}
            />
          </div>

          <div className="w-full md:w-1/2">
            <h2 className="text-sm font-medium mb-2 text-gray-600">Период</h2>
            <div className="flex flex-wrap gap-2">
              {timeRangeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleTimeRangeChange(option.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
                      timeRange === option.value
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel - Shows mill alerts */}
      {!isLoading && (rawData?.data?.length ?? 0) > 0 && (
        <QuickActionsPanel millsData={rawData} parameter={selectedParameter} />
      )}

      {/* Tabs Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-lg">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab.value
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
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
                <ModernStatisticsTab
                  parameter={selectedParameter}
                  timeRange={timeRange}
                  millsData={rawData}
                  sharedSelectedMills={statisticsSelectedMills}
                  onSharedSelectedMillsChange={setStatisticsSelectedMills}
                />
              )}

              {activeTab === "analytics" && (
                <EnhancedAnalyticsTab
                  parameter={selectedParameter}
                  timeRange={timeRange}
                  millsData={rawData}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
