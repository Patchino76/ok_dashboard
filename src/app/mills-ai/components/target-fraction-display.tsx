"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { CheckCircle, AlertTriangle, Target, TrendingUp } from "lucide-react"

interface TargetData {
  timestamp: number
  value: number
  target: number
}

interface TargetFractionDisplayProps {
  currentTarget: number | null
  targetData: TargetData[]
  isOptimizing: boolean
}

export function TargetFractionDisplay({
  currentTarget,
  targetData,
  isOptimizing,
}: TargetFractionDisplayProps) {
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
      .getSeconds()
      .toString()
      .padStart(2, "0")}`
  }

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Mill Recovery Fraction
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={!isOptimizing ? "default" : "destructive"} className="px-3 py-1">
              {!isOptimizing ? "READY" : "PREDICTING"}
            </Badge>
            {!isOptimizing ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Main Values Display */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <div className="space-y-6">
              {/* Current Target */}
              <div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Target</div>
                <div className="mt-1 flex items-end">
                  <span className="text-4xl font-bold text-blue-600">{currentTarget?.toFixed(1) || 'N/A'}</span>
                  <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">%</span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  AI-predicted optimal target value
                </div>
              </div>

              {/* Model Information */}
              <div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Model</div>
                <div className="mt-1 flex items-end">
                  <span className="text-lg font-medium text-green-600">xgboost_PSI80_mill8</span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Target variable: PSI80
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Target Prediction Trend</span>
              </div>

              <div className="h-[240px]">
                {targetData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={targetData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatTime}
                        stroke="#6b7280"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#6b7280"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        domain={[
                          (dataMin: number) => Math.floor(dataMin - 2),
                          (dataMax: number) => Math.ceil(dataMax + 2),
                        ]}
                      />
                      <Tooltip
                        labelFormatter={formatTime}
                        contentStyle={{ background: "#1f2937", borderColor: "#374151", color: "#e5e7eb" }}
                        itemStyle={{ color: "#e5e7eb" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="Predicted"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={true}
                        animationDuration={300}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-500">No prediction data available. Adjust parameters and click Predict.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
