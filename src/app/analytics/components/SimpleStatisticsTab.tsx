"use client";
import React, { useMemo, useState } from "react";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";
import {
  ControlChart,
  ProcessAlertCards,
  ProcessHealthScore,
  MillComparisonBoxPlot,
} from "./charts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { ChevronRight, BarChart3, Activity, Settings } from "lucide-react";

interface SimpleStatisticsTabProps {
  parameter: string;
  timeRange: string;
  millsData: any;
}

interface MillStats {
  millName: string;
  displayName: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  cv: number;
  trend: "up" | "down" | "stable";
  trendData: number[];
  dataPoints: number;
  status: "good" | "warning" | "critical";
}

export const SimpleStatisticsTab: React.FC<SimpleStatisticsTabProps> = ({
  parameter,
  timeRange,
  millsData,
}) => {
  const parameterInfo = getParameterByValue(parameter);
  const [selectedMill, setSelectedMill] = useState<string | null>(null);

  // Extract all values and per-mill data
  const { allValues, millValues, timeSeriesData } = useMemo(() => {
    if (!millsData?.data || millsData.data.length === 0) {
      return { allValues: [], millValues: {}, timeSeriesData: [] };
    }

    const allValues: number[] = [];
    const millValues: Record<string, number[]> = {};
    const timeSeriesData: { timestamp: string; [key: string]: any }[] = [];

    millsData.data.forEach((record: any) => {
      const point: { timestamp: string; [key: string]: any } = {
        timestamp: record.timestamp,
      };

      Object.keys(record).forEach((key) => {
        if (key !== "timestamp" && key !== "parameter" && key !== "freq") {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            allValues.push(value);
            if (!millValues[key]) millValues[key] = [];
            millValues[key].push(value);
            point[key] = value;
          }
        }
      });

      timeSeriesData.push(point);
    });

    return { allValues, millValues, timeSeriesData };
  }, [millsData]);

  // Calculate global statistics
  const globalStats = useMemo(() => {
    if (allValues.length === 0) return null;

    const mean = allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
    const variance =
      allValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      allValues.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;

    return { mean, stdDev, cv, n: allValues.length };
  }, [allValues]);

  // Calculate per-mill statistics
  const millStatistics = useMemo((): MillStats[] => {
    if (!globalStats) return [];

    return Object.entries(millValues)
      .map(([millName, values]) => {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          values.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;

        // Trend calculation
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstMean =
          firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondMean =
          secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        const change = ((secondMean - firstMean) / firstMean) * 100;

        let trend: "up" | "down" | "stable" = "stable";
        if (change > 2) trend = "up";
        else if (change < -2) trend = "down";

        // Status based on deviation from global mean
        const deviation =
          Math.abs(mean - globalStats.mean) / globalStats.stdDev;
        let status: "good" | "warning" | "critical" = "good";
        if (deviation > 2 || cv > 20) status = "critical";
        else if (deviation > 1 || cv > 15) status = "warning";

        const millNumber = parseInt(millName.replace(/\D/g, ""));
        const displayName = millsNames[millNumber - 1]?.bg || millName;

        return {
          millName,
          displayName,
          mean: Number(mean.toFixed(2)),
          stdDev: Number(stdDev.toFixed(2)),
          min: Number(Math.min(...values).toFixed(2)),
          max: Number(Math.max(...values).toFixed(2)),
          cv: Number(cv.toFixed(2)),
          trend,
          trendData: values.slice(-30), // Last 30 points for sparkline
          dataPoints: values.length,
          status,
        };
      })
      .sort((a, b) => {
        const numA = parseInt(a.millName.replace(/\D/g, ""));
        const numB = parseInt(b.millName.replace(/\D/g, ""));
        return numA - numB;
      });
  }, [millValues, globalStats]);

  // Prepare control chart data for selected mill
  const controlChartData = useMemo(() => {
    if (!selectedMill || !timeSeriesData.length) return [];

    return timeSeriesData
      .filter((d) => d[selectedMill] !== undefined)
      .map((d) => ({
        timestamp: d.timestamp,
        value: d[selectedMill] as number,
      }));
  }, [selectedMill, timeSeriesData]);

  // Prepare mill names mapping for box plot
  const millNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.keys(millValues).forEach((millName) => {
      const millNumber = parseInt(millName.replace(/\D/g, ""));
      map[millNumber] = millsNames[millNumber - 1]?.bg || millName;
    });
    return map;
  }, [millValues]);

  // Sparkline component
  const Sparkline: React.FC<{
    data: number[];
    color?: string;
    height?: number;
  }> = ({ data, color = "#3b82f6", height = 32 }) => {
    const chartData = data.map((value, index) => ({ index, value }));
    return (
      <ResponsiveContainer width={100} height={height}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (!globalStats || !millsData) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">
          Няма налични данни за статистически анализ
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto p-4 bg-gray-50 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Статистика на процеса
          </h2>
          <p className="text-sm text-gray-600">
            {parameterInfo?.label || parameter} •{" "}
            {timeRange === "8h"
              ? "8 Часа"
              : timeRange === "24h"
              ? "24 Часа"
              : timeRange === "7d"
              ? "7 Дни"
              : timeRange === "30d"
              ? "30 Дни"
              : "60 Дни"}{" "}
            • {globalStats.n.toLocaleString()} измервания
          </p>
        </div>
      </div>

      {/* Process Health Score */}
      <ProcessHealthScore
        millsData={millStatistics}
        globalMean={globalStats.mean}
        globalStdDev={globalStats.stdDev}
        globalCV={globalStats.cv}
        parameterName={parameterInfo?.label}
        unit={parameterInfo?.unit}
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column - Alerts and Box Plot */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mill Comparison Box Plot */}
          <div className="bg-white rounded-lg shadow p-4 h-80">
            <MillComparisonBoxPlot
              millsData={millValues}
              millNames={millNamesMap}
              title="Сравнение на мелници (IQR)"
              unit={parameterInfo?.unit}
              globalMean={globalStats.mean}
              globalStdDev={globalStats.stdDev}
            />
          </div>

          {/* Control Chart for selected mill */}
          {selectedMill && controlChartData.length > 0 ? (
            <div className="bg-white rounded-lg shadow p-4 h-72">
              <ControlChart
                data={controlChartData}
                title="Контролна карта"
                unit={parameterInfo?.unit}
                showZones={true}
                millName={
                  millStatistics.find((m) => m.millName === selectedMill)
                    ?.displayName
                }
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-4 h-72 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Изберете мелница от таблицата за контролна карта</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column - Alerts */}
        <div className="bg-white rounded-lg shadow p-4">
          <ProcessAlertCards
            millsData={millStatistics}
            globalMean={globalStats.mean}
            globalStdDev={globalStats.stdDev}
            unit={parameterInfo?.unit}
            onMillClick={(millName) => {
              const mill = millStatistics.find(
                (m) => m.displayName === millName
              );
              if (mill) setSelectedMill(mill.millName);
            }}
          />
        </div>
      </div>

      {/* Mill Performance Table */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Детайли по мелници
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Мелница
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">
                  Статус
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">
                  Средно
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">
                  CV%
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">
                  Диапазон
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">
                  Тренд
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">
                  Последни 30 точки
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">
                  Действие
                </th>
              </tr>
            </thead>
            <tbody>
              {millStatistics.map((mill, index) => {
                const statusStyles = {
                  good: {
                    bg: "bg-green-100",
                    text: "text-green-700",
                    label: "OK",
                  },
                  warning: {
                    bg: "bg-yellow-100",
                    text: "text-yellow-700",
                    label: "Внимание",
                  },
                  critical: {
                    bg: "bg-red-100",
                    text: "text-red-700",
                    label: "Критично",
                  },
                };

                const style = statusStyles[mill.status];
                const trendColor =
                  mill.trend === "up"
                    ? "#22c55e"
                    : mill.trend === "down"
                    ? "#ef4444"
                    : "#6b7280";

                const isSelected = selectedMill === mill.millName;

                return (
                  <tr
                    key={index}
                    className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedMill(mill.millName)}
                  >
                    <td className="py-3 px-4 font-medium">
                      {mill.displayName}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span
                        className={`${style.bg} ${style.text} px-2 py-1 rounded-full text-xs font-medium`}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-mono">
                      {mill.mean} {parameterInfo?.unit}
                    </td>
                    <td className="text-right py-3 px-4">
                      <span
                        className={`font-medium ${
                          mill.cv > 15
                            ? "text-red-600"
                            : mill.cv > 10
                            ? "text-yellow-600"
                            : "text-green-600"
                        }`}
                      >
                        {mill.cv}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-500">
                      {mill.min} - {mill.max}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span
                        className={`text-lg ${
                          mill.trend === "up"
                            ? "text-green-600"
                            : mill.trend === "down"
                            ? "text-red-600"
                            : "text-gray-400"
                        }`}
                      >
                        {mill.trend === "up"
                          ? "↑"
                          : mill.trend === "down"
                          ? "↓"
                          : "→"}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Sparkline data={mill.trendData} color={trendColor} />
                    </td>
                    <td className="text-center py-3 px-4">
                      <button
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "text-blue-600 hover:bg-blue-50"
                        }`}
                      >
                        <Settings className="w-3 h-3" />
                        {isSelected ? "Избрана" : "Анализ"}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
