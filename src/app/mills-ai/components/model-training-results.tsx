"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { TrendingUp, Clock, Award } from "lucide-react"
import type { TrainingResults } from "./model-training-dashboard"

interface ModelTrainingResultsProps {
  results: TrainingResults
}

export function ModelTrainingResults({ results }: ModelTrainingResultsProps) {
  const metricsData = [
    { name: "MAE", value: results.mae, color: "#3b82f6", description: "Mean Absolute Error" },
    { name: "MSE", value: results.mse, color: "#ef4444", description: "Mean Squared Error" },
    { name: "RMSE", value: results.rmse, color: "#f59e0b", description: "Root Mean Squared Error" },
    { name: "R²", value: results.r2, color: "#10b981", description: "R-squared Score" },
    { name: "MAPE", value: results.mape, color: "#8b5cf6", description: "Mean Absolute Percentage Error" },
  ]

  const getPerformanceRating = (r2: number) => {
    if (r2 >= 0.9) return { rating: "Excellent", color: "bg-green-500", textColor: "text-green-700" }
    if (r2 >= 0.8) return { rating: "Good", color: "bg-blue-500", textColor: "text-blue-700" }
    if (r2 >= 0.7) return { rating: "Fair", color: "bg-yellow-500", textColor: "text-yellow-700" }
    return { rating: "Poor", color: "bg-red-500", textColor: "text-red-700" }
  }

  const performance = getPerformanceRating(results.r2)

  return (
    <div className="space-y-4">
      {/* Overall Performance */}
      <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Award className="h-5 w-5 text-yellow-600" />
          <span className="font-semibold">Model Performance</span>
        </div>
        <Badge className={`${performance.color} text-white mb-2`}>{performance.rating}</Badge>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{(results.r2 * 100).toFixed(1)}%</div>
        <div className="text-xs text-slate-600 dark:text-slate-400">R² Score</div>
      </div>

      {/* Training Time */}
      <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
        <Clock className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">Training Time: {results.trainingTime.toFixed(1)}s</span>
      </div>

      {/* Metrics Chart */}
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Model Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name, props) => [`${Number(value).toFixed(3)}`, props.payload.description]}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Feature Importance */}
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Feature Importance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {results.featureImportance.slice(0, 5).map((feature, index) => (
              <div key={feature.feature} className="flex items-center gap-2">
                <div className="w-20 text-xs text-slate-600 dark:text-slate-400 truncate">{feature.feature}</div>
                <div className="flex-1">
                  <Progress value={feature.importance * 100} className="h-2" />
                </div>
                <div className="w-12 text-xs text-slate-600 dark:text-slate-400 text-right">
                  {(feature.importance * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Validation Curve */}
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Training Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results.validationCurve.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="iteration" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="trainLoss"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                  name="Training Loss"
                />
                <Line
                  type="monotone"
                  dataKey="valLoss"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  name="Validation Loss"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {metricsData.map((metric) => (
          <div key={metric.name} className="p-2 bg-slate-50 dark:bg-slate-700 rounded">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {metric.name}: {metric.value.toFixed(3)}
            </div>
            <div className="text-slate-600 dark:text-slate-400 text-xs">{metric.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
