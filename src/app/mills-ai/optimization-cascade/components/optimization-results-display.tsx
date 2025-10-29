"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
  BarChart3,
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
    mv_distributions?: Record<string, { mean: number; std: number; median: number; percentiles: Record<string, number>; min_value: number; max_value: number; sample_count: number }>;
    target_value: number;
    tolerance: number;
  };
  targetVariable: string;
  targetUnit: string;
}

export function OptimizationResultsDisplay({
  results,
  targetVariable,
  targetUnit,
}: OptimizationResultsDisplayProps) {
  // Calculate performance rating
  const performanceRating = useMemo(() => {
    const successRate = results.success_rate * 100;
    if (successRate >= 70) return { label: "Отлично", color: "emerald", icon: CheckCircle };
    if (successRate >= 50) return { label: "Добро", color: "blue", icon: TrendingUp };
    return { label: "Приемливо", color: "amber", icon: AlertTriangle };
  }, [results.success_rate]);

  // Generate histogram data from distributions
  const generateHistogramData = (paramName: string, distribution: any, bestValue: number) => {
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
      <Card className={`border-2 border-${performanceRating.color}-200 bg-${performanceRating.color}-50/50`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PerformanceIcon className={`h-5 w-5 text-${performanceRating.color}-600`} />
            Резултати от оптимизацията
            <Badge variant="outline" className={`ml-auto bg-${performanceRating.color}-100 text-${performanceRating.color}-700 border-${performanceRating.color}-300`}>
              {performanceRating.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Success Rate */}
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Успеваемост</div>
              <div className={`text-2xl font-bold text-${performanceRating.color}-600`}>
                {(results.success_rate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500">
                {results.successful_trials}/{results.total_trials} опити
              </div>
            </div>

            {/* Target Achievement */}
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Цел постигната</div>
              <div className={`text-2xl font-bold ${results.target_achieved ? 'text-green-600' : 'text-amber-600'}`}>
                {results.target_achieved ? '✓' : '⚠'}
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
                {(results.optimization_time / results.total_trials * 1000).toFixed(0)}ms/опит
              </div>
            </div>

            {/* Best Distance */}
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Точност</div>
              <div className="text-2xl font-bold text-purple-600">
                {results.best_distance !== undefined ? results.best_distance.toFixed(4) : '—'}
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
              <span className="font-semibold">{results.target_value.toFixed(2)} {targetUnit}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-600">Толеранс:</span>
              <span className="font-semibold">±{(results.tolerance * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-600">Допустим диапазон:</span>
              <span className="font-semibold">
                {(results.target_value * (1 - results.tolerance)).toFixed(2)} - {(results.target_value * (1 + results.tolerance)).toFixed(2)} {targetUnit}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MV Distribution Histograms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(results.best_mv_values).map(([paramName, bestValue]) => {
          const distribution = results.mv_distributions?.[paramName];
          if (!distribution) return null;

          const histogramData = generateHistogramData(paramName, distribution, bestValue as number);
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
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => value.toFixed(1)}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        label={{ value: 'Честота', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [value.toFixed(2), "Честота"]}
                        labelFormatter={(value) => `Стойност: ${Number(value).toFixed(2)}`}
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
                          value: `Най-добра: ${(bestValue as number).toFixed(2)}`,
                          position: 'top',
                          fill: 'hsl(25, 95%, 53%)',
                          fontSize: 10,
                          fontWeight: 'bold'
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
                          position: 'bottom',
                          fill: 'hsl(142, 76%, 36%)',
                          fontSize: 9
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Statistics Summary */}
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-orange-50 rounded border border-orange-200">
                    <div className="text-orange-600 font-semibold">Най-добра</div>
                    <div className="font-bold text-slate-800">{(bestValue as number).toFixed(2)}</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                    <div className="text-green-600 font-semibold">Средна</div>
                    <div className="font-bold text-slate-800">{distribution.mean.toFixed(2)}</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="text-blue-600 font-semibold">Ст. откл.</div>
                    <div className="font-bold text-slate-800">±{distribution.std.toFixed(2)}</div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded border border-purple-200">
                    <div className="text-purple-600 font-semibold">90% CI</div>
                    <div className="font-bold text-slate-800 text-[10px]">
                      {p5?.toFixed(1)} - {p95?.toFixed(1)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
