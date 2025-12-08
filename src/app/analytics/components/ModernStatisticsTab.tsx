"use client";
import React, { useMemo, useState, useEffect } from "react";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, Activity, BarChart3 } from "lucide-react";

interface ModernStatisticsTabProps {
  parameter: string;
  timeRange: string;
  millsData: any;
}

interface MillStatistics {
  millName: string;
  displayName: string;
  avgValue: number;
  stdDev: number;
  min: number;
  max: number;
  cv: number;
  anomalyCount: number;
  trend: "up" | "down" | "stable";
  dataPoints: number;
}

export const ModernStatisticsTab: React.FC<ModernStatisticsTabProps> = ({
  parameter,
  timeRange,
  millsData,
}) => {
  const parameterInfo = getParameterByValue(parameter);
  // Initialize with first 2 available mills from data
  const [selectedMills, setSelectedMills] = useState<string[]>([]);

  // Get all available mills from data
  const allMills = useMemo(() => {
    if (!millsData?.data || millsData.data.length === 0) return [];
    const mills = Object.keys(millsData.data[0]).filter(
      (key) => key !== "timestamp" && key !== "parameter" && key !== "freq"
    );
    return mills.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""));
      const numB = parseInt(b.replace(/\D/g, ""));
      return numA - numB;
    });
  }, [millsData]);

  // Auto-select first mills when data loads
  useEffect(() => {
    if (allMills.length > 0 && selectedMills.length === 0) {
      setSelectedMills([allMills[0]]);
    }
  }, [allMills, selectedMills.length]);

  const selectedMillsSorted = useMemo(
    () =>
      [...selectedMills].sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""));
        const numB = parseInt(b.replace(/\D/g, ""));
        return numA - numB;
      }),
    [selectedMills]
  );

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

  // Calculate per-mill statistics
  const millStatistics = useMemo((): Record<string, MillStatistics> => {
    const stats: Record<string, MillStatistics> = {};

    Object.entries(millValues).forEach(([millName, values]) => {
      if (values.length === 0) return;

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

      // Anomaly detection (values outside 2 std dev)
      const anomalyCount = values.filter(
        (v) => Math.abs(v - mean) > 2 * stdDev
      ).length;

      const millNumber = parseInt(millName.replace(/\D/g, ""));
      const displayName = millsNames[millNumber - 1]?.bg || millName;

      stats[millName] = {
        millName,
        displayName,
        avgValue: Number(mean.toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        min: Number(Math.min(...values).toFixed(2)),
        max: Number(Math.max(...values).toFixed(2)),
        cv: Number(cv.toFixed(2)),
        anomalyCount,
        trend,
        dataPoints: values.length,
      };
    });

    return stats;
  }, [millValues]);

  // Apply per-mill 4-sigma outlier filtering for chart data
  // We keep millStatistics based on the original data, but charts use the
  // cleaned series where values beyond 4 standard deviations are removed.
  const cleanTimeSeriesData = useMemo(() => {
    if (!timeSeriesData.length) return [];

    return timeSeriesData.map((d) => {
      const cleaned: { timestamp: string; [key: string]: any } = {
        timestamp: d.timestamp,
      };

      Object.keys(d).forEach((key) => {
        if (key === "timestamp") return;

        const value = d[key];
        if (typeof value !== "number") {
          if (value !== undefined && value !== null) {
            cleaned[key] = value;
          }
          return;
        }

        const statsForMill = millStatistics[key];
        if (
          !statsForMill ||
          !Number.isFinite(statsForMill.stdDev) ||
          statsForMill.stdDev === 0
        ) {
          // No valid statistics for this mill – keep the value
          cleaned[key] = value;
          return;
        }

        const deviation =
          Math.abs(value - statsForMill.avgValue) / statsForMill.stdDev;

        // Keep only values within 4 standard deviations
        if (deviation <= 4) {
          cleaned[key] = value;
        }
      });

      return cleaned;
    });
  }, [timeSeriesData, millStatistics]);

  // Filtered data for selected mills (after outlier removal)
  const filteredData = useMemo(() => {
    return cleanTimeSeriesData.filter((d) =>
      selectedMills.some((mill) => d[mill] !== undefined)
    );
  }, [cleanTimeSeriesData, selectedMills]);

  // Control chart data
  const controlChartData = useMemo(() => {
    if (selectedMillsSorted.length === 0 || filteredData.length === 0) {
      return { data: [], ucl: 0, lcl: 0, mean: 0 };
    }

    // Use the per-timestamp average across selected mills as the main series
    const recent = filteredData.slice(-100);
    const data = recent.map((d, i) => {
      const point: any = { index: i, timestamp: d.timestamp };
      const vals: number[] = [];

      selectedMillsSorted.forEach((mill) => {
        if (d[mill] !== undefined) {
          const v = d[mill] as number;
          point[mill] = v;
          vals.push(v);
        }
      });

      point.value =
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

      return point;
    });

    const valuesForStats = data
      .map((p: any) => p.value)
      .filter((v: number | null) => v !== null) as number[];

    if (valuesForStats.length === 0) {
      return { data: [], ucl: 0, lcl: 0, mean: 0 };
    }

    const mean =
      valuesForStats.reduce((a, b) => a + b, 0) / valuesForStats.length;
    const stdDev = Math.sqrt(
      valuesForStats.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
        valuesForStats.length
    );

    // Mark anomalies based on the aggregated series
    data.forEach((point: any) => {
      if (point.value !== null) {
        point.isAnomaly = Math.abs(point.value - mean) > 2 * stdDev;
      } else {
        point.isAnomaly = false;
      }
    });

    return {
      data,
      ucl: mean + 3 * stdDev,
      lcl: mean - 3 * stdDev,
      mean,
    };
  }, [filteredData, selectedMillsSorted]);

  // Y-axis domain for control chart that also includes control limits (UCL/LCL)
  const controlChartYAxisDomain = useMemo(() => {
    if (!controlChartData.data.length) {
      // Let Recharts decide when there is no data
      return ["auto", "auto"] as [number | "auto", number | "auto"];
    }

    // Use the main aggregated value series for min/max
    const values = controlChartData.data
      .map((d: any) => d.value)
      .filter((v: number | null) => v !== null) as number[];

    if (!values.length) {
      return ["auto", "auto"] as [number | "auto", number | "auto"];
    }

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    // Ensure the domain also covers the statistical limits
    const minWithLimits = Math.min(dataMin, controlChartData.lcl);
    const maxWithLimits = Math.max(dataMax, controlChartData.ucl);

    if (!Number.isFinite(minWithLimits) || !Number.isFinite(maxWithLimits)) {
      return ["auto", "auto"] as [number | "auto", number | "auto"];
    }

    const span = maxWithLimits - minWithLimits || 1; // avoid zero span
    const padding = span * 0.1; // 10% padding around data + limits

    const lower = minWithLimits - padding;
    const upper = maxWithLimits + padding;

    return [Math.floor(lower), Math.ceil(upper)] as [number, number];
  }, [controlChartData]);

  // Distribution histogram data
  const distributionData = useMemo(() => {
    const selectedValues: number[] = [];
    filteredData.forEach((d) => {
      selectedMillsSorted.forEach((mill) => {
        if (d[mill] !== undefined) {
          selectedValues.push(d[mill] as number);
        }
      });
    });

    if (selectedValues.length === 0) return [];

    const bins = 15;
    const min = Math.min(...selectedValues);
    const max = Math.max(...selectedValues);
    const binSize = (max - min) / bins;

    const histogram = Array.from({ length: bins }, (_, i) => ({
      range: `${(min + i * binSize).toFixed(0)}-${(
        min +
        (i + 1) * binSize
      ).toFixed(0)}`,
      count: 0,
      midpoint: min + (i + 0.5) * binSize,
    }));

    selectedValues.forEach((val) => {
      const binIndex = Math.min(Math.floor((val - min) / binSize), bins - 1);
      if (binIndex >= 0 && binIndex < bins) {
        histogram[binIndex].count++;
      }
    });

    return histogram;
  }, [filteredData, selectedMillsSorted]);

  // Correlation data (for scatter plot)
  // We use an explicit numeric index for the X-axis to keep spacing stable
  // when multiple mills are selected, and format ticks back to time labels.
  const correlationData = useMemo(() => {
    return filteredData.slice(0, 200).map((d, index) => {
      const point: any = { timestamp: d.timestamp, index };
      selectedMillsSorted.forEach((mill) => {
        point[mill] = d[mill];
        const millNum = parseInt(mill.replace(/\D/g, ""));
        point.millId = millsNames[millNum - 1]?.bg || mill;
      });
      return point;
    });
  }, [filteredData, selectedMillsSorted]);

  // Toggle mill selection
  const toggleMill = (mill: string) => {
    setSelectedMills((prev) =>
      prev.includes(mill) ? prev.filter((m) => m !== mill) : [...prev, mill]
    );
  };

  // Get mill display name
  const getMillDisplayName = (millName: string) => {
    const millNumber = parseInt(millName.replace(/\D/g, ""));
    return millsNames[millNumber - 1]?.bg || millName;
  };

  // Color palette for mills
  const millColors = [
    "#06b6d4", // cyan
    "#8b5cf6", // violet
    "#f59e0b", // amber
    "#10b981", // emerald
    "#ef4444", // red
    "#3b82f6", // blue
    "#ec4899", // pink
    "#84cc16", // lime
    "#f97316", // orange
    "#6366f1", // indigo
    "#14b8a6", // teal
    "#a855f7", // purple
  ];

  const getMillColor = (index: number) => millColors[index % millColors.length];

  if (!millsData?.data || millsData.data.length === 0) {
    return (
      <div className="p-4 h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">
          Няма налични данни за статистически анализ
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 text-gray-900 p-6 overflow-auto">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Статистически анализ на процеса
            </h1>
            <p className="text-gray-500 mt-1">
              {parameterInfo?.labelBg || parameter} •{" "}
              {timeRange === "8h"
                ? "8 Часа"
                : timeRange === "24h"
                ? "24 Часа"
                : timeRange === "7d"
                ? "7 Дни"
                : "30 Дни"}{" "}
              • {allValues.length.toLocaleString()} точки данни
            </p>
          </div>
        </div>

        {/* Mill Selector */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-gray-800">
              Избор на мелници
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allMills.map((mill, idx) => (
                <button
                  key={mill}
                  onClick={() => toggleMill(mill)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedMills.includes(mill)
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {getMillDisplayName(mill)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {selectedMillsSorted.map((mill) => {
            const stats = millStatistics[mill];
            if (!stats) return null;

            return (
              <Card key={mill} className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-600 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    {stats.displayName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Средна ст.</span>
                    <span className="text-sm font-bold text-gray-800">
                      {stats.avgValue} {parameterInfo?.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Ст. откл.</span>
                    <span className="text-sm font-bold text-gray-800">
                      {stats.stdDev} {parameterInfo?.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">CV</span>
                    <span className="text-sm font-bold text-gray-800">
                      {stats.cv}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Диапазон</span>
                    <span className="text-sm font-bold text-gray-800">
                      {stats.min} - {stats.max}
                    </span>
                  </div>
                  {stats.anomalyCount > 0 && (
                    <div className="flex items-center gap-2 text-amber-600 text-xs pt-2 border-t border-gray-200">
                      <AlertCircle className="w-3 h-3" />
                      <span>{stats.anomalyCount} аномалии открити</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Control Chart - Full Width */}
          <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Статистически контрол на процеса -{" "}
                {parameterInfo?.labelBg || parameter}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={controlChartData.data}
                  margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="index"
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    domain={controlChartYAxisDomain}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#374151" }}
                    labelFormatter={(value, _payload) => {
                      const index =
                        typeof value === "number" ? value : Number(value);
                      if (
                        !Number.isFinite(index) ||
                        index < 0 ||
                        index >= controlChartData.data.length
                      ) {
                        return "";
                      }

                      const point = controlChartData.data[Math.round(index)];
                      if (!point?.timestamp) return "";

                      const date = new Date(point.timestamp as string);
                      // Example: 08.12 14:00
                      const day = String(date.getDate()).padStart(2, "0");
                      const month = String(date.getMonth() + 1).padStart(
                        2,
                        "0"
                      );
                      const hours = String(date.getHours()).padStart(2, "0");
                      const minutes = String(date.getMinutes()).padStart(
                        2,
                        "0"
                      );
                      return `${day}.${month} ${hours}:${minutes}`;
                    }}
                    formatter={(value: any, name: string) => {
                      if (typeof value === "number" && Number.isFinite(value)) {
                        const unit = parameterInfo?.unit
                          ? ` ${parameterInfo.unit}`
                          : "";
                        return [`${value.toFixed(1)}${unit}`, name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={controlChartData.ucl}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{
                      value: "UCL",
                      position: "right",
                      fill: "#ef4444",
                      fontSize: 11,
                      dy: -4,
                    }}
                  />
                  <ReferenceLine
                    y={controlChartData.mean}
                    stroke="#22c55e"
                    strokeDasharray="3 3"
                    label={{
                      value: "Средна",
                      position: "right",
                      fill: "#22c55e",
                      fontSize: 11,
                      dy: -4,
                    }}
                  />
                  <ReferenceLine
                    y={controlChartData.lcl}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{
                      value: "LCL",
                      position: "right",
                      fill: "#ef4444",
                      fontSize: 11,
                      dy: -4,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Средна стойност"
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      if (!cx || !cy)
                        return <circle key={`dot-empty-${index}`} r={0} />;
                      return payload.isAnomaly ? (
                        <circle
                          key={`dot-anomaly-${index}`}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="#f59e0b"
                          stroke="#fbbf24"
                          strokeWidth={2}
                        />
                      ) : (
                        <circle
                          key={`dot-normal-${index}`}
                          cx={cx}
                          cy={cy}
                          r={2}
                          fill="#3b82f6"
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribution Histogram */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Разпределение на {parameterInfo?.labelBg || parameter}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="range"
                    stroke="#6b7280"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#374151" }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    name="Брой"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Scatter Plot - Value vs Time Index */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-800">
                Сравнение между мелници
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="index"
                    type="number"
                    name="Време"
                    stroke="#6b7280"
                    tickFormatter={(val: number) => {
                      const idx = Math.round(Number(val));
                      const ts =
                        idx >= 0 && idx < correlationData.length
                          ? correlationData[idx].timestamp
                          : undefined;
                      if (!ts) return "";
                      const date = new Date(ts);
                      return `${date.getHours()}:${date
                        .getMinutes()
                        .toString()
                        .padStart(2, "0")}`;
                    }}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    name={parameterInfo?.labelBg || parameter}
                    unit={parameterInfo?.unit ? ` ${parameterInfo.unit}` : ""}
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    domain={[
                      (dataMin: number) => Math.floor(dataMin * 0.95),
                      (dataMax: number) => Math.ceil(dataMax * 1.05),
                    ]}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#374151" }}
                  />
                  <Legend />
                  {selectedMillsSorted.map((mill, idx) => (
                    <Scatter
                      key={mill}
                      name={getMillDisplayName(mill)}
                      data={correlationData.filter(
                        (d) => d[mill] !== undefined
                      )}
                      fill={getMillColor(idx)}
                      dataKey={mill}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trend Lines per Mill */}
          <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-800">
                Тенденции по мелници
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredData.slice(-50)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#6b7280"
                    tickFormatter={(val) => {
                      const date = new Date(val);
                      return `${date.getHours()}:${date
                        .getMinutes()
                        .toString()
                        .padStart(2, "0")}`;
                    }}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    domain={[
                      (dataMin: number) => Math.floor(dataMin * 0.95),
                      (dataMax: number) => Math.ceil(dataMax * 1.05),
                    ]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(val) =>
                      new Date(val).toLocaleString("bg-BG")
                    }
                    labelStyle={{ color: "#374151" }}
                  />
                  <Legend />
                  {selectedMillsSorted.map((mill, idx) => (
                    <Line
                      key={mill}
                      type="monotone"
                      dataKey={mill}
                      stroke={getMillColor(idx)}
                      strokeWidth={2}
                      name={getMillDisplayName(mill)}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Summary Table */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-800">
              Обобщена статистика по мелници
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Мелница
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Средна
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Ст. откл.
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      CV %
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Мин
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Макс
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Тренд
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Аномалии
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Точки
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMillsSorted.map((mill, idx) => {
                    const stats = millStatistics[mill];
                    if (!stats) return null;

                    return (
                      <tr
                        key={mill}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getMillColor(idx) }}
                            />
                            {stats.displayName}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 text-gray-800">
                          {stats.avgValue}
                        </td>
                        <td className="text-right py-3 px-4 text-gray-600">
                          {stats.stdDev}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              stats.cv < 10
                                ? "bg-green-100 text-green-700"
                                : stats.cv < 20
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {stats.cv}%
                          </span>
                        </td>
                        <td className="text-right py-3 px-4 text-gray-500">
                          {stats.min}
                        </td>
                        <td className="text-right py-3 px-4 text-gray-500">
                          {stats.max}
                        </td>
                        <td className="text-center py-3 px-4">
                          {stats.trend === "up" && (
                            <span className="text-green-600 text-lg">↑</span>
                          )}
                          {stats.trend === "down" && (
                            <span className="text-red-600 text-lg">↓</span>
                          )}
                          {stats.trend === "stable" && (
                            <span className="text-gray-400 text-lg">→</span>
                          )}
                        </td>
                        <td className="text-center py-3 px-4">
                          {stats.anomalyCount > 0 ? (
                            <span className="flex items-center justify-center gap-1 text-amber-600">
                              <AlertCircle className="w-3 h-3" />
                              {stats.anomalyCount}
                            </span>
                          ) : (
                            <span className="text-green-600">✓</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-4 text-gray-500">
                          {stats.dataPoints}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
