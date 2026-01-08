"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Download,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { toast } from "sonner";

interface OptimizationResultsDisplayProps {
  results: {
    status: string;
    success_rate: number;
    successful_trials: number;
    total_trials: number;
    best_target_value: number;
    target_achieved: boolean;
    optimization_time: number;
    best_distance?: number;
    worst_distance?: number;
    best_mv_values: Record<string, number>;
    mv_distributions?: Record<
      string,
      {
        mean: number;
        std: number;
        median: number;
        percentiles: Record<string, number>;
        min_value: number;
        max_value: number;
        sample_count: number;
      }
    >;
    target_value: number;
    tolerance: number;
  };
  targetVariable: string;
  targetUnit: string;
  currentValues?: Record<string, number>;
  onApplyValues?: (values: Record<string, number>) => void;
}

export function OptimizationResultsDisplay({
  results,
  targetVariable,
  targetUnit,
  currentValues,
  onApplyValues,
}: OptimizationResultsDisplayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate performance rating
  const performanceRating = useMemo(() => {
    const successRate = results.success_rate * 100;
    if (successRate >= 70)
      return { label: "Отлично", color: "emerald", icon: CheckCircle };
    if (successRate >= 50)
      return { label: "Добро", color: "blue", icon: TrendingUp };
    return { label: "Приемливо", color: "amber", icon: AlertTriangle };
  }, [results.success_rate]);

  // Generate histogram data from distributions
  const generateHistogramData = (
    paramName: string,
    distribution: any,
    bestValue: number
  ) => {
    if (!distribution) return [];

    const { min_value, max_value, mean, std } = distribution;
    const numBins = 15; // Number of histogram bins
    const binWidth = (max_value - min_value) / numBins;

    // Create bins
    const bins = [];
    for (let i = 0; i < numBins; i++) {
      const binStart = min_value + i * binWidth;
      const binEnd = binStart + binWidth;
      const binCenter = (binStart + binEnd) / 2;

      // Approximate frequency using normal distribution
      // This is a visual approximation since we don't have raw trial data
      const z = (binCenter - mean) / std;
      const frequency = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));

      bins.push({
        binCenter,
        binStart,
        binEnd,
        frequency: frequency * 100, // Scale for visibility
        label: binCenter.toFixed(1),
      });
    }

    return bins;
  };

  const PerformanceIcon = performanceRating.icon;

  return (
    <div className="space-y-4">
      {/* Performance Summary Card */}
      <Card
        className={`border-2 border-${performanceRating.color}-200 bg-${performanceRating.color}-50/50`}
      >
        <CardHeader
          className="pb-3 cursor-pointer select-none hover:bg-slate-50/50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <CardTitle className="flex items-center gap-2 text-lg w-full">
            <PerformanceIcon
              className={`h-5 w-5 text-${performanceRating.color}-600`}
            />
            Резултати от оптимизацията
            <Badge
              variant="outline"
              className={`ml-2 bg-${performanceRating.color}-100 text-${performanceRating.color}-700 border-${performanceRating.color}-300`}
            >
              {performanceRating.label}
            </Badge>
            <div className="ml-auto flex items-center gap-4">
              {results.best_mv_values && onApplyValues && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyValues(results.best_mv_values);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-sm animate-pulse-subtle"
                >
                  <Zap className="h-4 w-4" />
                  Приложи стойностите
                </Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-normal text-slate-400">
                  {isCollapsed ? "Покажи детайли" : "Скрий детайли"}
                </span>
                {isCollapsed ? (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Success Rate */}
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Успеваемост</div>
                <div
                  className={`text-2xl font-bold text-${performanceRating.color}-600`}
                >
                  {(results.success_rate * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500">
                  {results.successful_trials}/{results.total_trials} опити
                </div>
              </div>

              {/* Target Achievement */}
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">
                  Цел постигната
                </div>
                <div
                  className={`text-2xl font-bold ${
                    results.target_achieved
                      ? "text-green-600"
                      : "text-amber-600"
                  }`}
                >
                  {results.target_achieved ? "✓" : "⚠"}
                </div>
                <div className="text-xs text-slate-500">
                  {results.best_target_value.toFixed(3)} {targetUnit}
                </div>
              </div>

              {/* Execution Time */}
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Време</div>
                <div className="text-2xl font-bold text-blue-600">
                  {results.optimization_time.toFixed(1)}s
                </div>
                <div className="text-xs text-slate-500">
                  {(
                    (results.optimization_time / results.total_trials) *
                    1000
                  ).toFixed(0)}
                  ms/опит
                </div>
              </div>

              {/* Best Distance */}
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Точност</div>
                <div className="text-2xl font-bold text-purple-600">
                  {results.best_distance !== undefined
                    ? results.best_distance.toFixed(4)
                    : "—"}
                </div>
                <div className="text-xs text-slate-500">
                  Най-добро отклонение
                </div>
              </div>
            </div>

            {/* Target Info */}
            <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Целева стойност:</span>
                <span className="font-semibold">
                  {results.target_value.toFixed(2)} {targetUnit}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-600">Толеранс:</span>
                <span className="font-semibold">
                  ±{(results.tolerance * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-600">Допустим диапазон:</span>
                <span className="font-semibold">
                  {(results.target_value * (1 - results.tolerance)).toFixed(2)}{" "}
                  -{" "}
                  {(results.target_value * (1 + results.tolerance)).toFixed(2)}{" "}
                  {targetUnit}
                </span>
              </div>
            </div>

            {/* Action-Oriented Summary */}
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    Препоръчани промени
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {Object.keys(results.best_mv_values).length > 0 ? (
                      <>
                        Промяна на{" "}
                        <span className="font-semibold">
                          {Object.keys(results.best_mv_values).length}{" "}
                          параметъра
                        </span>{" "}
                        ще доведе до {targetVariable} ={" "}
                        <span className="font-semibold">
                          {results.best_target_value.toFixed(2)} {targetUnit}
                        </span>
                        {results.target_achieved && (
                          <span className="text-green-600 ml-1">
                            ✓ В рамките на целта
                          </span>
                        )}
                      </>
                    ) : (
                      "Няма препоръчани промени"
                    )}
                  </p>
                </div>
              </div>

              {/* MV Changes Table */}
              {Object.keys(results.best_mv_values).length > 0 && (
                <div className="mt-3 bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                          Параметър
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                          Текуща
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                          →
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                          Предложена
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                          Промяна
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {Object.entries(results.best_mv_values).map(
                        ([param, value]) => {
                          const current = currentValues?.[param];
                          const change =
                            current !== undefined
                              ? (value as number) - current
                              : null;
                          const changePercent =
                            current !== undefined && current !== 0
                              ? (((value as number) - current) / current) * 100
                              : null;

                          return (
                            <tr
                              key={param}
                              className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            >
                              <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                                {param}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500">
                                {current !== undefined
                                  ? current.toFixed(2)
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <ArrowRight className="h-4 w-4 text-slate-400 mx-auto" />
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-blue-600">
                                {(value as number).toFixed(2)}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-medium ${
                                  change !== null
                                    ? change > 0
                                      ? "text-emerald-600"
                                      : change < 0
                                      ? "text-red-500"
                                      : "text-slate-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {change !== null ? (
                                  <>
                                    {change > 0 ? "+" : ""}
                                    {change.toFixed(2)}
                                    <span className="text-xs ml-1">
                                      (
                                      {changePercent !== null
                                        ? `${
                                            changePercent > 0 ? "+" : ""
                                          }${changePercent.toFixed(1)}%`
                                        : "—"}
                                      )
                                    </span>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* MV Distribution Histograms */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(results.best_mv_values).map(
            ([paramName, bestValue]) => {
              const distribution = results.mv_distributions?.[paramName];
              if (!distribution) return null;

              const histogramData = generateHistogramData(
                paramName,
                distribution,
                bestValue as number
              );
              const percentiles = distribution.percentiles || {};
              const p5 = percentiles["5"] || percentiles["5.0"];
              const p95 = percentiles["95"] || percentiles["95.0"];

              return (
                <Card key={paramName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-orange-600" />
                        {paramName}
                      </span>
                      <span className="text-xs font-normal text-slate-500">
                        Разпределение от успешни опити
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={histogramData}
                          margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="binCenter"
                            tick={{
                              fontSize: 10,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                            tickFormatter={(value) => value.toFixed(1)}
                          />
                          <YAxis
                            tick={{
                              fontSize: 10,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                            label={{
                              value: "Честота",
                              angle: -90,
                              position: "insideLeft",
                              style: { fontSize: 10 },
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e2e8f0",
                              borderRadius: "6px",
                              fontSize: "12px",
                            }}
                            formatter={(value: number) => [
                              value.toFixed(2),
                              "Честота",
                            ]}
                            labelFormatter={(value) =>
                              `Стойност: ${Number(value).toFixed(2)}`
                            }
                          />
                          {/* Histogram bars */}
                          <Bar
                            dataKey="frequency"
                            fill="hsl(217, 91%, 60%)"
                            opacity={0.7}
                            radius={[4, 4, 0, 0]}
                          />
                          {/* Best value line */}
                          <ReferenceLine
                            x={bestValue}
                            stroke="hsl(25, 95%, 53%)"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{
                              value: `Най-добра: ${(
                                bestValue as number
                              ).toFixed(2)}`,
                              position: "top",
                              fill: "hsl(25, 95%, 53%)",
                              fontSize: 10,
                              fontWeight: "bold",
                            }}
                          />
                          {/* Mean line */}
                          <ReferenceLine
                            x={distribution.mean}
                            stroke="hsl(142, 76%, 36%)"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            label={{
                              value: `μ: ${distribution.mean.toFixed(2)}`,
                              position: "bottom",
                              fill: "hsl(142, 76%, 36%)",
                              fontSize: 9,
                            }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Statistics Summary */}
                    <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center p-2 bg-orange-50 rounded border border-orange-200">
                        <div className="text-orange-600 font-semibold">
                          Най-добра
                        </div>
                        <div className="font-bold text-slate-800">
                          {(bestValue as number).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                        <div className="text-green-600 font-semibold">
                          Средна
                        </div>
                        <div className="font-bold text-slate-800">
                          {distribution.mean.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="text-blue-600 font-semibold">
                          Ст. откл.
                        </div>
                        <div className="font-bold text-slate-800">
                          ±{distribution.std.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-purple-50 rounded border border-purple-200">
                        <div className="text-purple-600 font-semibold">
                          90% CI
                        </div>
                        <div className="font-bold text-slate-800 text-[10px]">
                          {p5?.toFixed(1)} - {p95?.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
