"use client";
import React, { useMemo, useState } from "react";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";
import {
  CorrelationHeatmap,
  AutocorrelationChart,
  AnomalyTimeline,
} from "./charts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
} from "recharts";

interface EnhancedAnalyticsTabProps {
  parameter: string;
  timeRange: string;
  millsData: any;
}

interface MillPerformance {
  millName: string;
  displayName: string;
  score: number;
  mean: number;
  stability: number;
  trend: "improving" | "declining" | "stable";
  trendChange: number;
  rank: number;
  issues: string[];
  recommendations: string[];
  anomalyCount: number;
}

interface Anomaly {
  millName: string;
  displayName: string;
  timestamp: string;
  value: number;
  severity: "low" | "medium" | "high";
  deviation: number;
}

export const EnhancedAnalyticsTab: React.FC<EnhancedAnalyticsTabProps> = ({
  parameter,
  timeRange,
  millsData,
}) => {
  const parameterInfo = getParameterByValue(parameter);
  const [activeView, setActiveView] = useState<
    "overview" | "correlation" | "anomaly" | "seasonality"
  >("overview");
  const [selectedMill, setSelectedMill] = useState<string | null>(null);

  // Extract mill values for analysis
  const { millValues, timeSeriesData, rawData } = useMemo(() => {
    if (!millsData?.data || millsData.data.length === 0) {
      return { millValues: {}, timeSeriesData: [], rawData: [] };
    }

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
            if (!millValues[key]) millValues[key] = [];
            millValues[key].push(value);
            point[key] = value;
          }
        }
      });

      timeSeriesData.push(point);
    });

    return { millValues, timeSeriesData, rawData: millsData.data };
  }, [millsData]);

  // Calculate mill performances
  const millPerformances = useMemo((): MillPerformance[] => {
    if (Object.keys(millValues).length === 0) return [];

    const performances = Object.entries(millValues).map(
      ([millName, values]) => {
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
        const trendChange = ((secondMean - firstMean) / firstMean) * 100;

        let trend: "improving" | "declining" | "stable" = "stable";
        if (trendChange > 2) trend = "improving";
        else if (trendChange < -2) trend = "declining";

        // Score calculation
        let score = Math.max(0, 100 - stability * 2);
        if (trend === "improving") score += 10;
        if (trend === "declining") score -= 10;
        score = Math.min(100, Math.max(0, score));

        // Anomaly count
        const anomalyCount = values.filter(
          (v) => Math.abs(v - mean) > 2 * stdDev
        ).length;

        // Issues and recommendations
        const issues: string[] = [];
        const recommendations: string[] = [];

        if (stability > 20) {
          issues.push("Висока нестабилност");
          recommendations.push("Проверете настройките за стабилизиране");
        }
        if (trend === "declining") {
          issues.push("Влошаваща се тенденция");
          recommendations.push("Анализирайте причините за спада");
        }
        if (anomalyCount > values.length * 0.05) {
          issues.push("Много аномалии");
          recommendations.push("Проверете за външни смущения");
        }
        if (issues.length === 0) {
          recommendations.push("Поддържайте текущите параметри");
        }

        const millNumber = parseInt(millName.replace(/\D/g, ""));
        const displayName = millsNames[millNumber - 1]?.bg || millName;

        return {
          millName,
          displayName,
          score: Number(score.toFixed(1)),
          mean: Number(mean.toFixed(2)),
          stability: Number(stability.toFixed(2)),
          trend,
          trendChange: Number(trendChange.toFixed(2)),
          rank: 0,
          issues,
          recommendations,
          anomalyCount,
        };
      }
    );

    // Sort and assign ranks
    performances.sort((a, b) => b.score - a.score);
    performances.forEach((perf, index) => {
      perf.rank = index + 1;
    });

    return performances;
  }, [millValues]);

  // Detect all anomalies
  const anomalies = useMemo((): Anomaly[] => {
    if (!rawData || rawData.length === 0) return [];

    const detectedAnomalies: Anomaly[] = [];
    const millStats: Record<string, { mean: number; stdDev: number }> = {};

    // Calculate stats for each mill
    Object.entries(millValues).forEach(([mill, values]) => {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
      millStats[mill] = { mean, stdDev: Math.sqrt(variance) };
    });

    // Detect anomalies
    rawData.forEach((record: any) => {
      Object.keys(record).forEach((key) => {
        if (
          key !== "timestamp" &&
          key !== "parameter" &&
          key !== "freq" &&
          millStats[key]
        ) {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            const { mean, stdDev } = millStats[key];
            const deviation = stdDev > 0 ? Math.abs(value - mean) / stdDev : 0;

            if (deviation > 2) {
              const millNumber = parseInt(key.replace(/\D/g, ""));
              const displayName = millsNames[millNumber - 1]?.bg || key;

              let severity: "low" | "medium" | "high" = "low";
              if (deviation > 3) severity = "high";
              else if (deviation > 2.5) severity = "medium";

              detectedAnomalies.push({
                millName: key,
                displayName,
                timestamp: record.timestamp,
                value: Number(value.toFixed(2)),
                severity,
                deviation: Number(deviation.toFixed(2)),
              });
            }
          }
        }
      });
    });

    return detectedAnomalies.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [rawData, millValues]);

  // Moving average data for trend analysis
  const movingAverageData = useMemo(() => {
    if (!selectedMill || !timeSeriesData.length) return [];

    const values = timeSeriesData
      .filter((d) => d[selectedMill] !== undefined)
      .map((d) => ({
        timestamp: d.timestamp,
        value: d[selectedMill] as number,
        formattedTime: new Date(d.timestamp).toLocaleTimeString("bg-BG", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));

    // Calculate moving averages
    const windowSize = Math.min(5, Math.floor(values.length / 4));

    return values.map((point, index) => {
      // Simple moving average
      const start = Math.max(0, index - windowSize + 1);
      const window = values.slice(start, index + 1);
      const sma = window.reduce((sum, p) => sum + p.value, 0) / window.length;

      // Rate of change
      const prevValue = index > 0 ? values[index - 1].value : point.value;
      const rateOfChange =
        prevValue !== 0 ? ((point.value - prevValue) / prevValue) * 100 : 0;

      return {
        ...point,
        sma: Number(sma.toFixed(2)),
        rateOfChange: Number(rateOfChange.toFixed(2)),
      };
    });
  }, [selectedMill, timeSeriesData]);

  if (!millsData?.data || millsData.data.length === 0) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">
          Няма налични данни за аналитичен преглед
        </p>
      </div>
    );
  }

  const bestPerformer = millPerformances[0];
  const worstPerformer = millPerformances[millPerformances.length - 1];
  const avgScore =
    millPerformances.reduce((sum, p) => sum + p.score, 0) /
    millPerformances.length;

  // Anomaly summary
  const highSeverityCount = anomalies.filter(
    (a) => a.severity === "high"
  ).length;
  const mediumSeverityCount = anomalies.filter(
    (a) => a.severity === "medium"
  ).length;
  const lowSeverityCount = anomalies.filter((a) => a.severity === "low").length;

  return (
    <div className="h-full flex flex-col overflow-auto p-4 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Разширена аналитика
          </h2>
          <p className="text-sm text-gray-600">
            {parameterInfo?.label || parameter} •{" "}
            {timeRange === "8h"
              ? "8 Часа"
              : timeRange === "24h"
              ? "24 Часа"
              : timeRange === "7d"
              ? "7 Дни"
              : "30 Дни"}
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
            onClick={() => setActiveView("correlation")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "correlation"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Корелации
          </button>
          <button
            onClick={() => setActiveView("anomaly")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "anomaly"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Аномалии
          </button>
          <button
            onClick={() => setActiveView("seasonality")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "seasonality"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Сезонност
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Най-добра
              </div>
              <div className="text-lg font-bold text-green-700">
                {bestPerformer?.displayName}
              </div>
              <div className="text-sm text-green-600">
                {bestPerformer?.score}/100
              </div>
            </div>
            <span className="text-2xl">🏆</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Средна оценка
              </div>
              <div className="text-lg font-bold text-blue-700">
                {avgScore.toFixed(1)}
              </div>
              <div className="text-sm text-blue-600">
                {millPerformances.length} мелници
              </div>
            </div>
            <span className="text-2xl">📊</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Изисква внимание
              </div>
              <div className="text-lg font-bold text-orange-700">
                {worstPerformer?.displayName}
              </div>
              <div className="text-sm text-orange-600">
                {worstPerformer?.score}/100
              </div>
            </div>
            <span className="text-2xl">⚠️</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Аномалии
              </div>
              <div className="text-lg font-bold text-purple-700">
                {anomalies.length}
              </div>
              <div className="text-xs text-purple-600">
                🔴 {highSeverityCount} • 🟠 {mediumSeverityCount} • 🟡{" "}
                {lowSeverityCount}
              </div>
            </div>
            <span className="text-2xl">🔍</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {activeView === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* Performance Ranking */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Класиране по ефективност
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {millPerformances.map((perf, index) => {
                let scoreColor = "bg-green-500";
                if (perf.score < 70) scoreColor = "bg-yellow-500";
                if (perf.score < 50) scoreColor = "bg-red-500";

                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                      {perf.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm truncate">
                        {perf.displayName}
                      </div>
                      <div className="text-xs text-gray-500">
                        μ={perf.mean} • CV={perf.stability}%
                      </div>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded-full text-white font-bold text-xs ${scoreColor}`}
                    >
                      {perf.score}
                    </div>
                    <div className="text-lg">
                      {perf.trend === "improving" && "📈"}
                      {perf.trend === "stable" && "➡️"}
                      {perf.trend === "declining" && "📉"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Anomalies */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Последни аномалии
            </h3>
            {anomalies.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {anomalies.slice(0, 10).map((anomaly, index) => {
                  let severityColor =
                    "bg-yellow-100 text-yellow-800 border-yellow-300";
                  let severityIcon = "🟡";
                  if (anomaly.severity === "high") {
                    severityColor = "bg-red-100 text-red-800 border-red-300";
                    severityIcon = "🔴";
                  } else if (anomaly.severity === "medium") {
                    severityColor =
                      "bg-orange-100 text-orange-800 border-orange-300";
                    severityIcon = "🟠";
                  }

                  return (
                    <div
                      key={index}
                      className={`p-2 rounded-lg border ${severityColor}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{severityIcon}</span>
                          <span className="font-medium text-sm">
                            {anomaly.displayName}
                          </span>
                        </div>
                        <span className="text-xs">
                          {new Date(anomaly.timestamp).toLocaleTimeString(
                            "bg-BG",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </span>
                      </div>
                      <div className="text-xs mt-1">
                        {anomaly.value} {parameterInfo?.unit} •{" "}
                        {anomaly.deviation}σ отклонение
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✅</div>
                <div>Няма открити аномалии</div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Препоръки за оптимизация
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {millPerformances
                .filter((p) => p.issues.length > 0)
                .slice(0, 6)
                .map((perf, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">💡</span>
                      <span className="font-semibold text-gray-800 text-sm">
                        {perf.displayName}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {perf.recommendations.map((rec, recIndex) => (
                        <li
                          key={recIndex}
                          className="text-xs text-gray-700 flex items-start gap-1"
                        >
                          <span className="text-blue-500">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                    {perf.issues.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        {perf.issues.map((issue, issueIndex) => (
                          <div
                            key={issueIndex}
                            className="text-xs text-red-600 flex items-center gap-1"
                          >
                            <span>⚠️</span>
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeView === "correlation" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* Correlation Heatmap */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2 h-96">
            <CorrelationHeatmap
              millsData={millValues}
              title="Корелационна матрица между мелници"
            />
          </div>

          {/* Correlation Insights */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Интерпретация на корелациите
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="font-medium text-green-700 mb-1">
                  Силна положителна (r {">"} 0.7)
                </div>
                <p className="text-xs text-gray-600">
                  Мелниците се движат заедно. Промяна в една вероятно ще се
                  отрази на другата.
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="font-medium text-red-700 mb-1">
                  Силна отрицателна (r {"<"} -0.7)
                </div>
                <p className="text-xs text-gray-600">
                  Обратна зависимост. Когато една се увеличава, другата
                  намалява.
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-700 mb-1">
                  Слаба корелация (|r| {"<"} 0.3)
                </div>
                <p className="text-xs text-gray-600">
                  Независими операции. Няма значима връзка между мелниците.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === "anomaly" && (
        <div className="flex-1 flex flex-col gap-4">
          {/* Anomaly Timeline */}
          <div className="bg-white rounded-lg shadow p-4 h-80">
            <AnomalyTimeline
              data={rawData}
              parameter={parameter}
              unit={parameterInfo?.unit}
              title="Времева линия на аномалии"
            />
          </div>

          {/* Anomaly Table */}
          <div className="bg-white rounded-lg shadow p-4 flex-1">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Детайлен списък на аномалии ({anomalies.length} открити)
            </h3>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">
                      Време
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">
                      Мелница
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">
                      Стойност
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">
                      Отклонение
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">
                      Тежест
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.slice(0, 50).map((anomaly, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-600">
                        {new Date(anomaly.timestamp).toLocaleString("bg-BG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-3 font-medium">
                        {anomaly.displayName}
                      </td>
                      <td className="text-right py-2 px-3">
                        {anomaly.value} {parameterInfo?.unit}
                      </td>
                      <td className="text-center py-2 px-3">
                        {anomaly.deviation}σ
                      </td>
                      <td className="text-center py-2 px-3">
                        {anomaly.severity === "high" && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                            Висока
                          </span>
                        )}
                        {anomaly.severity === "medium" && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                            Средна
                          </span>
                        )}
                        {anomaly.severity === "low" && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                            Ниска
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView === "seasonality" && (
        <div className="flex-1 flex flex-col gap-4">
          {/* Mill Selector */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                Изберете мелница за анализ:
              </label>
              <select
                value={selectedMill || ""}
                onChange={(e) => setSelectedMill(e.target.value || null)}
                className="px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Изберете --</option>
                {Object.keys(millValues)
                  .sort((a, b) => {
                    const numA = parseInt(a.replace(/\D/g, ""));
                    const numB = parseInt(b.replace(/\D/g, ""));
                    return numA - numB;
                  })
                  .map((mill) => {
                    const millNum = parseInt(mill.replace(/\D/g, ""));
                    const displayName = millsNames[millNum - 1]?.bg || mill;
                    return (
                      <option key={mill} value={mill}>
                        {displayName}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {selectedMill ? (
            <>
              {/* Autocorrelation Chart */}
              <div className="bg-white rounded-lg shadow p-4 h-72">
                <AutocorrelationChart
                  data={millValues[selectedMill] || []}
                  maxLag={Math.min(
                    30,
                    Math.floor((millValues[selectedMill]?.length || 0) / 4)
                  )}
                  title={`Автокорелация - ${
                    millsNames[parseInt(selectedMill.replace(/\D/g, "")) - 1]
                      ?.bg || selectedMill
                  }`}
                />
              </div>

              {/* Moving Average Comparison */}
              <div className="bg-white rounded-lg shadow p-4 h-72">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Тренд анализ с плъзгаща средна
                </h4>
                <ResponsiveContainer width="100%" height="90%">
                  <ComposedChart
                    data={movingAverageData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="formattedTime"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="value"
                      fill="#3b82f6"
                      fillOpacity={0.2}
                      stroke="#3b82f6"
                      strokeWidth={1}
                      name="Стойност"
                    />
                    <Line
                      type="monotone"
                      dataKey="sma"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name="Плъзгаща средна"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Rate of Change */}
              <div className="bg-white rounded-lg shadow p-4 h-64">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Скорост на промяна (%)
                </h4>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart
                    data={movingAverageData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="formattedTime"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `${value.toFixed(2)}%`,
                        "Промяна",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="rateOfChange"
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                      stroke="#8b5cf6"
                      strokeWidth={1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">🔄</div>
                <p>Изберете мелница за анализ на сезонност и автокорелация</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
