"use client";
import React, { useMemo, useState } from "react";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";
import { HistogramChart, ControlChart, PercentileChart } from "./charts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface EnhancedStatisticsTabProps {
  parameter: string;
  timeRange: string;
  millsData: any;
}

interface StatisticalMetrics {
  mean: number;
  median: number;
  mode: number | null;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  minMill: string;
  maxMill: string;
  cv: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  dataPoints: number;
}

interface MillStats {
  millName: string;
  displayName: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  stability: number;
  trend: "up" | "down" | "stable";
  trendData: number[];
  dataPoints: number;
}

export const EnhancedStatisticsTab: React.FC<EnhancedStatisticsTabProps> = ({
  parameter,
  timeRange,
  millsData,
}) => {
  const parameterInfo = getParameterByValue(parameter);
  const [selectedMill, setSelectedMill] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "overview" | "distribution" | "control"
  >("overview");

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

  // Calculate comprehensive statistics
  const statistics = useMemo((): StatisticalMetrics | null => {
    if (allValues.length === 0) return null;

    const sortedValues = [...allValues].sort((a, b) => a - b);
    const n = allValues.length;

    const mean = allValues.reduce((sum, val) => sum + val, 0) / n;
    const median = sortedValues[Math.floor(n / 2)];

    // Mode
    const frequency: Record<string, number> = {};
    allValues.forEach((val) => {
      const rounded = val.toFixed(1);
      frequency[rounded] = (frequency[rounded] || 0) + 1;
    });
    const modeEntry = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
    const mode = modeEntry ? parseFloat(modeEntry[0]) : null;

    // Variance and StdDev
    const variance =
      allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Min/Max
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    let minMill = "";
    let maxMill = "";
    Object.entries(millValues).forEach(([mill, values]) => {
      if (values.includes(min)) minMill = mill;
      if (values.includes(max)) maxMill = mill;
    });

    // Quartiles
    const q1 = sortedValues[Math.floor(n * 0.25)];
    const q3 = sortedValues[Math.floor(n * 0.75)];

    // Skewness and Kurtosis
    const skewness =
      allValues.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) /
      n;
    const kurtosis =
      allValues.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0) /
        n -
      3;

    return {
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      mode,
      stdDev: Number(stdDev.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      minMill,
      maxMill,
      cv: mean !== 0 ? Number(((stdDev / mean) * 100).toFixed(2)) : 0,
      range: Number((max - min).toFixed(2)),
      q1: Number(q1.toFixed(2)),
      q3: Number(q3.toFixed(2)),
      iqr: Number((q3 - q1).toFixed(2)),
      skewness: Number(skewness.toFixed(3)),
      kurtosis: Number(kurtosis.toFixed(3)),
      dataPoints: n,
    };
  }, [allValues, millValues]);

  // Calculate per-mill statistics with sparklines
  const millStatistics = useMemo((): MillStats[] => {
    return Object.entries(millValues)
      .map(([millName, values]) => {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          values.length;
        const stdDev = Math.sqrt(variance);
        const stability = mean !== 0 ? (stdDev / mean) * 100 : 0;

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

        const millNumber = parseInt(millName.replace(/\D/g, ""));
        const displayName = millsNames[millNumber - 1]?.bg || millName;

        return {
          millName,
          displayName,
          mean: Number(mean.toFixed(2)),
          stdDev: Number(stdDev.toFixed(2)),
          min: Number(Math.min(...values).toFixed(2)),
          max: Number(Math.max(...values).toFixed(2)),
          stability: Number(stability.toFixed(2)),
          trend,
          trendData: values.slice(-20), // Last 20 points for sparkline
          dataPoints: values.length,
        };
      })
      .sort((a, b) => {
        const numA = parseInt(a.millName.replace(/\D/g, ""));
        const numB = parseInt(b.millName.replace(/\D/g, ""));
        return numA - numB;
      });
  }, [millValues]);

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

  if (!statistics || !millsData) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">
          Няма налични данни за статистически анализ
        </p>
      </div>
    );
  }

  // Sparkline component
  const Sparkline: React.FC<{ data: number[]; color?: string }> = ({
    data,
    color = "#3b82f6",
  }) => {
    const chartData = data.map((value, index) => ({ index, value }));
    return (
      <ResponsiveContainer width={80} height={24}>
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

  return (
    <div className="h-full flex flex-col overflow-auto p-4 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Разширена статистика
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
            • {statistics.dataPoints.toLocaleString()} точки
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex bg-white rounded-lg shadow p-1">
          <button
            onClick={() => setActiveView("overview")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "overview"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Преглед
          </button>
          <button
            onClick={() => setActiveView("distribution")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "distribution"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Разпределение
          </button>
          <button
            onClick={() => setActiveView("control")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "control"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Контрол
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            Средна
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.mean}
          </div>
          <div className="text-xs text-gray-400">{parameterInfo?.unit}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            Медиана
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.median}
          </div>
          <div className="text-xs text-gray-400">{parameterInfo?.unit}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-orange-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            Ст. откл.
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.stdDev}
          </div>
          <div className="text-xs text-gray-400">{parameterInfo?.unit}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            CV
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.cv}%
          </div>
          <div className="text-xs text-gray-400">Вариация</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-red-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            Мин
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.min}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {millsNames[parseInt(statistics.minMill.replace(/\D/g, "")) - 1]
              ?.bg || statistics.minMill}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-emerald-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            Макс
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.max}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {millsNames[parseInt(statistics.maxMill.replace(/\D/g, "")) - 1]
              ?.bg || statistics.maxMill}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-indigo-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            IQR
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.iqr}
          </div>
          <div className="text-xs text-gray-400">Q3-Q1</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-teal-500">
          <div className="text-xs text-gray-500 uppercase font-semibold">
            Диапазон
          </div>
          <div className="text-lg font-bold text-gray-800">
            {statistics.range}
          </div>
          <div className="text-xs text-gray-400">{parameterInfo?.unit}</div>
        </div>
      </div>

      {/* Main Content based on active view */}
      {activeView === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* Histogram */}
          <div className="bg-white rounded-lg shadow p-4 h-72">
            <HistogramChart
              data={allValues}
              title="Разпределение на стойностите"
              unit={parameterInfo?.unit}
              binCount={20}
              highlightOutliers={true}
            />
          </div>

          {/* Percentile Chart */}
          <div className="bg-white rounded-lg shadow p-4 h-72">
            <PercentileChart
              data={allValues}
              title="Перцентилен анализ"
              unit={parameterInfo?.unit}
            />
          </div>

          {/* Mill Performance Table with Sparklines */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Статистика по мелници
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">
                      Мелница
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">
                      Средно
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">
                      Ст.откл.
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">
                      Мин
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">
                      Макс
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">
                      Стабилност
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">
                      Тренд
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">
                      Мини-тренд
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {millStatistics.map((mill, index) => {
                    let stabilityColor = "bg-green-100 text-green-800";
                    if (mill.stability > 10)
                      stabilityColor = "bg-yellow-100 text-yellow-800";
                    if (mill.stability > 20)
                      stabilityColor = "bg-red-100 text-red-800";

                    const trendColor =
                      mill.trend === "up"
                        ? "#22c55e"
                        : mill.trend === "down"
                        ? "#ef4444"
                        : "#6b7280";

                    return (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">
                          {mill.displayName}
                        </td>
                        <td className="text-right py-2 px-3">{mill.mean}</td>
                        <td className="text-right py-2 px-3">{mill.stdDev}</td>
                        <td className="text-right py-2 px-3 text-gray-500">
                          {mill.min}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-500">
                          {mill.max}
                        </td>
                        <td className="text-center py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${stabilityColor}`}
                          >
                            {mill.stability.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">
                          {mill.trend === "up" && (
                            <span className="text-green-600 text-lg">↑</span>
                          )}
                          {mill.trend === "down" && (
                            <span className="text-red-600 text-lg">↓</span>
                          )}
                          {mill.trend === "stable" && (
                            <span className="text-gray-600 text-lg">→</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-3">
                          <Sparkline data={mill.trendData} color={trendColor} />
                        </td>
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => setSelectedMill(mill.millName)}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Детайли
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
      )}

      {activeView === "distribution" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* Large Histogram */}
          <div className="bg-white rounded-lg shadow p-4 h-80">
            <HistogramChart
              data={allValues}
              title="Хистограма с анализ на формата"
              unit={parameterInfo?.unit}
              binCount={25}
              highlightOutliers={true}
            />
          </div>

          {/* Percentile Analysis */}
          <div className="bg-white rounded-lg shadow p-4 h-80">
            <PercentileChart
              data={allValues}
              title="Детайлен перцентилен анализ"
              unit={parameterInfo?.unit}
            />
          </div>

          {/* Distribution Statistics */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Характеристики на разпределението
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">
                  Асиметрия (Skewness)
                </div>
                <div className="text-xl font-bold text-gray-800">
                  {statistics.skewness}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {statistics.skewness > 0.5
                    ? "→ Дясна асиметрия"
                    : statistics.skewness < -0.5
                    ? "← Лява асиметрия"
                    : "↔ Симетрично"}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">
                  Ексцес (Kurtosis)
                </div>
                <div className="text-xl font-bold text-gray-800">
                  {statistics.kurtosis}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {statistics.kurtosis > 1
                    ? "⋀ Лептокуртично"
                    : statistics.kurtosis < -1
                    ? "⋃ Платикуртично"
                    : "~ Мезокуртично"}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Мода</div>
                <div className="text-xl font-bold text-gray-800">
                  {statistics.mode?.toFixed(2) || "N/A"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Най-честа стойност
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Дисперсия</div>
                <div className="text-xl font-bold text-gray-800">
                  {statistics.variance}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  σ² = {statistics.stdDev}²
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === "control" && (
        <div className="flex-1 flex flex-col gap-4">
          {/* Mill Selector */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                Изберете мелница:
              </label>
              <select
                value={selectedMill || ""}
                onChange={(e) => setSelectedMill(e.target.value || null)}
                className="px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Изберете --</option>
                {millStatistics.map((mill) => (
                  <option key={mill.millName} value={mill.millName}>
                    {mill.displayName}
                  </option>
                ))}
              </select>
              {selectedMill && (
                <span className="text-sm text-gray-500">
                  {
                    millStatistics.find((m) => m.millName === selectedMill)
                      ?.dataPoints
                  }{" "}
                  точки
                </span>
              )}
            </div>
          </div>

          {/* Control Chart */}
          {selectedMill && controlChartData.length > 0 ? (
            <div className="bg-white rounded-lg shadow p-4 flex-1 min-h-80">
              <ControlChart
                data={controlChartData}
                title="Контролна карта (X-bar)"
                unit={parameterInfo?.unit}
                showZones={true}
                millName={
                  millStatistics.find((m) => m.millName === selectedMill)
                    ?.displayName
                }
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p>Изберете мелница за да видите контролната карта</p>
              </div>
            </div>
          )}

          {/* Control Chart Legend */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Интерпретация на контролната карта
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mt-0.5" />
                <div>
                  <div className="font-medium text-gray-700">Зона C (±1σ)</div>
                  <div className="text-xs text-gray-500">
                    Нормална вариация, процесът е под контрол
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded mt-0.5" />
                <div>
                  <div className="font-medium text-gray-700">Зона B (±2σ)</div>
                  <div className="text-xs text-gray-500">
                    Предупреждение, следете внимателно
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded mt-0.5" />
                <div>
                  <div className="font-medium text-gray-700">Зона A (±3σ)</div>
                  <div className="text-xs text-gray-500">
                    Извън контрол, необходимо действие
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
