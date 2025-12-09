"use client";
import React, { useMemo } from "react";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";

interface StatisticsTabProps {
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
  cv: number; // Coefficient of Variation
  range: number;
  q1: number; // First quartile
  q3: number; // Third quartile
  iqr: number; // Interquartile range
}

interface MillStats {
  millName: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  stability: number; // Lower is more stable
  trend: "up" | "down" | "stable";
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({
  parameter,
  timeRange,
  millsData,
}) => {
  const parameterInfo = getParameterByValue(parameter);

  // Calculate comprehensive statistics from millsData
  const statistics = useMemo((): StatisticalMetrics | null => {
    if (!millsData?.data || millsData.data.length === 0) return null;

    // Extract all values from all mills across all time points
    const allValues: number[] = [];
    const millValues: Record<string, number[]> = {};

    millsData.data.forEach((record: any) => {
      Object.keys(record).forEach((key) => {
        if (key !== "timestamp" && key !== "parameter" && key !== "freq") {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            allValues.push(value);
            if (!millValues[key]) millValues[key] = [];
            millValues[key].push(value);
          }
        }
      });
    });

    if (allValues.length === 0) return null;

    // Sort for percentile calculations
    const sortedValues = [...allValues].sort((a, b) => a - b);

    // Calculate mean
    const mean =
      allValues.reduce((sum, val) => sum + val, 0) / allValues.length;

    // Calculate median
    const median = sortedValues[Math.floor(sortedValues.length / 2)];

    // Calculate mode (most frequent value, rounded to 1 decimal)
    const frequency: Record<string, number> = {};
    allValues.forEach((val) => {
      const rounded = val.toFixed(1);
      frequency[rounded] = (frequency[rounded] || 0) + 1;
    });
    const modeEntry = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
    const mode = modeEntry ? parseFloat(modeEntry[0]) : null;

    // Calculate standard deviation and variance
    const variance =
      allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      allValues.length;
    const stdDev = Math.sqrt(variance);

    // Calculate min/max and identify mills
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    let minMill = "";
    let maxMill = "";
    Object.entries(millValues).forEach(([mill, values]) => {
      if (values.includes(min)) minMill = mill;
      if (values.includes(max)) maxMill = mill;
    });

    // Calculate coefficient of variation
    const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;

    // Calculate quartiles
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
    const iqr = q3 - q1;

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
      cv: Number(cv.toFixed(2)),
      range: Number((max - min).toFixed(2)),
      q1: Number(q1.toFixed(2)),
      q3: Number(q3.toFixed(2)),
      iqr: Number(iqr.toFixed(2)),
    };
  }, [millsData]);

  // Calculate per-mill statistics
  const millStatistics = useMemo((): MillStats[] => {
    if (!millsData?.data || millsData.data.length === 0) return [];

    const millValues: Record<string, number[]> = {};

    // Collect values per mill
    millsData.data.forEach((record: any) => {
      Object.keys(record).forEach((key) => {
        if (key !== "timestamp" && key !== "parameter" && key !== "freq") {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            if (!millValues[key]) millValues[key] = [];
            millValues[key].push(value);
          }
        }
      });
    });

    // Calculate statistics for each mill
    return Object.entries(millValues)
      .map(([millName, values]) => {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          values.length;
        const stdDev = Math.sqrt(variance);
        const min = Math.min(...values);
        const max = Math.max(...values);

        // Calculate stability (coefficient of variation - lower is more stable)
        const stability = mean !== 0 ? (stdDev / mean) * 100 : 0;

        // Calculate trend (simple linear regression)
        let trend: "up" | "down" | "stable" = "stable";
        if (values.length > 1) {
          const firstHalf = values.slice(0, Math.floor(values.length / 2));
          const secondHalf = values.slice(Math.floor(values.length / 2));
          const firstMean =
            firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
          const secondMean =
            secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
          const change = ((secondMean - firstMean) / firstMean) * 100;

          if (change > 2) trend = "up";
          else if (change < -2) trend = "down";
        }

        return {
          millName,
          mean: Number(mean.toFixed(2)),
          stdDev: Number(stdDev.toFixed(2)),
          min: Number(min.toFixed(2)),
          max: Number(max.toFixed(2)),
          stability: Number(stability.toFixed(2)),
          trend,
        };
      })
      .sort((a, b) => {
        // Sort by mill number
        const numA = parseInt(a.millName.replace(/\D/g, ""));
        const numB = parseInt(b.millName.replace(/\D/g, ""));
        return numA - numB;
      });
  }, [millsData]);

  // Create histogram data
  const histogramData = useMemo(() => {
    if (!statistics) return [];

    const binCount = 10;
    const binSize = (statistics.max - statistics.min) / binCount;
    const bins = Array(binCount).fill(0);

    // Count values in each bin
    if (millsData?.data) {
      millsData.data.forEach((record: any) => {
        Object.keys(record).forEach((key) => {
          if (key !== "timestamp" && key !== "parameter" && key !== "freq") {
            const value = parseFloat(record[key]);
            if (!isNaN(value)) {
              const binIndex = Math.min(
                Math.floor((value - statistics.min) / binSize),
                binCount - 1
              );
              bins[binIndex]++;
            }
          }
        });
      });
    }

    return bins.map((count, index) => ({
      range: `${(statistics.min + index * binSize).toFixed(1)}-${(
        statistics.min +
        (index + 1) * binSize
      ).toFixed(1)}`,
      count,
    }));
  }, [statistics, millsData]);

  if (!statistics || !millsData) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">
          Няма налични данни за статистически анализ
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto p-6 bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Статистически анализ
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {parameterInfo?.label || parameter} •{" "}
          {timeRange === "24h"
            ? "24 Часа"
            : timeRange === "7d"
            ? "7 Дни"
            : timeRange === "30d"
            ? "30 Дни"
            : "60 Дни"}
        </p>
      </div>

      {/* Statistical Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Mean */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Средна стойност
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.mean}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {parameterInfo?.unit}
          </div>
        </div>

        {/* Median */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Медиана
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.median}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {parameterInfo?.unit}
          </div>
        </div>

        {/* Std Dev */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Стандартно отклонение
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.stdDev}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {parameterInfo?.unit}
          </div>
        </div>

        {/* CV */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Коефициент на вариация
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.cv}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Вариабилност</div>
        </div>

        {/* Min */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Минимум
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.min}
          </div>
          <div className="text-xs text-gray-500 mt-1">{statistics.minMill}</div>
        </div>

        {/* Max */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Максимум
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.max}
          </div>
          <div className="text-xs text-gray-500 mt-1">{statistics.maxMill}</div>
        </div>

        {/* Range */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Диапазон
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.range}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {parameterInfo?.unit}
          </div>
        </div>

        {/* IQR */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-teal-500">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
            Междуквартилен размах
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {statistics.iqr}
          </div>
          <div className="text-xs text-gray-500 mt-1">Q3 - Q1</div>
        </div>
      </div>

      {/* Distribution and Mill Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Distribution Histogram */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Разпределение на стойностите
          </h3>
          <div className="space-y-2">
            {histogramData.map((bin, index) => {
              const maxCount = Math.max(...histogramData.map((b) => b.count));
              const percentage = (bin.count / maxCount) * 100;

              return (
                <div key={index} className="flex items-center">
                  <div className="w-24 text-xs text-gray-600">{bin.range}</div>
                  <div className="flex-1 mx-2">
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-xs text-gray-600 text-right">
                    {bin.count}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Box plot representation */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Box Plot
            </h4>
            <div className="relative h-16 flex items-center">
              <div
                className="absolute w-full h-1 bg-gray-300"
                style={{ top: "50%" }}
              />

              {/* Min whisker */}
              <div
                className="absolute w-0.5 h-8 bg-gray-600"
                style={{
                  left: `${
                    ((statistics.min - statistics.min) /
                      (statistics.max - statistics.min)) *
                    100
                  }%`,
                  top: "25%",
                }}
              />

              {/* Box (Q1 to Q3) */}
              <div
                className="absolute h-12 bg-blue-400 border-2 border-blue-600 rounded"
                style={{
                  left: `${
                    ((statistics.q1 - statistics.min) /
                      (statistics.max - statistics.min)) *
                    100
                  }%`,
                  width: `${
                    ((statistics.q3 - statistics.q1) /
                      (statistics.max - statistics.min)) *
                    100
                  }%`,
                  top: "12.5%",
                }}
              />

              {/* Median line */}
              <div
                className="absolute w-1 h-12 bg-red-600"
                style={{
                  left: `${
                    ((statistics.median - statistics.min) /
                      (statistics.max - statistics.min)) *
                    100
                  }%`,
                  top: "12.5%",
                }}
              />

              {/* Max whisker */}
              <div
                className="absolute w-0.5 h-8 bg-gray-600"
                style={{
                  left: `${
                    ((statistics.max - statistics.min) /
                      (statistics.max - statistics.min)) *
                    100
                  }%`,
                  top: "25%",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Min: {statistics.min}</span>
              <span>Q1: {statistics.q1}</span>
              <span>Median: {statistics.median}</span>
              <span>Q3: {statistics.q3}</span>
              <span>Max: {statistics.max}</span>
            </div>
          </div>
        </div>

        {/* Mill Performance Matrix */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Производителност по мелници
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold text-gray-700">
                    Мелница
                  </th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700">
                    Средно
                  </th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700">
                    Стабилност
                  </th>
                  <th className="text-center py-2 px-2 font-semibold text-gray-700">
                    Тренд
                  </th>
                </tr>
              </thead>
              <tbody>
                {millStatistics.map((mill, index) => {
                  const millNumber = parseInt(mill.millName.replace(/\D/g, ""));
                  const displayName =
                    millsNames[millNumber - 1]?.bg || mill.millName;

                  // Color code based on stability (lower is better)
                  let stabilityColor = "bg-green-100 text-green-800";
                  if (mill.stability > 10)
                    stabilityColor = "bg-yellow-100 text-yellow-800";
                  if (mill.stability > 20)
                    stabilityColor = "bg-red-100 text-red-800";

                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium">{displayName}</td>
                      <td className="text-right py-2 px-2">{mill.mean}</td>
                      <td className="text-right py-2 px-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${stabilityColor}`}
                        >
                          {mill.stability.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-100 rounded" />
                <span>Стабилност {"<"} 10% - Отлично</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-100 rounded" />
                <span>Стабилност 10-20% - Добре</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-100 rounded" />
                <span>Стабилност {">"} 20% - Нестабилно</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Допълнителна статистика
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Квартили
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Q1 (25%):</span>
                <span className="font-medium">
                  {statistics.q1} {parameterInfo?.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Q2 (50% - Median):</span>
                <span className="font-medium">
                  {statistics.median} {parameterInfo?.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Q3 (75%):</span>
                <span className="font-medium">
                  {statistics.q3} {parameterInfo?.unit}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Разсейване
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Дисперсия:</span>
                <span className="font-medium">{statistics.variance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Стандартно отклонение:</span>
                <span className="font-medium">
                  {statistics.stdDev} {parameterInfo?.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Коеф. на вариация:</span>
                <span className="font-medium">{statistics.cv}%</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Екстремни стойности
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Минимум:</span>
                <span className="font-medium">
                  {statistics.min} {parameterInfo?.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Максимум:</span>
                <span className="font-medium">
                  {statistics.max} {parameterInfo?.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Диапазон:</span>
                <span className="font-medium">
                  {statistics.range} {parameterInfo?.unit}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
