"use client";
import React, { useMemo, useEffect, useState } from "react";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";
import {
  LineChart,
  Line,
  ComposedChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, Activity, BarChart3 } from "lucide-react";

interface ModernStatisticsTabProps {
  parameter: string;
  timeRange: string;
  millsData: any;
  sharedSelectedMills: string[];
  onSharedSelectedMillsChange: (mills: string[]) => void;
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

type StatsSortColumn =
  | "mill"
  | "avg"
  | "stdDev"
  | "cv"
  | "min"
  | "max"
  | "trend"
  | "anomalyCount"
  | "points";

export const ModernStatisticsTab: React.FC<ModernStatisticsTabProps> = ({
  parameter,
  timeRange,
  millsData,
  sharedSelectedMills,
  onSharedSelectedMillsChange,
}) => {
  const parameterInfo = getParameterByValue(parameter);
  // Initialize with first 2 available mills from data
  const selectedMills = sharedSelectedMills;

  // Sorting state for summary table
  const [statsSortColumn, setStatsSortColumn] =
    useState<StatsSortColumn>("mill");
  const [statsSortDirection, setStatsSortDirection] = useState<"asc" | "desc">(
    "asc"
  );

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

  // Auto-select first mill when data loads and there is no shared selection yet
  useEffect(() => {
    if (allMills.length > 0 && selectedMills.length === 0) {
      onSharedSelectedMillsChange([allMills[0]]);
    }
  }, [allMills, selectedMills.length, onSharedSelectedMillsChange]);

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

  // Sorting handler for summary table
  const handleStatsSort = (column: StatsSortColumn) => {
    if (statsSortColumn === column) {
      setStatsSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setStatsSortColumn(column);
      setStatsSortDirection(column === "mill" ? "asc" : "desc");
    }
  };

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

  // Summary chart data: average value and CV% per mill
  const summaryChartData = useMemo(
    () =>
      selectedMillsSorted
        .map((mill) => {
          const stats = millStatistics[mill];
          if (!stats) return null;
          return {
            mill: stats.displayName,
            avgValue: stats.avgValue,
            cv: stats.cv,
          };
        })
        .filter(
          (d): d is { mill: string; avgValue: number; cv: number } => d !== null
        ),
    [selectedMillsSorted, millStatistics]
  );

  // Helpers for multi-select mill toggling (same logic as vertical selector)
  const toggleMillSelection = (mill: string) => {
    if (selectedMills.includes(mill)) {
      onSharedSelectedMillsChange(selectedMills.filter((m) => m !== mill));
    } else {
      onSharedSelectedMillsChange([...selectedMills, mill]);
    }
  };

  // Clicking the main pill toggles the mill in the selection
  const handleMillClick = (mill: string) => {
    toggleMillSelection(mill);
  };

  // Corner checkbox also toggles the same selection (multi-select)
  const handleMillCheckboxClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    mill: string
  ) => {
    event.stopPropagation();
    toggleMillSelection(mill);
  };

  // Select / deselect all mills helper
  const handleSelectAllMills = () => {
    if (allMills.length === 0) return;
    const allSelected = allMills.every((mill) => selectedMills.includes(mill));
    onSharedSelectedMillsChange(allSelected ? [] : allMills);
  };

  // Get mill display name
  const getMillDisplayName = (millName: string) => {
    const millNumber = parseInt(millName.replace(/\D/g, ""));
    return millsNames[millNumber - 1]?.bg || millName;
  };

  // Color palette for mills (shared with TrendsTab)
  const millColors = [
    "#4f46e5", // Indigo
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#ec4899", // Pink
    "#3b82f6", // Blue
    "#ef4444", // Red
  ];

  const getMillColor = (index: number) => millColors[index % millColors.length];

  // Sorted mills list for summary table (independent from chart ordering)
  const sortedMillsForSummary = useMemo(() => {
    const mills = [...selectedMillsSorted];
    const trendRank: Record<MillStatistics["trend"], number> = {
      down: 0,
      stable: 1,
      up: 2,
    };

    mills.sort((a, b) => {
      const sa = millStatistics[a];
      const sb = millStatistics[b];
      if (!sa || !sb) return 0;

      let va: number | string = 0;
      let vb: number | string = 0;

      switch (statsSortColumn) {
        case "mill":
          va = sa.displayName;
          vb = sb.displayName;
          break;
        case "avg":
          va = sa.avgValue;
          vb = sb.avgValue;
          break;
        case "stdDev":
          va = sa.stdDev;
          vb = sb.stdDev;
          break;
        case "cv":
          va = sa.cv;
          vb = sb.cv;
          break;
        case "min":
          va = sa.min;
          vb = sb.min;
          break;
        case "max":
          va = sa.max;
          vb = sb.max;
          break;
        case "trend":
          va = trendRank[sa.trend];
          vb = trendRank[sb.trend];
          break;
        case "anomalyCount":
          va = sa.anomalyCount;
          vb = sb.anomalyCount;
          break;
        case "points":
          va = sa.dataPoints;
          vb = sb.dataPoints;
          break;
      }

      // String vs number comparison
      if (typeof va === "string" && typeof vb === "string") {
        const cmp = va.localeCompare(vb, "bg-BG");
        return statsSortDirection === "asc" ? cmp : -cmp;
      }

      const na = Number(va);
      const nb = Number(vb);
      if (!Number.isFinite(na) || !Number.isFinite(nb)) return 0;
      return statsSortDirection === "asc" ? na - nb : nb - na;
    });

    return mills;
  }, [
    selectedMillsSorted,
    millStatistics,
    statsSortColumn,
    statsSortDirection,
  ]);

  const renderSortIndicator = (column: StatsSortColumn) => {
    // Inactive column: small, neutral badge
    if (statsSortColumn !== column) {
      return (
        <span className="inline-flex items-center justify-center ml-1 h-4 w-4 rounded-full border border-gray-200 bg-gray-50 text-[10px] text-gray-400">
          ↕
        </span>
      );
    }

    // Active sort column: highlighted badge with clear arrow direction
    return (
      <span className="inline-flex items-center justify-center ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-300">
        {statsSortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

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
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg text-gray-800">
                <div className="inline-flex items-center gap-1 relative group cursor-help">
                  <span>Избор на мелници</span>
                  <div className="absolute left-0 top-full mt-2 z-20 w-96 rounded-md bg-white/95 text-slate-900 text-sm px-4 py-2 shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transform -translate-y-1 pointer-events-none transition-all duration-150 leading-snug">
                    <p className="font-semibold text-slate-900">
                      Какво прави този контрол?
                    </p>
                    <p className="mt-1 text-slate-700">
                      Тук избирате кои мелници да участват в анализа и графиките
                      по-долу.
                    </p>
                    <p className="mt-1 text-slate-700">
                      Щракване върху име на мелница я добавя или премахва от
                      избора. Малката отметка в ъгъла прави същото, но ви дава
                      по-прецизен контрол при много мелници. Бутонът „Всички“
                      включва или изключва всички налични мелници наведнъж.
                    </p>
                  </div>
                </div>
              </CardTitle>
              <button
                type="button"
                onClick={handleSelectAllMills}
                className="px-3 py-1 text-xs font-medium rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50 whitespace-nowrap"
              >
                Всички
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allMills.map((mill, idx) => {
                const isSelected = selectedMills.includes(mill);
                return (
                  <div key={mill} className="relative">
                    <button
                      type="button"
                      onClick={() => handleMillClick(mill)}
                      className={`min-w-[96px] pl-4 pr-8 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-blue-500 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: getMillColor(idx) }}
                        />
                        {getMillDisplayName(mill)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleMillCheckboxClick(event, mill)}
                      className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded border text-[9px] ${
                        isSelected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-white border-gray-300 text-transparent"
                      }`}
                      aria-label="Добави към множествен избор"
                    >
                      ✓
                    </button>
                  </div>
                );
              })}
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
              <CardTitle className="text-gray-800">
                <div className="inline-flex items-center gap-2 relative group cursor-help">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <span>
                    Статистически контрол на процеса -{" "}
                    {parameterInfo?.labelBg || parameter}
                  </span>
                  <div className="absolute left-0 top-full mt-2 z-20 w-96 rounded-md bg-white/95 text-slate-900 text-sm px-4 py-2 shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transform -translate-y-1 pointer-events-none transition-all duration-150 leading-snug">
                    <p className="font-semibold text-slate-900">
                      Какво показва тази диаграма?
                    </p>
                    <p className="mt-1 text-slate-700">
                      Диаграмата следи дали процесът за{" "}
                      {parameterInfo?.labelBg || parameter} е стабилен във
                      времето спрямо нормалното му поведение.
                    </p>
                    <p className="mt-1 text-slate-700">
                      Зелената линия е средната стойност на параметъра, а двете
                      червени линии са горна и долна контролна граница (UCL/LCL)
                      – зоната, в която процесът се счита за нормален.
                    </p>
                    <p className="mt-1 text-slate-700">
                      Оранжевите точки отбелязват моменти, в които стойността
                      излиза извън този диапазон или се държи необичайно – те
                      подсказват нужда от допълнителна проверка на мелницата и
                      входните условия.
                    </p>
                  </div>
                </div>
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
              <CardTitle className="text-gray-800">
                <div className="inline-flex items-center gap-2 relative group cursor-help">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <span>
                    Разпределение на {parameterInfo?.labelBg || parameter}
                  </span>
                  <div className="absolute left-0 top-full mt-2 z-20 w-96 rounded-md bg-white/95 text-slate-900 text-sm px-4 py-2 shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transform -translate-y-1 pointer-events-none transition-all duration-150 leading-snug">
                    <p className="font-semibold text-slate-900">
                      Какво виждате тук?
                    </p>
                    <p className="mt-1 text-slate-700">
                      Хистограмата показва колко често параметърът{" "}
                      {parameterInfo?.labelBg || parameter} приема стойности в
                      различни интервали.
                    </p>
                    <p className="mt-1 text-slate-700">
                      Всяка лента е диапазон от стойности, а височината ѝ
                      показва колко измервания попадат в този диапазон. Така
                      лесно виждате дали процесът работи в тесен диапазон или
                      има голяма вариация.
                    </p>
                  </div>
                </div>
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

          {/* Summary Chart: Average and CV per Mill */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-800">
                <div className="inline-flex items-center gap-2 relative group cursor-help">
                  <Activity className="w-5 h-5 text-blue-500" />
                  <span>Средна стойност и вариация по мелници</span>
                  <div className="absolute left-0 top-full mt-2 z-20 w-96 rounded-md bg-white/95 text-slate-900 text-sm px-4 py-2 shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transform -translate-y-1 pointer-events-none transition-all duration-150 leading-snug">
                    <p className="font-semibold text-slate-900">
                      Как да четете тази графика?
                    </p>
                    <p className="mt-1 text-slate-700">
                      Сините колони показват средната стойност на параметъра за
                      всяка мелница.
                    </p>
                    <p className="mt-1 text-slate-700">
                      Оранжевата линия (CV %) показва относителната вариация –
                      колко нестабилна е всяка мелница спрямо собствената си
                      средна стойност.
                    </p>
                    <p className="mt-1 text-slate-700">
                      Висока средна стойност с нисък CV % означава стабилен и
                      добре контролиран процес, докато висок CV % подсказва
                      нужда от допълнителен анализ.
                    </p>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={summaryChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="mill"
                      stroke="#6b7280"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#6b7280"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: parameterInfo?.unit || "Средна",
                        angle: -90,
                        position: "insideLeft",
                        offset: 10,
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#6b7280"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: "CV %",
                        angle: 90,
                        position: "insideRight",
                        offset: 10,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#374151" }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="avgValue"
                      name="Средна"
                      radius={[4, 4, 0, 0]}
                    >
                      {summaryChartData.map((entry, index) => (
                        <Cell
                          key={`avg-${entry.mill}`}
                          fill={getMillColor(index)}
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cv"
                      name="CV %"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  Няма достатъчно данни за обобщаваща диаграма
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trend Lines per Mill */}
          <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-800">
                <div className="inline-flex items-center gap-2 relative group cursor-help">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <span>Тенденции по мелници</span>
                  <div className="absolute left-0 top-full mt-2 z-20 w-96 rounded-md bg-white/95 text-slate-900 text-sm px-4 py-2 shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transform -translate-y-1 pointer-events-none transition-all duration-150 leading-snug">
                    <p className="font-semibold text-slate-900">
                      Какво показват линиите?
                    </p>
                    <p className="mt-1 text-slate-700">
                      Всяка линия описва как се променя параметърът във времето
                      за избраните мелници.
                    </p>
                    <p className="mt-1 text-slate-700">
                      По наклона и формата на линиите можете да видите
                      нарастващи, намаляващи или нестабилни тенденции и да ги
                      сравните между отделните мелници.
                    </p>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredData.slice(-100)}>
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
              <div className="inline-flex items-center gap-2 relative group cursor-help">
                <Activity className="w-5 h-5 text-blue-500" />
                <span>Обобщена статистика по мелници</span>
                <div className="absolute left-0 top-full mt-2 z-20 w-96 rounded-md bg-white/95 text-slate-900 text-sm px-4 py-2 shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transform -translate-y-1 pointer-events-none transition-all duration-150 leading-snug">
                  <p className="font-semibold text-slate-900">
                    Как да използвате тази таблица?
                  </p>
                  <p className="mt-1 text-slate-700">
                    Таблицата събира основните показатели за всяка мелница –
                    средна стойност, вариация, минимум, максимум, тенденция и
                    брой аномалии.
                  </p>
                  <p className="mt-1 text-slate-700">
                    Можете да щраквате върху заглавията на колоните, за да
                    сортирате мелниците по съответния показател и да
                    идентифицирате най-добрите и най-проблемните.
                  </p>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("mill")}
                        className="flex items-center gap-1"
                      >
                        Мелница
                        {renderSortIndicator("mill")}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("avg")}
                        className="flex items-center justify-end gap-1 w-full"
                      >
                        Средна
                        {renderSortIndicator("avg")}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("stdDev")}
                        className="flex items-center justify-end gap-1 w-full"
                      >
                        Ст. откл.
                        {renderSortIndicator("stdDev")}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("cv")}
                        className="flex items-center justify-end gap-1 w-full"
                      >
                        CV %{renderSortIndicator("cv")}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("min")}
                        className="flex items-center justify-end gap-1 w-full"
                      >
                        Мин
                        {renderSortIndicator("min")}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("max")}
                        className="flex items-center justify-end gap-1 w-full"
                      >
                        Макс
                        {renderSortIndicator("max")}
                      </button>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("trend")}
                        className="flex items-center justify-center gap-1 w-full"
                      >
                        Тренд
                        {renderSortIndicator("trend")}
                      </button>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("anomalyCount")}
                        className="flex items-center justify-center gap-1 w-full"
                      >
                        Аномалии
                        {renderSortIndicator("anomalyCount")}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <button
                        type="button"
                        onClick={() => handleStatsSort("points")}
                        className="flex items-center justify-end gap-1 w-full"
                      >
                        Точки
                        {renderSortIndicator("points")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMillsForSummary.map((mill) => {
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
                              style={{
                                backgroundColor: getMillColor(
                                  Math.max(0, selectedMillsSorted.indexOf(mill))
                                ),
                              }}
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
