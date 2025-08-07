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
  pv: number
  sp?: number | null
}

interface TargetFractionDisplayProps {
  currentTarget: number | null
  currentPV: number | null
  targetData: TargetData[]
  isOptimizing: boolean
  isSimulationMode?: boolean
  modelName?: string
  targetVariable?: string
}

export function TargetFractionDisplay({
  currentTarget,
  currentPV,
  targetData,
  isOptimizing,
  isSimulationMode = false,
  modelName,
  targetVariable,
}: TargetFractionDisplayProps) {
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
  }

  const formatTooltipValue = (value: number) => {
    return value?.toFixed(2) || 'N/A'
  }

  // Format data for chart - show only last hour of data
  const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour in milliseconds
  
  const chartData = targetData
    .filter(item => item.timestamp >= oneHourAgo) // Only keep data from the last hour
    .map((item) => ({
      time: item.timestamp,
      value: item.value,
      target: item.target,
      pv: item.pv,
      // For the first data point, ensure SP overlaps with PV if SP is not set
      sp: item.sp !== undefined ? item.sp : (targetData.length === 1 ? item.pv : null)
    }))
    .sort((a, b) => a.time - b.time); // Ensure data is sorted by time

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
              {/* Current Values */}
              <div className="space-y-4">
                {/* Process Variable (PV) */}
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Process Variable (PV)</div>
                  <div className="mt-1 flex items-end">
                    <span className="text-4xl font-bold text-emerald-600">{currentPV?.toFixed(1) || 'N/A'}</span>
                    <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">%</span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Current measured PSI80 value
                  </div>
                </div>

                {/* Current Target/Setpoint (SP) */}
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Setpoint Target (SP)</div>
                  <div className="mt-1 flex items-end">
                    <span className={`text-4xl font-bold ${isSimulationMode ? 'text-red-600' : 'text-blue-600'}`}>
                      {currentTarget?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">%</span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {isSimulationMode ? 'Simulation-predicted target value' : 'AI-predicted optimal target value'}
                  </div>
                </div>
              </div>


              <div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Model</div>
                <div className="mt-1 flex items-end">
                  <span className="text-lg font-medium text-green-600">{modelName || 'N/A'}</span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Target variable: {targetVariable || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">PSI80 Trend</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Process Variable (PV)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${isSimulationMode ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    <span>Setpoint (SP) {isSimulationMode ? '(Simulation)' : '(Real-time)'}</span>
                  </div>
                </div>
              </div>

              <div className="h-[240px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis
                        dataKey="time"
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
                        tickFormatter={(value) => `${value}%`}
                        label={{ 
                          value: 'PSI80 (%)', 
                          angle: -90, 
                          position: 'insideLeft',
                          fill: '#6b7280',
                          style: { fontSize: '12px' }
                        }}
                      />
                      <Tooltip
                        labelFormatter={(value) => `Време: ${formatTime(value)}`}
                        formatter={(value: number, name: string, props: any) => {
                          const isPV = name === 'Process Variable (PV)';
                          const displayValue = isPV ? props.payload.pv : value;
                          const color = isPV ? '#10b981' : (isSimulationMode ? '#dc2626' : '#3b82f6');
                          return [
                            <span key="value" style={{ color }}>{`${isPV ? 'PV' : 'SP'}: ${formatTooltipValue(displayValue)}%`}</span>,
                            <span key="name" style={{ color, opacity: 0.7, fontSize: '0.9em' }}>(PSI80)</span>
                          ];
                        }}
                        contentStyle={{
                          background: '#1f2937',
                          borderColor: '#374151',
                          borderRadius: '0.375rem',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}
                        itemStyle={{ 
                          color: '#e5e7eb',
                          padding: '0.25rem 0',
                          textTransform: 'none',
                          letterSpacing: '0.025em'
                        }}
                        labelStyle={{
                          color: '#e5e7eb',
                          fontWeight: 500,
                          marginBottom: '0.5rem',
                          borderBottom: '1px solid #374151',
                          paddingBottom: '0.5rem'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="pv" 
                        name="Process Variable (PV)" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false} // Disable animation to ensure line is always visible
                      />
                      <Line 
                        type="monotone" 
                        dataKey="sp" 
                        name={isSimulationMode ? 'Setpoint (SP) (Simulation)' : 'Setpoint (SP) (Real-time)'} 
                        stroke={isSimulationMode ? "#dc2626" : "#3b82f6"} 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false} // Disable animation to ensure line is always visible
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
