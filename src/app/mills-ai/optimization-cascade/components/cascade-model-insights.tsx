"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  Activity,
  Gauge,
  Layers3,
  Target,
  TrendingUp,
  CalendarClock,
  Database,
} from "lucide-react";

interface FeatureImportancePoint {
  name: string;
  value: number;
}

interface ProcessModelPerformance {
  r2_score?: number;
  rmse?: number;
  feature_importance?: Record<string, number>;
  input_vars?: string[];
  output_var?: string;
}

interface QualityModelPerformance extends ProcessModelPerformance {
  cv_vars?: string[];
  dv_vars?: string[];
}

interface ChainValidationMetrics {
  r2_score?: number;
  rmse?: number;
  mae?: number;
  n_samples?: number;
  n_requested?: number;
  validation_error?: string | null;
}

interface CascadeModelInsightsProps {
  millNumber: number;
  modelInfo?: {
    metadata?: {
      created_at?: string;
      model_performance?: Record<
        string,
        | ProcessModelPerformance
        | QualityModelPerformance
        | ChainValidationMetrics
      >;
      training_config?: {
        training_timestamp?: string;
        configured_features?: {
          mv_features?: string[];
          cv_features?: string[];
          dv_features?: string[];
          target_variable?: string;
        };
      };
      data_info?: {
        original_shape?: [number, number];
        cleaned_shape?: [number, number];
        data_reduction?: string;
      };
    };
    performance?: Record<
      string,
      ProcessModelPerformance | QualityModelPerformance | ChainValidationMetrics
    >;
    training_config?: {
      training_timestamp?: string;
      configured_features?: {
        mv_features?: string[];
        cv_features?: string[];
        dv_features?: string[];
        target_variable?: string;
      };
    };
    data_info?: {
      original_shape?: [number, number];
      cleaned_shape?: [number, number];
      data_reduction?: string;
    };
  } | null;
  isLoading?: boolean;
  error?: string | null;
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return value;
  }
}

function formatNumber(value?: number, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

const renderImportanceLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === undefined || value === null) return null;

  const percentage = Math.round((value as number) * 100);
  return (
    <text
      x={x + width / 2}
      y={(y ?? 0) - 6}
      fill="hsl(var(--muted-foreground))"
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
    >
      {percentage}%
    </text>
  );
};

export function CascadeModelInsights({
  millNumber,
  modelInfo,
  isLoading = false,
  error,
}: CascadeModelInsightsProps) {
  const performance =
    modelInfo?.performance || modelInfo?.metadata?.model_performance;
  const chainValidation =
    (performance as any)?.chain_validation ||
    modelInfo?.metadata?.model_performance?.chain_validation;
  const qualityModel =
    (performance as any)?.quality_model ||
    modelInfo?.metadata?.model_performance?.quality_model;

  const processModels = useMemo(() => {
    if (!performance) return [];
    return Object.entries(performance)
      .filter(([key]) => key.startsWith("process_model"))
      .map(([key, value]) => ({
        id: key,
        label: key.replace("process_model_", ""),
        metrics: value as ProcessModelPerformance,
      }));
  }, [performance]);

  const trainingTimestamp =
    modelInfo?.training_config?.training_timestamp ||
    modelInfo?.metadata?.training_config?.training_timestamp ||
    modelInfo?.metadata?.created_at;
  const configuredFeatures =
    modelInfo?.training_config?.configured_features ||
    modelInfo?.metadata?.training_config?.configured_features;
  const dataInfo = modelInfo?.data_info || modelInfo?.metadata?.data_info;

  if (isLoading) {
    return (
      <Card className="border-dashed border-blue-300 bg-blue-50/60 dark:bg-blue-950/20">
        <CardContent className="py-10 flex flex-col items-center gap-2 text-blue-600 dark:text-blue-200">
          <TrendingUp className="h-10 w-10 animate-pulse" />
          <div className="text-sm font-medium">
            Loading cascade model insights…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-red-200 bg-red-50/70 dark:bg-red-950/20">
        <CardContent className="py-6 text-sm text-red-600 dark:text-red-200">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!performance) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50/60 dark:bg-slate-800/40">
        <CardContent className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">
          Train a cascade model for Mill {millNumber} to unlock performance
          insights and feature analysis.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200"
        >
          Mill {millNumber}
        </Badge>
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200"
        >
          Updated {formatDate(trainingTimestamp)}
        </Badge>
        {configuredFeatures?.target_variable && (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 flex items-center gap-1"
          >
            <Target className="h-3.5 w-3.5" />
            {configuredFeatures.target_variable}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-0 bg-white/80 dark:bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Gauge className="h-4 w-4 text-amber-500" />
              Cascade Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">R² Score</div>
              <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {formatNumber(chainValidation?.r2_score, 2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">RMSE</div>
              <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {formatNumber(chainValidation?.rmse, 2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">MAE</div>
              <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {formatNumber(chainValidation?.mae, 2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Samples</div>
              <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {chainValidation?.n_samples ?? "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 bg-white/80 dark:bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <CalendarClock className="h-4 w-4 text-blue-500" />
              Training Window
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Configured MVs</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {configuredFeatures?.mv_features?.length ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Configured CVs</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {configuredFeatures?.cv_features?.length ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Configured DVs</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {configuredFeatures?.dv_features?.length ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Target</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {configuredFeatures?.target_variable ?? "PSI200"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 bg-white/80 dark:bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Database className="h-4 w-4 text-emerald-500" />
              Data Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Original Rows</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {dataInfo?.original_shape?.[0]?.toLocaleString() ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Cleaned Rows</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {dataInfo?.cleaned_shape?.[0]?.toLocaleString() ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Feature Count</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {dataInfo?.cleaned_shape?.[1] ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Reduction</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {dataInfo?.data_reduction ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {(qualityModel || processModels.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-200">
            <Target className="h-4 w-4 text-purple-500" />
            Model Feature Importance
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {qualityModel && (
              <Card className="border-0 shadow-sm bg-white/80 dark:bg-slate-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-100">
                    <span>Target</span>
                    <div className="flex gap-2 items-center">
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100"
                      >
                        R² {formatNumber(qualityModel.r2_score, 2)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-100"
                      >
                        RMSE {formatNumber(qualityModel.rmse, 2)}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-6">
                  <div className="mt-6 h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(
                          qualityModel.feature_importance || {}
                        ).map(([name, value]) => ({ name, value }))}
                        margin={{ top: 6, right: 12, left: 28, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          angle={-90}
                          textAnchor="end"
                          height={80}
                          tick={{
                            fontSize: 11,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <YAxis
                          width={44}
                          tick={{
                            fontSize: 11,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
                          formatter={(value: number) => [
                            `${(value * 100).toFixed(2)}%`,
                            "Importance",
                          ]}
                        />
                        <Bar
                          dataKey="value"
                          fill="#8b5cf6"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={38}
                        >
                          <LabelList dataKey="value" content={renderImportanceLabel} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {processModels.map(({ id, label, metrics }) => {
              const chartData: FeatureImportancePoint[] = Object.entries(
                metrics.feature_importance || {}
              ).map(([name, value]) => ({ name, value }));

              return (
                <Card
                  key={id}
                  className="border-0 shadow-sm bg-white/80 dark:bg-slate-900/50"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-100">
                      <span>{label}</span>
                      <div className="flex gap-2 text-xs text-slate-500">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100"
                        >
                          R² {formatNumber(metrics.r2_score, 2)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-100"
                        >
                          RMSE {formatNumber(metrics.rmse, 2)}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 pb-6">
                    <div className="mt-6 h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 6, right: 12, left: 28, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis
                            dataKey="name"
                            angle={-90}
                            textAnchor="end"
                            height={80}
                            tick={{
                              fontSize: 11,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                          />
                          <YAxis
                            width={44}
                            tick={{
                              fontSize: 11,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                            tickFormatter={(val) =>
                              `${(val * 100).toFixed(0)}%`
                            }
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
                            formatter={(value: number) => [
                              `${(value * 100).toFixed(2)}%`,
                              "Importance",
                            ]}
                          />
                          <Bar
                            dataKey="value"
                            fill="#f97316"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={38}
                          >
                            <LabelList dataKey="value" content={renderImportanceLabel} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
